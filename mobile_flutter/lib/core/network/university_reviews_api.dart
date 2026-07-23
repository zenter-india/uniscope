import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

class UniversityReview {
  const UniversityReview({
    required this.id,
    required this.universityId,
    required this.overallRating,
    this.facultyRating,
    this.infrastructureRating,
    this.clinicalExposureRating,
    this.campusLifeRating,
    this.placementsRating,
    this.pros,
    this.cons,
    this.body,
    required this.helpfulCount,
    required this.createdAt,
    required this.authorDisplayName,
  });

  final String id;
  final String universityId;
  final int overallRating;
  final int? facultyRating;
  final int? infrastructureRating;
  final int? clinicalExposureRating;
  final int? campusLifeRating;
  final int? placementsRating;
  final String? pros;
  final String? cons;
  final String? body;
  final int helpfulCount;
  final String createdAt;
  final String authorDisplayName;

  factory UniversityReview.fromJson(Map<String, dynamic> json) => UniversityReview(
        id: json['id'] as String,
        universityId: json['universityId'] as String,
        overallRating: (json['overallRating'] as num).toInt(),
        facultyRating: (json['facultyRating'] as num?)?.toInt(),
        infrastructureRating: (json['infrastructureRating'] as num?)?.toInt(),
        clinicalExposureRating: (json['clinicalExposureRating'] as num?)?.toInt(),
        campusLifeRating: (json['campusLifeRating'] as num?)?.toInt(),
        placementsRating: (json['placementsRating'] as num?)?.toInt(),
        pros: json['pros'] as String?,
        cons: json['cons'] as String?,
        body: json['body'] as String?,
        helpfulCount: (json['helpfulCount'] as num).toInt(),
        createdAt: json['createdAt'] as String,
        authorDisplayName: json['authorDisplayName'] as String,
      );
}

class UniversityReviewsApi {
  UniversityReviewsApi(this._dio);

  final Dio _dio;

  Future<List<UniversityReview>> listForUniversity(String universityId) async {
    final res = await _dio.get<Map<String, dynamic>>('/universities/$universityId/reviews');
    final data = res.data!['data'] as List<dynamic>;
    return data.map((e) => UniversityReview.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<bool> hasReviewed(String universityId) async {
    final res = await _dio.get<bool>('/universities/$universityId/reviews/mine');
    return res.data ?? false;
  }

  Future<UniversityReview> create(
    String universityId, {
    required int overallRating,
    int? facultyRating,
    int? infrastructureRating,
    int? clinicalExposureRating,
    int? campusLifeRating,
    int? placementsRating,
    String? pros,
    String? cons,
    String? body,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/universities/$universityId/reviews',
      data: {
        'overallRating': overallRating,
        if (facultyRating != null) 'facultyRating': facultyRating,
        if (infrastructureRating != null) 'infrastructureRating': infrastructureRating,
        if (clinicalExposureRating != null) 'clinicalExposureRating': clinicalExposureRating,
        if (campusLifeRating != null) 'campusLifeRating': campusLifeRating,
        if (placementsRating != null) 'placementsRating': placementsRating,
        if (pros != null && pros.isNotEmpty) 'pros': pros,
        if (cons != null && cons.isNotEmpty) 'cons': cons,
        if (body != null && body.isNotEmpty) 'body': body,
      },
    );
    return UniversityReview.fromJson(res.data!);
  }
}

final universityReviewsApiProvider = Provider<UniversityReviewsApi>(
  (ref) => UniversityReviewsApi(ref.watch(dioProvider)),
);

final universityReviewsListProvider =
    FutureProvider.autoDispose.family<List<UniversityReview>, String>(
  (ref, universityId) => ref.watch(universityReviewsApiProvider).listForUniversity(universityId),
);

final hasReviewedUniversityProvider =
    FutureProvider.autoDispose.family<bool, String>(
  (ref, universityId) => ref.watch(universityReviewsApiProvider).hasReviewed(universityId),
);
