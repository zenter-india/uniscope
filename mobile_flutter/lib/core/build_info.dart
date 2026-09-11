/// Compile-time build identifier, baked in via `--dart-define` at build time
/// (see the `flutter build` invocation in the repo's release process).
///
/// Exists so "is this device actually running today's build?" is never a
/// guessing game again — a plain `git rev-parse --short HEAD` survives an
/// app-store/TestFlight/APK-sideload round trip in a way a mentally-tracked
/// "I think I built that yesterday" doesn't. Shown in Settings.
///
/// Falls back to `'dev'` for any build that didn't pass `GIT_SHA` (e.g. a
/// plain `flutter run` during local development) — an unmistakably-not-a-
/// real-release value rather than a blank field.
const String kGitSha = String.fromEnvironment('GIT_SHA', defaultValue: 'dev');

/// Compile-time build timestamp (UTC, `YYYY-MM-DD HH:MM`), also passed via
/// `--dart-define=BUILD_TIME=...`. Optional context alongside the commit —
/// two builds of the same commit (e.g. a re-signed export) still get a
/// distinct timestamp.
const String kBuildTime =
    String.fromEnvironment('BUILD_TIME', defaultValue: 'unknown');
