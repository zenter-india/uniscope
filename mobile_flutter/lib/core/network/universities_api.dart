import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

class UniversityProgram {
  const UniversityProgram({required this.id, required this.name});

  final String id;
  final String name;

  factory UniversityProgram.fromJson(Map<String, dynamic> json) => UniversityProgram(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

class University {
  const University({
    required this.id,
    required this.name,
    required this.slug,
    required this.type,
    required this.state,
    required this.city,
    this.stream,
    required this.nirfRank,
    required this.mbbsSeats,
    required this.establishedYear,
    required this.website,
    required this.description,
    this.imageUrl,
    this.programs,
    this.rating,
    this.reviewCount = 0,
  });

  final String id;
  final String name;
  final String slug;
  final String type;
  final String state;
  final String city;
  /// Academic field (Medical/Engineering/Law/etc) — null for older rows
  /// seeded before the multi-stream pivot.
  final String? stream;
  final int? nirfRank;
  final int? mbbsSeats;
  final int? establishedYear;
  final String? website;
  final String? description;
  final String? imageUrl;
  final List<UniversityProgram>? programs;
  final double? rating;
  final int reviewCount;

  factory University.fromJson(Map<String, dynamic> json) => University(
        id: json['id'] as String,
        name: json['name'] as String,
        slug: json['slug'] as String,
        type: json['type'] as String,
        state: json['state'] as String,
        city: json['city'] as String,
        stream: json['stream'] as String?,
        nirfRank: (json['nirfRank'] as num?)?.toInt(),
        mbbsSeats: (json['mbbsSeats'] as num?)?.toInt(),
        establishedYear: (json['establishedYear'] as num?)?.toInt(),
        website: json['website'] as String?,
        description: json['description'] as String?,
        imageUrl: json['imageUrl'] as String?,
        programs: (json['programs'] as List<dynamic>?)
            ?.map((e) => UniversityProgram.fromJson(e as Map<String, dynamic>))
            .toList(),
        rating: (json['rating'] as num?)?.toDouble(),
        reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
      );
}

class UniversitiesApi {
  UniversitiesApi(this._dio);

  final Dio _dio;

  Future<List<University>> list({String? search, String? stream}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/universities',
      queryParameters: {
        if (search != null && search.isNotEmpty) 'search': search,
        if (stream != null) 'stream': stream,
      },
    );
    final data = res.data!['data'] as List<dynamic>;
    return data.map((e) => University.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<University> getBySlug(String slug) async {
    final res = await _dio.get<Map<String, dynamic>>('/universities/$slug');
    return University.fromJson(res.data!);
  }

  /// Matches an existing university by name+state (case-insensitive) or
  /// creates a new one — used by the mentor onboarding wizard's College
  /// field for non-Medical streams, where the curated dropdown doesn't
  /// reliably cover every institution. See backend
  /// UniversitiesService.findOrCreateByName for why a real row (rather than
  /// free text) is required — mentor identity verification needs one.
  Future<University> findOrCreate({
    required String name,
    required String state,
    required String city,
    String? stream,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/universities/find-or-create',
      data: {
        'name': name,
        'state': state,
        'city': city,
        if (stream != null) 'stream': stream,
      },
    );
    return University.fromJson(res.data!);
  }
}

final universitiesApiProvider = Provider<UniversitiesApi>(
  (ref) => UniversitiesApi(ref.watch(dioProvider)),
);

final universitiesListProvider = FutureProvider.autoDispose<List<University>>(
  (ref) => ref.watch(universitiesApiProvider).list(),
);
