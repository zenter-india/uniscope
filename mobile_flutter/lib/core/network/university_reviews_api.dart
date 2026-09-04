import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

/// One submitted university review — the client-confirmed 12-question shape.
/// Q1–Q4 are 1–5 slider ratings, Q5–Q11 are choice codes (see
/// `review_choices.dart` for code → label), Q12 is [overallRating].
/// Anonymised server-side: only [authorRole] is ever attached, never a name.
class UniversityReview {
  const UniversityReview({
    required this.id,
    required this.universityId,
    required this.overallRating,
    this.academicExposure,
    this.campusCulture,
    this.workload,
    this.futureValue,
    this.raggingCulture,
    this.facultyApproachability,
    this.stipendStatus,
    this.hostelAvailability,
    this.hostelSafety,
    this.wouldRecommend,
    this.valueForMoney,
    this.tags = const [],
    this.body,
    required this.helpfulCount,
    required this.createdAt,
    required this.authorRole,
  });

  final String id;
  final String universityId;
  final int overallRating; // Q12

  // Q1–Q4 sliders (server column names: clinicalExposure/campusLife/workload/placements)
  final int? academicExposure;
  final int? campusCulture;
  final int? workload;
  final int? futureValue;

  // Q5–Q11 choice codes
  final String? raggingCulture;
  final String? facultyApproachability;
  final String? stipendStatus;
  final String? hostelAvailability;
  final String? hostelSafety;
  final String? wouldRecommend;
  final String? valueForMoney;

  final List<String> tags;
  final String? body; // "In your own words"
  final int helpfulCount;
  final String createdAt;
  final String authorRole;

  bool get authorIsMentor => authorRole == 'MENTOR';

  factory UniversityReview.fromJson(Map<String, dynamic> json) =>
      UniversityReview(
        id: json['id'] as String,
        universityId: json['universityId'] as String,
        overallRating: (json['overallRating'] as num).toInt(),
        academicExposure: (json['clinicalExposureRating'] as num?)?.toInt(),
        campusCulture: (json['campusLifeRating'] as num?)?.toInt(),
        workload: (json['workloadRating'] as num?)?.toInt(),
        futureValue: (json['placementsRating'] as num?)?.toInt(),
        raggingCulture: json['raggingCulture'] as String?,
        facultyApproachability: json['facultyApproachability'] as String?,
        stipendStatus: json['stipendStatus'] as String?,
        hostelAvailability: json['hostelAvailability'] as String?,
        hostelSafety: json['hostelSafety'] as String?,
        wouldRecommend: json['wouldRecommend'] as String?,
        valueForMoney: json['valueForMoney'] as String?,
        tags: (json['tags'] as List<dynamic>? ?? [])
            .map((e) => e as String)
            .toList(),
        body: json['body'] as String?,
        helpfulCount: (json['helpfulCount'] as num).toInt(),
        createdAt: json['createdAt'] as String,
        authorRole: json['authorRole'] as String,
      );
}

/// Everything the 12-question form collects, ready to POST/PATCH. Every
/// field is non-null by the time Submit is enabled; [tags] and [body] are
/// the only optional parts.
class UniversityReviewDraft {
  const UniversityReviewDraft({
    required this.overallRating,
    required this.academicExposure,
    required this.campusCulture,
    required this.workload,
    required this.futureValue,
    required this.raggingCulture,
    required this.facultyApproachability,
    required this.stipendStatus,
    required this.hostelAvailability,
    required this.hostelSafety,
    required this.wouldRecommend,
    required this.valueForMoney,
    this.tags = const [],
    this.body,
  });

  final int overallRating;
  final int academicExposure;
  final int campusCulture;
  final int workload;
  final int futureValue;
  final String raggingCulture;
  final String facultyApproachability;
  final String stipendStatus;
  final String hostelAvailability;
  final String hostelSafety;
  final String wouldRecommend;
  final String valueForMoney;
  final List<String> tags;
  final String? body;

  Map<String, dynamic> toJson() => {
        'overallRating': overallRating,
        'clinicalExposureRating': academicExposure,
        'campusLifeRating': campusCulture,
        'workloadRating': workload,
        'placementsRating': futureValue,
        'raggingCulture': raggingCulture,
        'facultyApproachability': facultyApproachability,
        'stipendStatus': stipendStatus,
        'hostelAvailability': hostelAvailability,
        'hostelSafety': hostelSafety,
        'wouldRecommend': wouldRecommend,
        'valueForMoney': valueForMoney,
        if (tags.isNotEmpty) 'tags': tags,
        if (body != null && body!.trim().isNotEmpty) 'body': body!.trim(),
      };

