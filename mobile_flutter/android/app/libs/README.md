# iris-rtc-patched.aar

Vendored, manifest-patched copy of `io.agora.rtc:iris-rtc:4.6.4-build.4` (the exact
version `agora_rtc_engine` 6.6.4 declares — see its `android/build.gradle`).

Regenerated 2026-10-02 when `agora_rtc_engine` was bumped 6.5.4 → 6.6.4 (to
chase a confirmed, deterministic `EXC_BAD_ACCESS` inside `AgoraRtcWrapper` on
iOS — see CLAUDE.md's "iOS published to App Store, call still not
connecting" entry). The artifact this time was pulled straight from Maven
Central (`repo1.maven.org/maven2/io/agora/rtc/iris-rtc/...`) rather than the
local Gradle cache, since the app module's `configurations.all { exclude(...)
}` block (see below) means Gradle never resolves/downloads this module
through a normal build in the first place — the regeneration steps below are
updated to match.

## Why this exists

`io.agora.rtc:iris-rtc` and `io.agora.rtc:agora-special-full` both ship an
`AndroidManifest.xml` with `package="io.agora.rtc"`. AGP 8.3+/9.x hard-fails
the build with a duplicate-namespace error when both are on the classpath.

Both AARs are pure native-library containers — empty `classes.jar`, no
activities/providers/permissions in either manifest — so the `package`
attribute has zero runtime behavior; it only feeds AGP's `R.java` generation
and namespace bookkeeping. That makes it safe to change on one side.

This copy has `package="io.agora.rtc"` rewritten to `package="io.agora.rtc.iris"`
in its `AndroidManifest.xml` and nothing else touched — same native
`libAgoraRtcWrapper.so` for all four ABIs, same assets, same `R.txt`.

`app/build.gradle.kts` excludes the real `io.agora.rtc:iris-rtc` module
transitively (so its unpatched, colliding manifest never reaches the merger)
and adds this file as a local `implementation(files(...))` dependency instead
— so the JNI wrapper `libAgoraRtcWrapper.so` is still packaged and
`agora-special-full`'s `libagora-rtc-sdk.so` can still `dlopen` it at runtime,
unlike the previous exclude-only workaround which dropped iris-rtc entirely
and crashed "Join Call" with `UnsatisfiedLinkError`.

## Regenerating (e.g. after bumping agora_rtc_engine)

Check `~/.pub-cache/hosted/pub.dev/agora_rtc_engine-<ver>/android/build.gradle`
for the exact `iris-rtc` version that release pins. The app module's own
`configurations.all { exclude(group = "io.agora.rtc", module = "iris-rtc") }`
means a normal `flutter build` never downloads this artifact into the local
Gradle cache — pull it straight from Maven Central instead (confirmed
present there for at least 4.5.3-build.1 and 4.6.4-build.4):

```bash
V=4.6.4-build.4   # match the `iris-rtc` version from the build.gradle check above
WORK=$(mktemp -d) && cd "$WORK"
curl -sL -o iris-rtc.aar "https://repo1.maven.org/maven2/io/agora/rtc/iris-rtc/$V/iris-rtc-$V.aar"
unzip -q iris-rtc.aar -d extracted && cd extracted
sed -i '' 's/package="io.agora.rtc"/package="io.agora.rtc.iris"/' AndroidManifest.xml
zip -qr -X ../iris-rtc-patched.aar .
cp ../iris-rtc-patched.aar /path/to/mobile_flutter/android/app/libs/iris-rtc-patched.aar
```

If Maven Central ever doesn't have the version you need, fall back to
temporarily commenting out the `configurations.all { exclude(...) }` block in
`app/build.gradle.kts` and running a real build — it'll fail at manifest-merge
time with the duplicate-namespace error, but by then Gradle has already
downloaded the artifact into `~/.gradle/caches/modules-2/files-2.1/io.agora.rtc/iris-rtc/$V/`,
same as the original 4.5.3-build.1 copy was produced. Don't forget to
re-enable the exclude block afterward.

If `agora_rtc_engine` bumps to a version pinning a different `iris-rtc`/
`agora-special-full` pair, redo this against the new version and update the
`exclude`/version comment in `app/build.gradle.kts` to match.
