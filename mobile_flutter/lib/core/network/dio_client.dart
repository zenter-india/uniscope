import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/auth_controller.dart';

/// Base URL — override at build time with:
///   flutter run --dart-define=API_URL=http://localhost:3001
/// Default targets the local NestJS backend (see backend/src/main.ts: port 3001,
/// no global prefix). Note: Android emulators must use 10.0.2.2 instead of
/// localhost, and physical devices need the host machine's LAN IP.
const String kApiBaseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://localhost:3001/api/v1',
);

/// Dio instance with the same behaviour as the RN axios `apiClient`:
///  - attaches the access token to every request
///  - performs a silent token refresh on 401 and retries once
///
/// Root cause of the old "logs out after ~10-15 min" bug: the backend's
/// refresh token is single-use / rotating (see backend TokenService —
/// every successful `/auth/token/refresh` call issues a brand-new refresh
/// token and invalidates the old one). The access token's 15-minute TTL
/// means that after any idle stretch past that, *resuming* activity tends
/// to fire several requests at once (multiple Riverpod providers refetching
/// on app resume). Every one of those requests independently 401s and used
/// to independently call `/auth/token/refresh` with the same stale refresh
/// token — only the first call could ever succeed; every sibling got a
/// real 401 ("token reuse detected") back from the backend, which the old
/// code treated as a dead session and logged the user out, even though the
/// first call had just refreshed it successfully microseconds earlier.
/// This was never actually about a 10-minute timer — no such timer exists
/// anywhere in the app.
///
/// Fixed two ways:
///  1. Single-flight refresh — concurrent 401s share one in-flight
///     `/auth/token/refresh` call (and its resulting tokens) instead of
///     each racing the backend's rotation with a stale token.
///  2. Logout only fires on a *confirmed* auth failure (the refresh
///     endpoint itself returning 401/403, or no refresh token to send at
///     all) — a network-level failure while refreshing (timeout, no
///     connectivity, a 5xx) leaves the session untouched; the next
///     successful request just refreshes normally.
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: kApiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json'},
    ),
  );

  // A separate client for the refresh call so it never triggers the
  // interceptor recursively.
  final tokenDio = Dio(BaseOptions(baseUrl: kApiBaseUrl));

  // Shared by every concurrent 401 while a refresh is in flight — see the
  // single-flight note above. Cleared once the call settles (success or
  // failure) so the next 401 after that starts a fresh attempt.
  Future<(String accessToken, String refreshToken)>? refreshInFlight;

  Future<(String, String)> refreshTokens(String refreshToken) {
    return refreshInFlight ??= Future(() async {
      final refreshRes = await tokenDio.post<Map<String, dynamic>>(
        '/auth/token/refresh',
        data: {'refreshToken': refreshToken},
      );
      final data = refreshRes.data!;
      return (data['accessToken'] as String, data['refreshToken'] as String);
    }).whenComplete(() => refreshInFlight = null);
  }

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = ref.read(authControllerProvider).accessToken;
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final response = error.response;
        final request = error.requestOptions;
        final alreadyRetried = request.extra['_retry'] == true;

        if (response?.statusCode != 401 || alreadyRetried) {
          return handler.next(error);
        }

        final auth = ref.read(authControllerProvider);
        final authNotifier = ref.read(authControllerProvider.notifier);
        final refreshToken = auth.refreshToken;

        if (refreshToken == null || refreshToken.isEmpty) {
          // Nothing to refresh with — this is a genuinely logged-out state.
          authNotifier.logout();
          return handler.next(error);
        }

        try {
          final (newAccess, newRefresh) = await refreshTokens(refreshToken);
          authNotifier.setTokens(newAccess, newRefresh);

          // Retry the original request with the new token.
          request.extra['_retry'] = true;
          request.headers['Authorization'] = 'Bearer $newAccess';
          final retryRes = await dio.fetch<dynamic>(request);
          return handler.resolve(retryRes);
        } on DioException catch (refreshError) {
          // Only a confirmed auth failure from the refresh endpoint itself
          // means the session is actually dead (expired/revoked/reused
          // refresh token). A network-level failure (timeout, no
          // connectivity, a 5xx) must never log the user out — it just
          // means this particular retry didn't happen this time.
          final refreshStatus = refreshError.response?.statusCode;
          if (refreshStatus == 401 || refreshStatus == 403) {
            authNotifier.logout();
          }
          return handler.next(error);
        }
      },
    ),
  );

  return dio;
});
