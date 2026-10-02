# iOS call "Could not connect" — investigation status (2026-10-03)

**UPDATE: the `-ObjC` fix below was real but INSUFFICIENT — it was not the
actual root cause. The real root cause and fix are documented in the new
section "REAL ROOT CAUSE — found after rebuilding the `-ObjC` fix (2026-10-03,
continued)" below. Read that section first; this top section is kept for the
investigative trail that led there.**

Handoff note for whoever continues this. Written mid-investigation because the
session that found the root cause ran low on context — **the fix below is
applied but NOT YET rebuilt+device-tested.** Do that first.

## Where this started

User reported real-device TestFlight testing of a new build still hit
"Connecting…" then "Could not connect to the call — check your connection
and try again." on iOS, even after:
- The Agora engine teardown-sequencing fix (`_releaseEngine`,
  `unregisterEventHandler` → `await leaveChannel()` → `await release()`,
  commit `c30db0f` on this branch) — addressed a dangling-reference crash
  risk Agora support flagged, but didn't touch the actual connect failure.
- `agora_rtc_engine` already bumped `6.5.4 → 6.6.4` in `pubspec.yaml`
  (uncommitted, done by a concurrent session in this shared working tree —
  this is the version bump CLAUDE.md had flagged as "needs explicit
  go-ahead, not yet applied" — it turned out already applied, just
  uncommitted).

Also found blocking testing: `lib/core/feature_flags.dart` (new, untracked,
from a concurrent session) had `kCallsEnabled = false` as a kill-switch,
which silently shows a "Call options will be enabled soon" snackbar instead
of ever attempting a call. **Flipped to `true` for testing** — see the file's
own doc comment for the exact conditions under which it should go back to
`false` vs. stay `true` and get merged.

## Root cause — found via real device logs, not guessing

Confirmed no crash — the app survives cleanly, shows the handled "Could not
connect" exception. Pulled a full iOS unified-log archive off the connected
device (`idevicesyslog -u <udid> archive`, NOT the plain syslog relay — that
only shows kernel/daemon noise, not app-level `os_log`/NSLog output) and
found, on **every single join attempt**, right as the call screen opens:

```
[ERROR:flutter/runtime/dart_isolate.cc(1402)] Unhandled exception:
Invalid argument(s): Failed to lookup symbol 'Iris_InitDartApiDL':
dlsym(RTLD_DEFAULT, Iris_InitDartApiDL): symbol not found
#4  IrisEventIO.initialize (package:iris_method_channel/.../iris_event_io.dart:33)
#5  _IrisMethodChannelNative.initilize (package:iris_method_channel/.../iris_method_channel_internal_io.dart:322)
```

`iris_method_channel` is the Dart↔native FFI bridge `agora_rtc_engine` uses
internally. Without this symbol, native Agora SDK callbacks
(`onJoinChannelSuccess`, `onError`, everything) can **never reach Dart** —
which is exactly why every attempt silently timed out after 20s with zero
Agora log output anywhere: the bridge that would relay any of it is broken.

### Why the symbol is missing — traced to source, confirmed structurally

- `Iris_InitDartApiDL` is defined in `iris_method_channel`'s own package, at
  `<pub-cache>/iris_method_channel-2.2.5/src/iris_event.cc`.
- Its iOS target (`ios/iris_method_channel/Sources/iris_method_channel/`)
  pulls that file in via `IrisMethodChannelForward.mm`:
  `#include "../../../../src/iris_event.cc"` — so the symbol genuinely is
  part of the iOS target's compiled source.
- `IrisMethodChannelPlugin.m` has an explicit, self-aware safeguard:
  `+(void)_irisMethodChannelDummyFunc` — comment: *"dummy function to avoid
  symbols striping when building static library"* — it calls
  `Iris_InitDartApiDL(NULL)` and friends specifically so the linker sees a
  reference and won't dead-strip them.
- **But that safeguard only helps if something references the dummy
  function's containing class/translation unit in the first place.** This
  project has `-ObjC` nowhere in its build settings (checked
  `project.pbxproj`, `ios/Flutter/*.xcconfig`, `ios/Podfile` — zero hits).
  `-ObjC` is the standard, well-documented Xcode flag required to force a
  linker to pull in **all** object code from a static library containing
  Objective-C classes, not just symbols directly referenced elsewhere in the
  call graph. Without it, since nothing in Swift/Dart code calls
  `IrisMethodChannelPlugin` by name (Agora's Swift glue presumably talks to
  the C API, not the Flutter-plugin Obj-C class), the **entire translation
  unit** — both `.m`/`.mm` files, including the dummy-func safeguard itself —
  gets silently dropped by the linker.
