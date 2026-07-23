import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.isRead,
    required this.metadata,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String? body;
  final bool isRead;
  final Map<String, dynamic>? metadata;
  final String createdAt;

  String? get sessionId => metadata?['sessionId'] as String?;

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
        id: json['id'] as String,
        type: json['type'] as String,
        title: json['title'] as String,
        body: json['body'] as String?,
        isRead: json['isRead'] as bool,
        metadata: json['metadata'] as Map<String, dynamic>?,
        createdAt: json['createdAt'] as String,
      );
}

class NotificationsApi {
  NotificationsApi(this._dio);

  final Dio _dio;

  Future<List<AppNotification>> list() async {
    final res = await _dio.get<Map<String, dynamic>>('/notifications');
    final data = res.data!['data'] as List<dynamic>;
    return data.map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<int> unreadCount() async {
    final res = await _dio.get<Map<String, dynamic>>('/notifications/unread-count');
    return (res.data!['count'] as num).toInt();
  }

  Future<void> markRead(String id) async {
    await _dio.patch<void>('/notifications/$id/read');
  }

  Future<void> markAllRead() async {
    await _dio.patch<void>('/notifications/read-all');
  }

  Future<void> registerPushToken(String token, {String platform = 'android'}) async {
    await _dio.post<void>(
      '/users/me/push-token',
      data: {'token': token, 'platform': platform},
    );
  }
}

final notificationsApiProvider = Provider<NotificationsApi>(
  (ref) => NotificationsApi(ref.watch(dioProvider)),
);
