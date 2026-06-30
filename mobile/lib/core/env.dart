/// Compile-time environment configuration.
///
/// Pass at build/run time with `--dart-define`, e.g.:
///   flutter run --dart-define=API_BASE_URL=https://uniscope-api.onrender.com
///
/// IMPORTANT (verified against backend `main.ts` on this branch):
///  - The backend mounts **NO** global prefix (no `/api/v1`).
///  - It listens on `PORT ?? 3001` locally — so the local default is :3001.
///  - There is no global ValidationPipe yet, so the client MUST validate input
///    (phone/code) before sending; the server won't return 400 on malformed bodies.
class Env {
  Env._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3001',
  );

  /// Network timeout in milliseconds (mirrors the RN axios 10s timeout).
  static const int httpTimeoutMs = 10000;
}