  /// Prefill draft from an existing review (edit flow). Falls back to
  /// sensible mids only if a legacy row is somehow missing an answer.
  factory UniversityReviewDraft.fromReview(UniversityReview r) =>
      UniversityReviewDraft(
        overallRating: r.overallRating,
        academicExposure: r.academicExposure ?? 3,
        campusCulture: r.campusCulture ?? 3,
        workload: r.workload ?? 3,
        futureValue: r.futureValue ?? 3,
        raggingCulture: r.raggingCulture ?? 'MINOR_ISSUES',
        facultyApproachability: r.facultyApproachability ?? 'SCHEDULED_HOURS',
        stipendStatus: r.stipendStatus ?? 'NONE',
        hostelAvailability: r.hostelAvailability ?? 'AVERAGE',
        hostelSafety: r.hostelSafety ?? 'DECENT',
        wouldRecommend: r.wouldRecommend ?? 'RIGHT_PERSON',
        valueForMoney: r.valueForMoney ?? 'COULD_BE_BETTER',
        tags: r.tags,
        body: r.body,
      );
}

/// Real aggregates only — category averages and recommendPercent are null
/// (not 0) when nobody has answered that question yet; [tagCounts] and each
/// map in [choiceDistributions] only contain values actually chosen.
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
    required this.choiceDistributions,
  });

  final double? overallAverage;
  final int reviewCount;
  final int? recommendPercent;
  final double? academics;
  final double? campusLife;
  final double? workload;
  final double? careerValue;
  final Map<String, int> tagCounts;

  /// field name (e.g. `raggingCulture`) → { choice code → count }.
  final Map<String, Map<String, int>> choiceDistributions;

  factory UniversityReviewSummary.fromJson(Map<String, dynamic> json) {
    final categories = json['categoryAverages'] as Map<String, dynamic>? ?? {};
    final tagCountsJson = json['tagCounts'] as Map<String, dynamic>? ?? {};
    final distsJson =
        json['choiceDistributions'] as Map<String, dynamic>? ?? {};
    return UniversityReviewSummary(
      overallAverage: (json['overallAverage'] as num?)?.toDouble(),
      reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
      recommendPercent: (json['recommendPercent'] as num?)?.toInt(),
      academics: (categories['academics'] as num?)?.toDouble(),
      campusLife: (categories['campusLife'] as num?)?.toDouble(),
      workload: (categories['workload'] as num?)?.toDouble(),
      careerValue: (categories['careerValue'] as num?)?.toDouble(),
      tagCounts: tagCountsJson.map((k, v) => MapEntry(k, (v as num).toInt())),
      choiceDistributions: distsJson.map(
        (field, m) => MapEntry(
          field,
          (m as Map<String, dynamic>).map(
            (code, c) => MapEntry(code, (c as num).toInt()),
          ),
        ),
      ),
    );
  }
}

class UniversityReviewsApi {
  UniversityReviewsApi(this._dio);

  final Dio _dio;

  Future<List<UniversityReview>> listForUniversity(String universityId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/universities/$universityId/reviews',
    );
    final data = res.data!['data'] as List<dynamic>;
    return data
        .map((e) => UniversityReview.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<bool> hasReviewed(String universityId) async {
    final res = await _dio.get<bool>(
      '/universities/$universityId/reviews/mine',
    );
    return res.data ?? false;
  }

  /// Full content of the caller's own review, or null if none — backs the
  /// edit form's prefill.
  Future<UniversityReview?> findMine(String universityId) async {
    final res = await _dio.get<Map<String, dynamic>?>(
      '/universities/$universityId/reviews/mine/detail',
    );
    return res.data == null ? null : UniversityReview.fromJson(res.data!);
  }

  Future<UniversityReviewSummary> summary(String universityId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/universities/$universityId/reviews/summary',
    );
    return UniversityReviewSummary.fromJson(res.data!);
  }

  Future<UniversityReview> create(
    String universityId,
    UniversityReviewDraft draft,
  ) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/universities/$universityId/reviews',
      data: draft.toJson(),
    );
    return UniversityReview.fromJson(res.data!);
  }

  /// Edits the caller's own existing review — 404s if there isn't one yet.
  Future<UniversityReview> update(
    String universityId,
    UniversityReviewDraft draft,
  ) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      '/universities/$universityId/reviews',
      data: draft.toJson(),
    );
    return UniversityReview.fromJson(res.data!);
  }
}

final universityReviewsApiProvider = Provider<UniversityReviewsApi>(
  (ref) => UniversityReviewsApi(ref.watch(dioProvider)),
);

final universityReviewsListProvider = FutureProvider.autoDispose
    .family<List<UniversityReview>, String>(
      (ref, universityId) => ref
          .watch(universityReviewsApiProvider)
          .listForUniversity(universityId),
    );

final hasReviewedUniversityProvider = FutureProvider.autoDispose
    .family<bool, String>(
      (ref, universityId) =>
          ref.watch(universityReviewsApiProvider).hasReviewed(universityId),
    );

final myUniversityReviewProvider = FutureProvider.autoDispose
    .family<UniversityReview?, String>(
      (ref, universityId) =>
          ref.watch(universityReviewsApiProvider).findMine(universityId),
    );

final universityReviewSummaryProvider = FutureProvider.autoDispose
    .family<UniversityReviewSummary, String>(
      (ref, universityId) =>
          ref.watch(universityReviewsApiProvider).summary(universityId),
    );
