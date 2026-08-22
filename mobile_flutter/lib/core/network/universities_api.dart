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
    this.city,
    this.stream,
    this.levels = const ['UG'],
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
  /// Nullable: the NMC seat matrix the medical colleges were seeded from
  /// has no city column, so bulk-loaded rows may have only a state.
  final String? city;
  /// Academic field (Medical/Engineering/Law/etc) — null for older rows
  /// seeded before the multi-stream pivot.
  final String? stream;
  /// Degree levels offered — "UG" and/or "PG". Every college in the app
  /// today is UG-only: the imported source (NMC's MBBS seat matrix) only
  /// covers undergraduate intake, no PG data has been imported yet.
  final List<String> levels;
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
        city: json['city'] as String?,
        stream: json['stream'] as String?,
        levels: (json['levels'] as List<dynamic>?)?.map((e) => e as String).toList() ??
            const ['UG'],
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

  /// Discover applies Type/Stream/State/search filters client-side over
  /// whatever this returns (see UniversityListScreen), so a single
  /// server-paginated page (default 20, max 50 — see ListUniversitiesDto)
  /// would silently filter against a random slice of the catalogue instead
  /// of the whole thing. Follows `nextCursor` until exhausted. ~830 medical
  /// colleges is ~17 requests, acceptable for a screen loaded once and
  /// cached by the autoDispose provider; the 40-page cap is a runaway guard,
  /// not an expected ceiling.
  Future<List<University>> list({String? search, String? stream}) async {
    final results = <University>[];
    String? cursor;
    for (var page = 0; page < 40; page++) {
      final res = await _dio.get<Map<String, dynamic>>(
        '/universities',
        queryParameters: {
          if (search != null && search.isNotEmpty) 'search': search,
          if (stream != null) 'stream': stream,
          'limit': 50,
          if (cursor != null) 'cursor': cursor,
        },
      );
      final data = res.data!['data'] as List<dynamic>;
      results.addAll(data.map((e) => University.fromJson(e as Map<String, dynamic>)));
      cursor = res.data!['nextCursor'] as String?;
      if (cursor == null) break;
    }
    return results;
  }

  /// Single-page, top-8 typeahead search — unlike [list], this does NOT
  /// paginate through the whole catalogue, since it backs a live-typing
  /// search box (CollegeSearchField) that fires on every keystroke. Same
  /// endpoint/shape as the web enrollment form's searchUniversities.
  Future<List<University>> search(String query) async {
    if (query.trim().length < 2) return const [];
    final res = await _dio.get<Map<String, dynamic>>(
      '/universities',
      queryParameters: {'search': query, 'limit': 8},
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
