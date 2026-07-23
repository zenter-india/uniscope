# iris-rtc-patched.aar

Vendored, manifest-patched copy of `io.agora.rtc:iris-rtc:4.5.3-build.1` (the exact
version `agora_rtc_engine` 6.5.4 declares — see its `android/build.gradle`).

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

```bash
V=4.5.3-build.1   # match the `iris-rtc` version in
                  # ~/.pub-cache/hosted/pub.dev/agora_rtc_engine-<ver>/android/build.gradle
SRC=$(find ~/.gradle/caches/modules-2/files-2.1/io.agora.rtc/iris-rtc/$V -name '*.aar')
WORK=$(mktemp -d) && cd "$WORK"
unzip -q "$SRC" -d extracted && cd extracted
sed -i '' 's/package="io.agora.rtc"/package="io.agora.rtc.iris"/' AndroidManifest.xml
zip -qr -X ../iris-rtc-patched.aar .
cp ../iris-rtc-patched.aar /path/to/mobile_flutter/android/app/libs/iris-rtc-patched.aar
```

If `agora_rtc_engine` bumps to a version pinning a different `iris-rtc`/
`agora-special-full` pair, redo this against the new version and update the
`exclude`/version comment in `app/build.gradle.kts` to match.
