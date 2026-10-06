import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

/// `POST /reviews` 409s a second attempt for the same session (unique
/// `sessionId` on `MentorReview`) — most likely a duplicate submit (a fast
/// double-tap, or a retry after a slow/lost response whose first attempt
/// actually landed), not a genuinely new failure. The caller's review IS
/// posted either way, so this is treated as success upstream, same as the
/// equivalent `AlreadyReviewedException` for college reviews.
class AlreadyReviewedException implements Exception {
  const AlreadyReviewedException();
}

/// `POST /reviews` 403s with "You can only review a completed session" when
/// the backend's own record of the session's status hasn't (yet) caught up
/// with what the call screen locally knows happened — e.g. the call just
/// ended and the terminal status is still settling. Distinguished from the
/// generic rethrow so the caller can show a clear "try again in a moment"
/// message instead of the raw backend sentence, which reads like a genuine
/// rejection rather than a timing race.
class ReviewSessionNotCompletedException implements Exception {
  const ReviewSessionNotCompletedException();
}

class MentorReview {
  const MentorReview({
    required this.id,
    required this.sessionId,
    required this.mentorId,
    required this.rating,
    required this.comment,
    required this.createdAt,
  });

  final String id;
  final String sessionId;
  final String mentorId;
  final int rating;
  final String? comment;
  final String createdAt;

  factory MentorReview.fromJson(Map<String, dynamic> json) => MentorReview(
        id: json['id'] as String,
        sessionId: json['sessionId'] as String,
        mentorId: json['mentorId'] as String,
        rating: (json['rating'] as num).toInt(),
        comment: json['comment'] as String?,
        createdAt: json['createdAt'] as String,
      );
}

class ReviewsApi {
  ReviewsApi(this._dio);

  final Dio _dio;

  /// On failure, rethrows with the backend's own message where possible
  /// (same pattern as `UniversityReviewsApi.create`) — a bare
  /// `DioException.toString()` previously surfaced as a raw, unfriendly
  /// dump on the call-ended screen's "Rate this call" sheet (real device
  /// report, 2026-10-06).
  Future<MentorReview> create({
    required String sessionId,
    required int rating,
    String? comment,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/reviews',
        data: {
          'sessionId': sessionId,
          'rating': rating,
          if (comment != null && comment.isNotEmpty) 'comment': comment,
        },
      );
      return MentorReview.fromJson(res.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) {
        throw const AlreadyReviewedException();
      }
      final data = e.response?.data;
      String? msg;
      if (data is Map) {
        final m = data['message'];
        if (m is String) {
          msg = m;
        } else if (m is List && m.isNotEmpty) {
          msg = m.join('\n');
        }
      }
      if (e.response?.statusCode == 403 &&
          msg == 'You can only review a completed session') {
        throw const ReviewSessionNotCompletedException();
      }
      if (msg != null && msg.isNotEmpty) throw Exception(msg);
      rethrow;
    }
  }

  Future<List<MentorReview>> listForMentor(String mentorId) async {
    final res = await _dio.get<Map<String, dynamic>>('/reviews/mentor/$mentorId');
    final data = res.data!['data'] as List<dynamic>;
    return data.map((e) => MentorReview.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<bool> hasReviewed(String sessionId) async {
    final res = await _dio.get<Map<String, dynamic>>('/reviews/session/$sessionId/mine');
    return res.data!['reviewed'] as bool;
  }
}

final reviewsApiProvider = Provider<ReviewsApi>(
  (ref) => ReviewsApi(ref.watch(dioProvider)),
);
