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
    this.stream,
    required this.bio,
    required this.languages,
    required this.pricePerMinuteMinor,
    required this.university,
    this.isAvailable = false,
    this.isVerified = false,
    this.availableDays = const [],
    this.rating,
    this.reviewCount = 0,
    this.yearOfStudy,
    this.studentsHelped,
    this.minutesMentored,
    this.avatarUrl,
  });

  final String id;
  final String displayName;
  final String role;
  final String? avatarUrl;
  final String? specialty;
  /// Mentor's college field of study (Medical/Engineering/Law/etc) — the
  /// primary discovery/filter attribute now that mentors span every stream,
  /// not just medical. `specialty` stays for older mentors who set it before
  /// the Areas-of-Guidance wizard step was removed.
  final String? stream;
  final String? bio;
  final List<String> languages;
  final int pricePerMinuteMinor;
  final MentorUniversity? university;
  /// Whether the mentor is currently accepting call bookings — their own
  /// stated intent, which the backend auto-expires after 24h. This is NOT
  /// real-time presence: never label it "online". Doesn't affect whether
  /// they're listed, and chat is always allowed regardless.
  final bool isAvailable;

  /// True only once an admin has approved this mentor's ID verification.
  /// This is what the "Verified" badge must gate on — an unverified mentor
  /// still appears in discovery and is still chat-reachable, just without
  /// the badge (see backend MentorResponse.isVerified doc comment).
  final bool isVerified;

  /// Days the mentor says they're generally free. Advisory only — booking is
  /// never blocked by it.
  final List<String> availableDays;
  final double? rating;
  final int reviewCount;
  final int? yearOfStudy;

  /// Track-record stats. Only present on the single-mentor detail
  /// response — null everywhere the list endpoint supplied the model.
  final int? studentsHelped;
  final int? minutesMentored;

  double get pricePerMinuteRupees => pricePerMinuteMinor / 100;

  factory Mentor.fromJson(Map<String, dynamic> json) => Mentor(
        id: json['id'] as String,
        displayName: json['displayName'] as String,
        role: json['role'] as String,
        specialty: json['specialty'] as String?,
        stream: json['stream'] as String?,
        bio: json['bio'] as String?,
        languages: (json['languages'] as List<dynamic>? ?? [])
            .map((e) => e as String)
            .toList(),
        pricePerMinuteMinor: (json['pricePerMinuteMinor'] as num).toInt(),
        university: json['university'] != null
            ? MentorUniversity.fromJson(json['university'] as Map<String, dynamic>)
            : null,
        isAvailable: json['isAvailable'] as bool? ?? false,
        isVerified: json['isVerified'] as bool? ?? false,
        availableDays: (json['availableDays'] as List<dynamic>? ?? [])
            .map((e) => e as String)
            .toList(),
        rating: (json['rating'] as num?)?.toDouble(),
        reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
        yearOfStudy: (json['yearOfStudy'] as num?)?.toInt(),
        studentsHelped: (json['studentsHelped'] as num?)?.toInt(),
        minutesMentored: (json['minutesMentored'] as num?)?.toInt(),
        avatarUrl: json['avatarUrl'] as String?,
      );
}

class MentorDashboardRecentSession {
  const MentorDashboardRecentSession({
    required this.id,
    required this.aspirantDisplayName,
    required this.endedAt,
    required this.billedMinutes,
    required this.earnedMinor,
  });

  final String id;
  final String aspirantDisplayName;
  final DateTime? endedAt;
  final int billedMinutes;
  final int earnedMinor;

  double get earnedRupees => earnedMinor / 100;

  factory MentorDashboardRecentSession.fromJson(Map<String, dynamic> json) =>
      MentorDashboardRecentSession(
        id: json['id'] as String,
        aspirantDisplayName: json['aspirantDisplayName'] as String,
        endedAt:
            json['endedAt'] != null ? DateTime.parse(json['endedAt'] as String) : null,
        billedMinutes: (json['billedMinutes'] as num).toInt(),
        earnedMinor: (json['earnedMinor'] as num).toInt(),
      );
}

class MentorDashboardStats {
  const MentorDashboardStats({
    required this.todaysSessionsCount,
    required this.minutesConsultedToday,
    required this.weeklyEarningsMinor,
    required this.monthlyEarningsMinor,
    required this.totalSessionsCount,
    required this.totalMinutesConsulted,
    required this.rating,
    required this.reviewCount,
    required this.recentSessions,
  });

  final int todaysSessionsCount;
  final int minutesConsultedToday;
  final int weeklyEarningsMinor;
  final int monthlyEarningsMinor;
  final int totalSessionsCount;
  final int totalMinutesConsulted;
  final double? rating;
  final int reviewCount;
  final List<MentorDashboardRecentSession> recentSessions;

  double get weeklyEarningsRupees => weeklyEarningsMinor / 100;
  double get monthlyEarningsRupees => monthlyEarningsMinor / 100;

  factory MentorDashboardStats.fromJson(Map<String, dynamic> json) =>
      MentorDashboardStats(
        todaysSessionsCount: (json['todaysSessionsCount'] as num).toInt(),
        minutesConsultedToday: (json['minutesConsultedToday'] as num).toInt(),
        weeklyEarningsMinor: (json['weeklyEarningsMinor'] as num).toInt(),
        monthlyEarningsMinor: (json['monthlyEarningsMinor'] as num).toInt(),
        totalSessionsCount: (json['totalSessionsCount'] as num).toInt(),
        totalMinutesConsulted: (json['totalMinutesConsulted'] as num).toInt(),
        rating: (json['rating'] as num?)?.toDouble(),
        reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
        recentSessions: (json['recentSessions'] as List<dynamic>? ?? [])
            .map((e) =>
                MentorDashboardRecentSession.fromJson(e as Map<String, dynamic>))
            .toList(),
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

  Future<MentorDashboardStats> getDashboardStats() async {
    final res = await _dio.get<Map<String, dynamic>>('/mentors/me/dashboard-stats');
    return MentorDashboardStats.fromJson(res.data!);
  }
}

final mentorsApiProvider = Provider<MentorsApi>(
  (ref) => MentorsApi(ref.watch(dioProvider)),
);