- Verified directly: searched every single Mach-O binary in the built
  `Runner.app` (all frameworks + the main executable) with `nm -g` for
  `InitDartApiDL` or any `iris`-named symbol — **zero hits anywhere in the
  shipped binary**, confirming the whole compilation unit is missing, not
  just this one function.

This is a pure Xcode build-configuration bug, **unrelated to which Agora
version is pinned** — it would have silently broken 6.5.4 too. It's also
unrelated to the earlier `AgoraRtcWrapper` native crash investigation (that
was real too, just a different, now-probably-moot problem if this is the
actual blocker — see Open Questions).

## Fix applied (uncommitted as of this file being written — commit happening now)

Added `OTHER_LDFLAGS = ("$(inherited)", "-ObjC");` to all three Runner
**app target** build configs in `ios/Runner.xcodeproj/project.pbxproj`
(Debug `97C147061CF9000F007C117D`, Release `97C147071CF9000F007C117D`,
Profile `249021D4217E4FDB00AE95B9` — NOT the project-level defaults, NOT
RunnerTests). Verified `plutil -lint` still passes after the edit (valid
pbxproj).

**This fix has NOT been rebuilt or tested yet.** Also did a full clean
beforehand while chasing a (probably-unnecessary, but harmless) stale-cache
theory: cleared both `Runner-*` DerivedData folders, deleted both
`Package.resolved` SPM lockfiles (regenerated fresh — now committed), ran
`flutter clean && flutter pub get`. That full-clean rebuild is what
proved the `-ObjC`-caused symbol stripping is NOT a caching artifact — it
reproduced identically on a from-scratch resolve/build, which is what led to
finding the real `-ObjC` gap.

## NEXT STEPS (in order)

1. **Rebuild**: `cd mobile_flutter && bash scripts/build_ios_release.sh`
   (bakes in prod `API_URL`, `GIT_SHA`, `BUILD_TIME` — see the script's own
   header comment for why to always use it over a bare `flutter build ipa`).
2. **Verify the symbol is now present before burning a device test on it**:
   ```bash
   RUNNER_BIN="build/ios/archive/Runner.xcarchive/Products/Applications/Runner.app/Runner"
   nm -g "$RUNNER_BIN" | grep -i "InitDartApiDL"
   ```
   Should show a hit now. If it still doesn't, the `-ObjC` theory was wrong
   or incompletely applied — re-open the investigation, don't just retest on
   device blind.
3. **If the symbol is present**: export/install on the connected iPhone
   (`idevice_id -l` for UDID; device was reachable via
   `Kiranrajs-iPhone.coredevice.local` earlier this session — may need
   re-connecting) and place a real call both directions. Use the exact log
   capture method below if it still fails — don't fall back to guessing.
