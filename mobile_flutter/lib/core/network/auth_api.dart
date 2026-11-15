import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/auth_controller.dart';
import 'dio_client.dart';

class VerifyOtpResult {
  const VerifyOtpResult({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
    required this.isNewUser,
  });

  final String accessToken;
  final String refreshToken;
  final AuthUser user;
  final bool isNewUser;
}

/// Port of RN `src/api/auth.ts`.
class AuthApi {
  AuthApi(this._dio);

  final Dio _dio;

  /// Requests an OTP for [phone]; the backend returns a `serviceId` that must
  /// be echoed back on verify (see backend AuthController).
  Future<String> requestOtp(String phone) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/otp/request',
      data: {'phone': phone},
    );
    return res.data!['serviceId'] as String;
  }

  /// Verifies [code] for [phone] against the [serviceId] from [requestOtp].
  Future<VerifyOtpResult> verifyOtp(
    String serviceId,
    String phone,
    String code,
  ) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/otp/verify',
      data: {'serviceId': serviceId, 'phone': phone, 'code': code},
    );
    final data = res.data!;
    final user = data['user'] as Map<String, dynamic>;
    return VerifyOtpResult(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
      user: AuthUser.fromJson(user),
      isNewUser: (user['isNewUser'] as bool?) ?? false,
    );
  }

  Future<void> logout() async {
    await _dio.post<void>('/auth/logout');
  }

  /// Re-reads the JWT from the backend using [refreshToken] — needed after
  /// any server-side change to a claim baked into the token (currently just
  /// `role`), since the client's existing access token keeps its stale claim
  /// until this is called explicitly. A 401 auto-triggers this same endpoint
  /// via the dio interceptor, but a role change never 401s, so callers that
  /// mutate role must call this themselves before hitting a role-gated route.
  /// Response is just new tokens (no user payload) — see AuthService.refreshToken.
  Future<RefreshedTokens> refreshTokens(String refreshToken) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/token/refresh',
      data: {'refreshToken': refreshToken},
    );
    final data = res.data!;
    return RefreshedTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
  }
}

class RefreshedTokens {
  const RefreshedTokens({required this.accessToken, required this.refreshToken});
  final String accessToken;
  final String refreshToken;
}

final authApiProvider = Provider<AuthApi>(
  (ref) => AuthApi(ref.watch(dioProvider)),
);
