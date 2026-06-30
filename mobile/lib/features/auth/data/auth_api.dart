import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/dio_client.dart';
import 'auth_models.dart';

/// Talks to the `/auth/*` endpoints. Contract verified against
/// `backend/src/auth` on branch `feature/cloud-infra-migration`.
class AuthApi {
  AuthApi(this._dio);

  final Dio _dio;

  /// `POST /auth/otp/request` — body `{ phone }` (E.164 IN, e.g. `+9198…`).
  Future<OtpRequestResponse> requestOtp(String phone) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.otpRequest,
        data: {'phone': phone},
      );
      return OtpRequestResponse.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// `POST /auth/otp/verify` — body `{ phone, code, serviceId }`.
  Future<VerifyOtpResponse> verifyOtp({
    required String phone,
    required String code,
    required String serviceId,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.otpVerify,
        data: {'phone': phone, 'code': code, 'serviceId': serviceId},
      );
      return VerifyOtpResponse.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// `POST /auth/logout` — Bearer required, returns 204. Best-effort.
  Future<void> logout() async {
    try {
      await _dio.post<void>(ApiEndpoints.logout);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final authApiProvider = Provider<AuthApi>((ref) => AuthApi(ref.read(dioProvider)));
