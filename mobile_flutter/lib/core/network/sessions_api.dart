import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

/// Mirrors the backend `SessionType` enum.
enum SessionKind {
  chat('CHAT'),
  audioCall('AUDIO_CALL');

  const SessionKind(this.wire);
  final String wire;
}

/// Fixed pre-paid call slots — mirrors backend CALL_SLOT_MINUTES. Shortest
/// slot is 6 min (was 5, per explicit client request).
const List<int> kCallSlotMinutes = [6, 10, 20];

/// Mirrors the backend `SessionStatus` enum.
enum SessionStatus {
  pending('PENDING'),
  accepted('ACCEPTED'),
  rejected('REJECTED'),
  ringing('RINGING'),
  inProgress('IN_PROGRESS'),
  completed('COMPLETED'),
  cancelled('CANCELLED'),
  expired('EXPIRED'),
  failed('FAILED');

  const SessionStatus(this.wire);
  final String wire;

  static SessionStatus fromWire(String value) => SessionStatus.values
      .firstWhere((s) => s.wire == value, orElse: () => SessionStatus.pending);
}

class Session {
  const Session({
    required this.id,
    required this.aspirantId,
    required this.mentorId,
    required this.aspirantName,
    required this.mentorName,
    this.aspirantUniqueId,
    this.mentorUniqueId,
    this.aspirantAvatarUrl,
    this.mentorAvatarUrl,
    required this.type,
    required this.status,
    required this.ratePerMinuteMinor,
    required this.requestedAt,
    this.startedAt,
    this.endedAt,
    this.billedMinutes = 0,
    this.totalCostMinor = 0,
    this.endReason,
    this.callSlotMinutes,
    this.requestedFor,
    this.requestedForAlt,
    this.confirmedFor,
    this.aspirantJoinedAt,
    this.mentorJoinedAt,
    this.mentorIsAvailable = false,
    this.mentorAvailableDays = const [],
    this.mentorCollege,
    this.mentorSpecialty,
    this.mentorRating,
    this.mentorReviewCount = 0,
    this.aspirantStream,
    this.aspirantQualification,
    this.aspirantCourse,
  });

  final String id;
  final String aspirantId;
  final String mentorId;
  final String aspirantName;
  final String mentorName;

  /// Public registration number (e.g. "A1134500001" / "M3300000047") — shown
  /// under the counterparty's name in the session/chat header instead of a
  /// tap-to-profile link. Null until that party's profile.stream is known.
  final String? aspirantUniqueId;
  final String? mentorUniqueId;
  final String? aspirantAvatarUrl;
  final String? mentorAvatarUrl;
  final String type;
  final SessionStatus status;
  final int ratePerMinuteMinor;
  final String requestedAt;
  final String? startedAt;
  final String? endedAt;
  final int billedMinutes;
  final int totalCostMinor;
  final String? endReason;
  final int? callSlotMinutes;

  /// AUDIO_CALL only: the time the aspirant asked to connect, from the
  /// "When?" step. Null = Instant (connect once the mentor accepts).
  /// Advisory — nothing is reserved; the mentor sees it on the request.
  final DateTime? requestedFor;

  /// AUDIO_CALL only: an optional second preferred time — the aspirant may
  /// offer the mentor two options to pick between.
  final DateTime? requestedForAlt;

  /// AUDIO_CALL only: the concrete 30-minute slot the MENTOR confirmed on
  /// accept, chosen from a strip of half-hour slots around requestedFor /
  /// requestedForAlt. Null = accepted without a slot, or an Instant request.
  /// Unlike requestedFor this is a real commitment (the no-show grace clock
  /// runs from it server-side).
  final DateTime? confirmedFor;
  final String? aspirantJoinedAt;
  final String? mentorJoinedAt;

  /// Expiry-aware "can this mentor be booked for a call right now" — the
  /// backend runs the same isCallAvailable() gate every other surface uses
  /// (SessionResponse.mentorIsAvailable). Defaults false if absent.
  final bool mentorIsAvailable;

  /// The mentor's stated free-time windows (kTimeSlots strings, e.g.
  /// "Morning (6 AM - 12 PM)") — lets the call-request sheet's "When?" step
  /// offer them as quick-picks straight from a session row.
  final List<String> mentorAvailableDays;

  // ── In-call context card (populated on GET /sessions/:id) ──────────────
  /// The mentor's college — shown to the aspirant during a call.
  final String? mentorCollege;

  /// The mentor's specialty/specialization (falls back to their stream) —
  /// shown to the aspirant during a call.
  final String? mentorSpecialty;

  /// The mentor's average rating (1–5) and review count. Null with no
  /// reviews yet.
  final double? mentorRating;
  final int mentorReviewCount;

  /// The aspirant's school stream / qualification / target course — shown
  /// to the mentor during a call.
  final String? aspirantStream;
  final String? aspirantQualification;
  final String? aspirantCourse;

