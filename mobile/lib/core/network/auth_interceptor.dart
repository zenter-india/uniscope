import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/application/auth_controller.dart';
import '../providers.dart';
import '../storage/secure_token_storage.dart';
import 'api_endpoints.dart';

/// Attaches the Bearer token and performs a single-flight silent refresh on 401,
/// then replays the original request once — a faithful port of the RN axios
/// interceptor in `mobile/src/api/client.ts` (`isRefreshing` + `failedQueue`).
///
/// Extends [QueuedInterceptor] so concurrent requests are serialized while a
/// refresh is in flight (Dio's built-in analogue of the RN queue), preventing
/// parallel 401s from each triggering their own refresh.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor({
    required Ref ref,
    required Dio mainDio,
    required Dio refreshDio,
  })  : _ref = ref,
        _mainDio = mainDio,
        _refreshDio = refreshDio;

  final Ref _ref;
  final Dio _mainDio;
  final Dio _refreshDio;

  SecureTokenStorage get _storage => _ref.read(secureTokenStorageProvider);

  static const _retriedKey = 'retried';

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.readAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final response = err.response;
    final isRefreshCall = err.requestOptions.path == ApiEndpoints.tokenRefresh;
    final alreadyRetried = err.requestOptions.extra[_retriedKey] == true;

    if (response?.statusCode != 401 || alreadyRetried || isRefreshCall) {
      handler.next(err);
      return;
    }

    final refreshToken = await _storage.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      await _ref.read(authControllerProvider.notifier).signOut();
      handler.next(err);
      return;
    }

    try {
      final res = await _refreshDio.post<Map<String, dynamic>>(
        ApiEndpoints.tokenRefresh,
        data: {'refreshToken': refreshToken},
      );
      final data = res.data!;
      final newAccess = data['accessToken'] as String;
      final newRefresh = data['refreshToken'] as String;
      await _storage.saveTokens(
        accessToken: newAccess,
        refreshToken: newRefresh,
      );

      // Replay the original request once with the rotated token.
      final options = err.requestOptions
        ..headers['Authorization'] = 'Bearer $newAccess'
        ..extra[_retriedKey] = true;
      final replay = await _mainDio.fetch<dynamic>(options);
      handler.resolve(replay);
    } on DioException {
      // Refresh failed (invalid/expired/rotated) → clear session, bounce to auth.
      await _ref.read(authControllerProvider.notifier).signOut();
      handler.next(err);
    }
  }
}
