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

  Future<String> requestOtp(String phone) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/otp/request',
      data: {'phone': phone},
    );
    return res.data!['requestId'] as String;
  }

  Future<VerifyOtpResult> verifyOtp(String requestId, String otp) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/otp/verify',
      data: {'requestId': requestId, 'otp': otp},
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
}

final authApiProvider = Provider<AuthApi>(
  (ref) => AuthApi(ref.watch(dioProvider)),
);