  factory Session.fromJson(Map<String, dynamic> json) => Session(
    id: json['id'] as String,
    aspirantId: json['aspirantId'] as String,
    mentorId: json['mentorId'] as String,
    aspirantName: json['aspirantName'] as String? ?? 'Aspirant',
    mentorName: json['mentorName'] as String? ?? 'Mentor',
    aspirantUniqueId: json['aspirantUniqueId'] as String?,
    mentorUniqueId: json['mentorUniqueId'] as String?,
    aspirantAvatarUrl: json['aspirantAvatarUrl'] as String?,
    mentorAvatarUrl: json['mentorAvatarUrl'] as String?,
    type: json['type'] as String,
    status: SessionStatus.fromWire(json['status'] as String),
    ratePerMinuteMinor: (json['ratePerMinuteMinor'] as num).toInt(),
    requestedAt: json['requestedAt'] as String,
    startedAt: json['startedAt'] as String?,
    endedAt: json['endedAt'] as String?,
    billedMinutes: (json['billedMinutes'] as num?)?.toInt() ?? 0,
    totalCostMinor: (json['totalCostMinor'] as num?)?.toInt() ?? 0,
    endReason: json['endReason'] as String?,
    callSlotMinutes: (json['callSlotMinutes'] as num?)?.toInt(),
    requestedFor: json['requestedFor'] != null
        ? DateTime.tryParse(json['requestedFor'] as String)
        : null,
    requestedForAlt: json['requestedForAlt'] != null
        ? DateTime.tryParse(json['requestedForAlt'] as String)
        : null,
    confirmedFor: json['confirmedFor'] != null
        ? DateTime.tryParse(json['confirmedFor'] as String)
        : null,
    aspirantJoinedAt: json['aspirantJoinedAt'] as String?,
    mentorJoinedAt: json['mentorJoinedAt'] as String?,
    mentorIsAvailable: json['mentorIsAvailable'] as bool? ?? false,
    mentorAvailableDays:
        (json['mentorAvailableDays'] as List<dynamic>?)
            ?.map((e) => e as String)
            .toList() ??
        const [],
    mentorCollege: json['mentorCollege'] as String?,
    mentorSpecialty: json['mentorSpecialty'] as String?,
    mentorRating: (json['mentorRating'] as num?)?.toDouble(),
    mentorReviewCount: (json['mentorReviewCount'] as num?)?.toInt() ?? 0,
    aspirantStream: json['aspirantStream'] as String?,
    aspirantQualification: json['aspirantQualification'] as String?,
    aspirantCourse: json['aspirantCourse'] as String?,
  );
}

class CallCredentials {
  const CallCredentials({
    required this.appId,
    required this.channelName,
    required this.token,
    required this.uid,
  });

  final String appId;
  final String channelName;
  final String token;
  final String uid;

  factory CallCredentials.fromJson(Map<String, dynamic> json) =>
      CallCredentials(
        appId: json['appId'] as String,
        channelName: json['channelName'] as String,
        token: json['token'] as String,
        uid: json['uid'] as String,
      );
}

class SessionsApi {
  SessionsApi(this._dio);

  final Dio _dio;

  Future<Session> create(
    String mentorId,
    SessionKind type, {
    int? slotMinutes,
    DateTime? requestedFor,
    DateTime? requestedForAlt,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/sessions',
        data: {
          'mentorId': mentorId,
          'type': type.wire,
          if (slotMinutes != null) 'slotMinutes': slotMinutes,
          if (requestedFor != null)
            'requestedFor': requestedFor.toUtc().toIso8601String(),
          if (requestedForAlt != null)
            'requestedForAlt': requestedForAlt.toUtc().toIso8601String(),
        },
      );
      return Session.fromJson(res.data!);
    } on DioException catch (e) {
      // Surface the backend's own message (e.g. "mentor is offline for
      // calls") instead of a raw DioException string — but preserve the
      // status code so callers can still branch on 409 (see
      // startChatWithMentor's active-session recovery).
      final message = e.response?.data is Map
          ? (e.response?.data as Map)['message']
          : null;
      if (message is String) {
        throw DioException(
          requestOptions: e.requestOptions,
          response: e.response,
          type: e.type,
          message: message,
        );
      }
      rethrow;
    }
  }

  Future<List<Session>> list() async {
    final res = await _dio.get<Map<String, dynamic>>('/sessions');
    final data = res.data!['data'] as List<dynamic>;
    return data
        .map((e) => Session.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Session> findById(String sessionId) async {
    final res = await _dio.get<Map<String, dynamic>>('/sessions/$sessionId');
    return Session.fromJson(res.data!);
  }

  /// [confirmedFor] — AUDIO_CALL only — is the 30-minute slot the mentor
  /// picked in the confirm sheet. Omit it for an Instant request or to
  /// accept without committing a slot. Sent as a UTC ISO-8601 string.
  Future<Session> accept(String sessionId, {DateTime? confirmedFor}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/sessions/$sessionId/accept',
      data: confirmedFor == null
          ? null
          : {'confirmedFor': confirmedFor.toUtc().toIso8601String()},
    );
    return Session.fromJson(res.data!);
  }

  Future<Session> reject(String sessionId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/sessions/$sessionId/reject',
    );
    return Session.fromJson(res.data!);
  }

  Future<Session> cancel(String sessionId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/sessions/$sessionId/cancel',
    );
    return Session.fromJson(res.data!);
  }

  Future<CallCredentials> getCallToken(String sessionId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/sessions/$sessionId/call/token',
    );
    return CallCredentials.fromJson(res.data!);
  }

  Future<Session> confirmJoined(String sessionId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/sessions/$sessionId/call/joined',
    );
    return Session.fromJson(res.data!);
  }

  Future<Session> extendCall(String sessionId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/sessions/$sessionId/call/extend',
    );
    return Session.fromJson(res.data!);
  }

  Future<Session> endCall(String sessionId, {String? endReason}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/sessions/$sessionId/call/end',
      data: {if (endReason != null) 'endReason': endReason},
    );
    return Session.fromJson(res.data!);
  }
}

final sessionsApiProvider = Provider<SessionsApi>(
  (ref) => SessionsApi(ref.watch(dioProvider)),
);