4. **If it connects cleanly**: that confirms root cause. Then:
   - Decide whether `kCallsEnabled` in `lib/core/feature_flags.dart` goes
     back to `false` (if this branch isn't merging immediately) or whether
     to merge this branch into `feature/flutter-migration` (production) —
     **do not merge without the user's explicit go-ahead**, per the explicit
     instruction earlier this session to keep this work isolated on
     `fix/wallet-audit-and-agora-ios-crash` until reviewed/tested.
   - Also worth testing an actual Android build isn't affected by the
     `-ObjC` change (it's iOS-only via `OTHER_LDFLAGS`, shouldn't touch
     Android's Gradle build at all, but confirm).
   - Revisit whether the earlier `AgoraRtcWrapper` native crash
     (`EXC_BAD_ACCESS`/`SIGSEGV`, documented extensively in CLAUDE.md's
     "iOS published to App Store, call still not connecting" section) is
     even still reachable — if the Iris bridge was broken this whole time,
     some of those historical crash reports might have been hit via a
     *different* code path than normal joins (worth a skeptical re-read,
     not an assumption either way).

## How to capture live diagnostic logs from a connected iPhone (reusable recipe)

The plain BSD syslog relay (`idevicesyslog` with no `archive` subcommand) is
USELESS for this — it only shows kernel/daemon noise on modern iOS, zero
app-level `os_log`/NSLog output. Use the proper unified-log archive pull
instead:

```bash
# 1. Find the device (classic UDID, not the devicectl identifier):
idevice_id -l

# 2. Pull a logarchive covering the last N minutes (large — ~270MB for 15min):
UDID=<from step 1>
NOW=$(date +%s); START=$((NOW - 900))
idevicesyslog -u "$UDID" archive device.tar --start-time "$START"
tar -xf device.tar

# 3. The extraction dumps loose hex-named dirs + Info.plist/dsc/timesync at
#    top level — these ARE a .logarchive bundle's contents, just not in a
#    directory named *.logarchive. Organize them into one:
mkdir device.logarchive
mv [0-9A-F][0-9A-F] Extra HighVolume Persist Signpost Special dsc timesync \
   Info.plist logdata.LiveData.tracev3 device.logarchive/ 2>/dev/null

# 4. Query it. IMPORTANT: `log` is a zsh BUILTIN that shadows /usr/bin/log —
#    always call the full path or you get a useless
#    "(eval):log:1: too many arguments" error that looks like a `log show`
#    bug but isn't:
/usr/bin/log show --archive device.logarchive \
  --predicate 'processImagePath CONTAINS "Runner"' --info --debug \
  > runner_full.txt

# 5. Search for the app's own prints (Flutter's debugPrint shows up tagged
#    "Runner: (Flutter) flutter: ..."), exceptions, and Agora activity:
grep -n "flutter:\|ERROR:flutter\|Unhandled exception\|agora\|iris" -i runner_full.txt
```

## Current branch / commit state

Everything in this file's "Fix applied" section, plus `feature_flags.dart`
and its two call sites, is being committed together on
`fix/wallet-audit-and-agora-ios-crash` (NOT merged into
`feature/flutter-migration`/production) in the same commit as this file, per
explicit instruction to keep this isolated until reviewed. Do not push
without checking with the user first — same standing instruction as the rest
of this branch's work (see the two commits already on it for the wallet-audit
and Agora-teardown-fix precedent of asking before pushing).

Untouched, deliberately left alone (unrelated concurrent-session work sitting
in this shared working tree, not reviewed, not part of this investigation):
`admin/app/dashboard/users/[id]/EditUserPanel.tsx`,
`mobile_flutter/android/app/build.gradle.kts`,
`mobile_flutter/android/app/libs/README.md`,
`mobile_flutter/android/app/libs/iris-rtc-patched.aar`,
`backend/scratchpad/`.

## REAL ROOT CAUSE — found after rebuilding the `-ObjC` fix (2026-10-03, continued)

Followed this file's own "NEXT STEPS" exactly: rebuilt via
`build_ios_release.sh`, then — before any device test — ran
`nm -g Runner | grep -i InitDartApiDL` on the fresh archive. **It still came
back empty.** Per this file's own instruction ("If it still doesn't, the
-ObjC theory was wrong or incompletely applied — re-open the investigation,
don't just retest on device blind"), re-opened the investigation instead of
testing on device.

### Why `-ObjC` was a red herring (confirmed, not assumed)

`-ObjC`'s entire mechanism is about **selective extraction from static
archives (`.a` files)**: without it, a linker can skip an archive member
(`.o`) that contains only Objective-C classes if nothing else references it.
It has nothing to do with plain object files passed directly to the linker —
those are never selectively skipped at the file level.

Checked directly in DerivedData after a fresh archive build:
`iris_method_channel`'s Swift Package Manager target is NOT built as a
static archive at all — Xcode's modern SPM integration builds it as a single
**merged relocatable object file**, `iris_method_channel.o`
(`BuildProductsPath/Release-iphoneos/iris_method_channel.o`). This exact
path appears as a genuine, direct entry in `Runner.LinkFileList` — i.e. it
**was** being linked into the app the whole time, `-ObjC` or not. Inspecting
that pre-link `.o` directly with `nm` confirmed it contains
`_Iris_InitDartApiDL` and all 4 sibling functions as real, global (`T`)
symbols, plus the full `IrisMethodChannelPlugin` Objective-C class metadata —
the object file itself was always complete and correct.

So the file reaches the linker intact. Something **after** that was removing
the symbols from the final shipped binary.

### The actual cause: Xcode's post-link `strip` step, not the linker

Checked the real resolved build settings for `Release`:
```
STRIP_INSTALLED_PRODUCT = YES
STRIP_STYLE             = all        <- the culprit
DEAD_CODE_STRIPPING     = YES        <- unrelated, was already fine
```
`STRIP_STYLE = all` is Xcode's default for a **main app executable** in a
Release/Archive build (as opposed to `non-global`, the default for
*frameworks*, which need to keep their public API symbols since external
code links against them). Apple's reasoning: nothing external ever needs to
dynamically link against an app's own executable, so by default it strips
**every** symbol not required for the binary's own normal execution —
including a plain global C function that's never called via a *named
symbol reference* anywhere else in the compiled code.

That's exactly `Iris_InitDartApiDL`'s situation. It IS called, but only from
within the same object file
(`+[IrisMethodChannelPlugin _irisMethodChannelDummyFunc]`), which compiles to
a direct address-relative branch instruction — no symbol-table lookup is
needed for that call to work, so the *code* keeps working fine even after its
*name* is stripped from the symbol table. The only thing that actually needs
the name to survive is `iris_method_channel`'s own Dart↔native bridge, which
calls (effectively) `dlsym(RTLD_DEFAULT, "Iris_InitDartApiDL")` at **runtime**
via `ffi.DynamicLibrary.process().lookup(...)`
(`iris_event_io.dart` → `NativeIrisEventBinding`) — a lookup that can only
ever find symbols present in the binary's exported symbol table. Confirmed
the exact 5 names this lookup needs, straight from the dummy-function
safeguard's own source
(`IrisMethodChannelPlugin.m`):
`Iris_InitDartApiDL`, `Iris_Dispose`, `Iris_OnEvent`,
`Iris_RegisterDartPort`, `Iris_UnregisterDartPort`.

This also explains why no `flutter run` debug session ever reproduced this,
across the whole multi-session investigation: **Debug builds don't strip the
binary** (`STRIP_INSTALLED_PRODUCT` is effectively a no-op there). Only a
Release/Archive build — i.e. exactly what TestFlight ships — hits this. It's
also unrelated to which `agora_rtc_engine` version is pinned (currently
`6.6.4`) and unrelated to the earlier `AgoraRtcWrapper` native-crash
investigation.

### Fix applied and verified in the actual shipped binary

Added `STRIP_STYLE = "non-global";` to all three Runner **app-target**
build configs in `project.pbxproj` (same three blocks the `-ObjC` fix
touched: Debug `97C147061CF9000F007C117D`, Release `97C147071CF9000F007C117D`,
Profile `249021D4217E4FDB00AE95B9`) — right alongside the existing
`OTHER_LDFLAGS` line in each. `non-global` is the same strip style frameworks
already use by default: strip local/debug symbols, but keep every
global/exported one — which is exactly what lets `dlsym`-style runtime
lookups keep working.

Verified via `xcodebuild -showBuildSettings` that this resolves correctly
(`STRIP_STYLE = non-global` for Release). Rebuilt via
`build_ios_release.sh` (archive succeeded, `-exportArchive` transiently
failed once with Xcode's generic "The request expected results but none were
found" — a known flaky error, not a real signing/content problem; a plain
retry via `xcodebuild -exportArchive` against the same already-fixed archive
succeeded cleanly). Checked the symbols **inside the actual final exported
`.ipa`** (extracted and ran `nm -g` on `Payload/Runner.app/Runner`), not just
the intermediate archive:

```
00000001000cb5b0 T _Iris_Dispose
00000001000cb4d4 T _Iris_InitDartApiDL
00000001000cb648 T _Iris_OnEvent
00000001000cb6ac T _Iris_RegisterDartPort
00000001000cb7a8 T _Iris_UnregisterDartPort
```

All 5 present. Also re-confirmed no `localhost:3001` leak in the same binary.
This is version `1.0.1` build `27`, at
`mobile_flutter/build/ios/ipa/uniscope_mobile.ipa` (~69MB — exceeds
`SendUserFile`'s 30MB cap, so it exists locally on this Mac only; needs
Transporter or `xcrun altool` with the user's own App Store Connect API key
to actually reach TestFlight, same standing limitation as every prior iOS
build in this project's history).

### What's still NOT confirmed

The symbol surviving in the binary is a necessary condition for the original
crash/exception to stop happening, confirmed by direct inspection of the
exact shipped artifact — but this has **not yet been device-tested**. The
`-ObjC` addition from the first pass is harmless and was left in place
(doesn't hurt, and is still a reasonable defensive setting for a project that
links several CocoaPods-based Objective-C static libraries via
`razorpay_flutter`), it just wasn't the fix that mattered here. Next real
step: install this exact IPA/archive on a real device and place a genuine
call, both directions, the same rigor the 2026-10-01/02 two-device test used.
If it still fails, capture a fresh `idevicesyslog ... archive` log (recipe
above) rather than guessing again — if the dlsym failure is truly gone this
should show real Agora join/connect activity instead of an immediate
exception at isolate startup.
