import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

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

  Future<MentorReview> create({
    required String sessionId,
    required int rating,
    String? comment,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/reviews',
      data: {
        'sessionId': sessionId,
        'rating': rating,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      },
    );
    return MentorReview.fromJson(res.data!);
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
