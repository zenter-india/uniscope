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

  static SessionStatus fromWire(String value) =>
      SessionStatus.values.firstWhere((s) => s.wire == value, orElse: () => SessionStatus.pending);
}

class Session {
  const Session({
    required this.id,
    required this.aspirantId,
    required this.mentorId,
    required this.type,
    required this.status,
    required this.ratePerMinuteMinor,
    required this.requestedAt,
  });

  final String id;
  final String aspirantId;
  final String mentorId;
  final String type;
  final SessionStatus status;
  final int ratePerMinuteMinor;
  final String requestedAt;

  factory Session.fromJson(Map<String, dynamic> json) => Session(
        id: json['id'] as String,
        aspirantId: json['aspirantId'] as String,
        mentorId: json['mentorId'] as String,
        type: json['type'] as String,
        status: SessionStatus.fromWire(json['status'] as String),
        ratePerMinuteMinor: (json['ratePerMinuteMinor'] as num).toInt(),
        requestedAt: json['requestedAt'] as String,
      );
}

class SessionsApi {
  SessionsApi(this._dio);

  final Dio _dio;

  Future<Session> create(String mentorId, SessionKind type) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/sessions',
      data: {'mentorId': mentorId, 'type': type.wire},
    );
    return Session.fromJson(res.data!);
  }

  Future<List<Session>> list() async {
    final res = await _dio.get<Map<String, dynamic>>('/sessions');
    final data = res.data!['data'] as List<dynamic>;
    return data.map((e) => Session.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Session> accept(String sessionId) async {
    final res = await _dio.post<Map<String, dynamic>>('/sessions/$sessionId/accept');
    return Session.fromJson(res.data!);
  }

  Future<Session> reject(String sessionId) async {
    final res = await _dio.post<Map<String, dynamic>>('/sessions/$sessionId/reject');
    return Session.fromJson(res.data!);
  }

  Future<Session> cancel(String sessionId) async {
    final res = await _dio.post<Map<String, dynamic>>('/sessions/$sessionId/cancel');
    return Session.fromJson(res.data!);
  }
}

final sessionsApiProvider = Provider<SessionsApi>(
  (ref) => SessionsApi(ref.watch(dioProvider)),
);
