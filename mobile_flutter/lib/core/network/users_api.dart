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
    this.bio,
    this.specialty,
    this.languages = const [],
    this.isMentorAvailable = false,
    this.universityName,
    this.gender,
    this.state,
    this.city,
    this.qualification,
    this.stream,
    this.goals = const [],
    this.dateOfBirth,
    this.courseInterested,
    this.preferredLanguage,
    this.preferredMentorshipTiming,
    this.availableDays = const [],
  });

  final String id;
  final UserRole role;
  final String displayName;
  final String verificationStatus;
  final bool isActive;
  final String createdAt;
  final String? bio;
  final String? specialty;
  final List<String> languages;
  final bool isMentorAvailable;
  final String? universityName;
  final String? gender;
  final String? state;
  final String? city;
  final String? qualification;
  final String? stream;
  final List<String> goals;
  final String? dateOfBirth;
  final String? courseInterested;
  final String? preferredLanguage;
  final String? preferredMentorshipTiming;
  final List<String> availableDays;

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
        id: json['id'] as String,
        role: UserRole.fromWire(json['role'] as String),
        displayName: (json['displayName'] as String?) ?? '',
        verificationStatus: (json['verificationStatus'] as String?) ?? '',
        isActive: (json['isActive'] as bool?) ?? true,
        createdAt: (json['createdAt'] as String?) ?? '',
        bio: json['bio'] as String?,
        specialty: json['specialty'] as String?,
        languages: (json['languages'] as List<dynamic>? ?? [])
            .map((e) => e as String)
            .toList(),
        isMentorAvailable: (json['isMentorAvailable'] as bool?) ?? false,
        universityName:
            (json['university'] as Map<String, dynamic>?)?['name'] as String?,
        gender: json['gender'] as String?,
        state: json['state'] as String?,
        city: json['city'] as String?,
        qualification: json['qualification'] as String?,
        stream: json['stream'] as String?,
        goals: (json['goals'] as List<dynamic>? ?? [])
            .map((e) => e as String)
            .toList(),
        dateOfBirth: json['dateOfBirth'] as String?,
        courseInterested: json['courseInterested'] as String?,
        preferredLanguage: json['preferredLanguage'] as String?,
        preferredMentorshipTiming: json['preferredMentorshipTiming'] as String?,
        availableDays: (json['availableDays'] as List<dynamic>? ?? [])
            .map((e) => e as String)
            .toList(),
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

  Future<UserProfile> updateProfile({
    String? displayName,
    String? bio,
    String? specialty,
    List<String>? languages,
    bool? isMentorAvailable,
    String? gender,
    String? state,
    String? city,
    String? qualification,
    String? stream,
    List<String>? goals,
    String? dateOfBirth,
    String? courseInterested,
    String? preferredLanguage,
    String? preferredMentorshipTiming,
    List<String>? availableDays,
  }) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      '/users/me',
      data: {
        if (displayName != null) 'displayName': displayName,
        if (bio != null) 'bio': bio,
        if (specialty != null) 'specialty': specialty,
        if (languages != null) 'languages': languages,
        if (isMentorAvailable != null) 'isMentorAvailable': isMentorAvailable,
        if (gender != null) 'gender': gender,
        if (state != null) 'state': state,
        if (city != null) 'city': city,
        if (qualification != null) 'qualification': qualification,
        if (stream != null) 'stream': stream,
        if (goals != null) 'goals': goals,
        if (dateOfBirth != null) 'dateOfBirth': dateOfBirth,
        if (courseInterested != null) 'courseInterested': courseInterested,
        if (preferredLanguage != null) 'preferredLanguage': preferredLanguage,
        if (preferredMentorshipTiming != null)
          'preferredMentorshipTiming': preferredMentorshipTiming,
        if (availableDays != null) 'availableDays': availableDays,
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

final myProfileProvider = FutureProvider.autoDispose<UserProfile>(
  (ref) => ref.watch(usersApiProvider).getMe(),
);
