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
  defaultValue: 'http://localhost:3001',
);

/// Dio instance with the same behaviour as the RN axios `apiClient`:
///  - attaches the access token to every request
///  - performs a silent token refresh on 401 and retries once
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
          authNotifier.logout();
          return handler.next(error);
        }

        try {
          final refreshRes = await tokenDio.post<Map<String, dynamic>>(
            '/auth/token/refresh',
            data: {'refreshToken': refreshToken},
          );
          final data = refreshRes.data!;
          final newAccess = data['accessToken'] as String;
          final newRefresh = data['refreshToken'] as String;
          authNotifier.setTokens(newAccess, newRefresh);

          // Retry the original request with the new token.
          request.extra['_retry'] = true;
          request.headers['Authorization'] = 'Bearer $newAccess';
          final retryRes = await dio.fetch<dynamic>(request);
          return handler.resolve(retryRes);
        } catch (_) {
          authNotifier.logout();
          return handler.next(error);
        }
      },
    ),
  );

  return dio;
});
