import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

class MentorUniversity {
  const MentorUniversity({required this.id, required this.name, required this.slug});

  final String id;
  final String name;
  final String slug;

  factory MentorUniversity.fromJson(Map<String, dynamic> json) => MentorUniversity(
        id: json['id'] as String,
        name: json['name'] as String,
        slug: json['slug'] as String,
      );
}

class Mentor {
  const Mentor({
    required this.id,
    required this.displayName,
    required this.role,
    required this.specialty,
    required this.bio,
    required this.languages,
    required this.pricePerMinuteMinor,
    required this.university,
    this.rating,
    this.reviewCount = 0,
  });

  final String id;
  final String displayName;
  final String role;
  final String? specialty;
  final String? bio;
  final List<String> languages;
  final int pricePerMinuteMinor;
  final MentorUniversity? university;
  final double? rating;
  final int reviewCount;

  double get pricePerMinuteRupees => pricePerMinuteMinor / 100;

  factory Mentor.fromJson(Map<String, dynamic> json) => Mentor(
        id: json['id'] as String,
        displayName: json['displayName'] as String,
        role: json['role'] as String,
        specialty: json['specialty'] as String?,
        bio: json['bio'] as String?,
        languages: (json['languages'] as List<dynamic>? ?? [])
            .map((e) => e as String)
            .toList(),
        pricePerMinuteMinor: (json['pricePerMinuteMinor'] as num).toInt(),
        university: json['university'] != null
            ? MentorUniversity.fromJson(json['university'] as Map<String, dynamic>)
            : null,
        rating: (json['rating'] as num?)?.toDouble(),
        reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
      );
}

class MentorsApi {
  MentorsApi(this._dio);

  final Dio _dio;

  Future<List<Mentor>> list({String? universityId}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/mentors',
      queryParameters: {if (universityId != null) 'universityId': universityId},
    );
    final data = res.data!['data'] as List<dynamic>;
    return data.map((e) => Mentor.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Mentor> getById(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/mentors/$id');
    return Mentor.fromJson(res.data!);
  }
}

final mentorsApiProvider = Provider<MentorsApi>(
  (ref) => MentorsApi(ref.watch(dioProvider)),
);
