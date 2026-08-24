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
    this.workloadRating,
    this.wouldRecommend,
    this.tags = const [],
    this.pros,
    this.cons,
    this.body,
    required this.helpfulCount,
    required this.createdAt,
    required this.authorRole,
  });

  final String id;
  final String universityId;
  final int overallRating;
  final int? facultyRating;
  final int? infrastructureRating;
  final int? clinicalExposureRating;
  final int? campusLifeRating;
  final int? placementsRating;
  final int? workloadRating;
  final bool? wouldRecommend;
  final List<String> tags;
  final String? pros;
  final String? cons;
  final String? body;
  final int helpfulCount;
  final String createdAt;
  final String authorRole;

  bool get authorIsMentor => authorRole == 'MENTOR';

  factory UniversityReview.fromJson(Map<String, dynamic> json) => UniversityReview(
        id: json['id'] as String,
        universityId: json['universityId'] as String,
        overallRating: (json['overallRating'] as num).toInt(),
        facultyRating: (json['facultyRating'] as num?)?.toInt(),
        infrastructureRating: (json['infrastructureRating'] as num?)?.toInt(),
        clinicalExposureRating: (json['clinicalExposureRating'] as num?)?.toInt(),
        campusLifeRating: (json['campusLifeRating'] as num?)?.toInt(),
        placementsRating: (json['placementsRating'] as num?)?.toInt(),
        workloadRating: (json['workloadRating'] as num?)?.toInt(),
        wouldRecommend: json['wouldRecommend'] as bool?,
        tags: (json['tags'] as List<dynamic>? ?? []).map((e) => e as String).toList(),
        pros: json['pros'] as String?,
        cons: json['cons'] as String?,
        body: json['body'] as String?,
        helpfulCount: (json['helpfulCount'] as num).toInt(),
        createdAt: json['createdAt'] as String,
        authorRole: json['authorRole'] as String,
      );
}

/// Real aggregates only — category averages and recommendPercent are null
/// (not 0) when nobody has answered that question yet; tagCounts only ever
/// contains tags that were actually picked at least once.
class UniversityReviewSummary {
  const UniversityReviewSummary({
    required this.overallAverage,
    required this.reviewCount,
    required this.recommendPercent,
    required this.academics,
    required this.campusLife,
    required this.workload,
    required this.careerValue,
    required this.tagCounts,
  });

  final double? overallAverage;
  final int reviewCount;
  final int? recommendPercent;
  final double? academics;
  final double? campusLife;
  final double? workload;
  final double? careerValue;
  final Map<String, int> tagCounts;

  factory UniversityReviewSummary.fromJson(Map<String, dynamic> json) {
    final categories = json['categoryAverages'] as Map<String, dynamic>? ?? {};
    final tagCountsJson = json['tagCounts'] as Map<String, dynamic>? ?? {};
    return UniversityReviewSummary(
      overallAverage: (json['overallAverage'] as num?)?.toDouble(),
      reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
      recommendPercent: (json['recommendPercent'] as num?)?.toInt(),
      academics: (categories['academics'] as num?)?.toDouble(),
      campusLife: (categories['campusLife'] as num?)?.toDouble(),
      workload: (categories['workload'] as num?)?.toDouble(),
      careerValue: (categories['careerValue'] as num?)?.toDouble(),
      tagCounts: tagCountsJson.map((k, v) => MapEntry(k, (v as num).toInt())),
    );
  }
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

  Future<UniversityReviewSummary> summary(String universityId) async {
    final res =
        await _dio.get<Map<String, dynamic>>('/universities/$universityId/reviews/summary');
    return UniversityReviewSummary.fromJson(res.data!);
  }

  Future<UniversityReview> create(
    String universityId, {
    required int overallRating,
    int? facultyRating,
    int? infrastructureRating,
    int? clinicalExposureRating,
    int? campusLifeRating,
    int? placementsRating,
    int? workloadRating,
    bool? wouldRecommend,
    List<String>? tags,
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
        if (workloadRating != null) 'workloadRating': workloadRating,
        if (wouldRecommend != null) 'wouldRecommend': wouldRecommend,
        if (tags != null && tags.isNotEmpty) 'tags': tags,
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

final universityReviewSummaryProvider =
    FutureProvider.autoDispose.family<UniversityReviewSummary, String>(
  (ref, universityId) => ref.watch(universityReviewsApiProvider).summary(universityId),
);
