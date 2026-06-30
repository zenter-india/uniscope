import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../../auth/domain/auth_user.dart';

/// Talks to the `/users/*` endpoints (all behind `JwtAuthGuard`).
/// Verified against `backend/src/modules/users`.
class UsersApi {
  UsersApi(this._dio);

  final Dio _dio;

  /// `GET /users/me`.
  Future<AuthUser> getMe() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(ApiEndpoints.me);
      return AuthUser.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// `PATCH /users/me` — body `{ displayName?, bio? }`.
  Future<AuthUser> updateProfile({String? displayName, String? bio}) async {
    try {
      final res = await _dio.patch<Map<String, dynamic>>(
        ApiEndpoints.me,
        data: {
          if (displayName != null) 'displayName': displayName,
          if (bio != null) 'bio': bio,
        },
      );
      return AuthUser.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// `PATCH /users/me/role` — body `{ role }` (separate endpoint from profile).
  Future<AuthUser> updateRole(UserRole role) async {
    try {
      final res = await _dio.patch<Map<String, dynamic>>(
        ApiEndpoints.meRole,
        data: {'role': role.wire},
      );
      return AuthUser.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// `POST /users/me/push-token` — body `{ token, platform }`, returns 204.
  Future<void> storePushToken({
    required String token,
    required String platform,
  }) async {
    try {
      await _dio.post<void>(
        ApiEndpoints.mePushToken,
        data: {'token': token, 'platform': platform},
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final usersApiProvider =
    Provider<UsersApi>((ref) => UsersApi(ref.read(dioProvider)));
