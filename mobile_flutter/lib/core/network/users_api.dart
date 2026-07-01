import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/auth_controller.dart';
import 'dio_client.dart';

class UserProfile {
  const UserProfile({
    required this.id,
    required this.role,
    required this.displayName,
    required this.verificationStatus,
    required this.isActive,
    required this.createdAt,
  });

  final String id;
  final UserRole role;
  final String displayName;
  final String verificationStatus;
  final bool isActive;
  final String createdAt;

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
        id: json['id'] as String,
        role: UserRole.fromWire(json['role'] as String),
        displayName: (json['displayName'] as String?) ?? '',
        verificationStatus: (json['verificationStatus'] as String?) ?? '',
        isActive: (json['isActive'] as bool?) ?? true,
        createdAt: (json['createdAt'] as String?) ?? '',
      );

  AuthUser toAuthUser() =>
      AuthUser(id: id, role: role, displayName: displayName);
}

/// Port of RN `src/api/users.ts`.
class UsersApi {
  UsersApi(this._dio);

  final Dio _dio;

  Future<UserProfile> getMe() async {
    final res = await _dio.get<Map<String, dynamic>>('/users/me');
    return UserProfile.fromJson(res.data!);
  }

  Future<UserProfile> updateRole(UserRole role) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      '/users/me/role',
      data: {'role': role.wire},
    );
    return UserProfile.fromJson(res.data!);
  }

  Future<UserProfile> updateProfile({String? displayName, String? bio}) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      '/users/me',
      data: {
        if (displayName != null) 'displayName': displayName,
        if (bio != null) 'bio': bio,
      },
    );
    return UserProfile.fromJson(res.data!);
  }

  Future<void> storePushToken(String token, String platform) async {
    await _dio.post<void>(
      '/users/me/push-token',
      data: {'token': token, 'platform': platform},
    );
  }
}

final usersApiProvider = Provider<UsersApi>(
  (ref) => UsersApi(ref.watch(dioProvider)),
);
