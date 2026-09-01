import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.channelId,
    required this.senderId,
    required this.text,
    required this.createdAt,
  });

  final String id;
  final String channelId;
  final String senderId;
  final String text;
  final String createdAt;

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as String,
        channelId: json['channelId'] as String,
        senderId: json['senderId'] as String,
        text: json['text'] as String,
        createdAt: json['createdAt'] as String,
      );
}

/// Everything needed to open a channel in one round trip: Supabase Realtime
/// connection info (public anon key — safe, see backend ChatService doc)
/// plus the first page of message history.
class ChatConnection {
  const ChatConnection({
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    required this.broadcastTopic,
    required this.channelId,
    required this.messages,
  });

  final String supabaseUrl;
  final String supabaseAnonKey;
  final String broadcastTopic;
  final String channelId;
  final List<ChatMessage> messages;

  factory ChatConnection.fromJson(Map<String, dynamic> json) => ChatConnection(
        supabaseUrl: json['supabaseUrl'] as String,
        supabaseAnonKey: json['supabaseAnonKey'] as String,
        broadcastTopic: json['broadcastTopic'] as String,
        channelId: json['channelId'] as String,
        messages: (json['messages'] as List<dynamic>)
            .map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
            .toList(),
      );
}

class ChatApi {
  ChatApi(this._dio);

  final Dio _dio;

  Future<ChatConnection> getMessages(String sessionId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/sessions/$sessionId/chat/messages',
    );
    return ChatConnection.fromJson(res.data!);
  }

  Future<ChatMessage> sendMessage(String sessionId, String text) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/sessions/$sessionId/chat/messages',
      data: {'text': text},
    );
    return ChatMessage.fromJson(res.data!);
  }

  /// Persistent per-user support channel, independent of any session.
  Future<ChatConnection> getSupportMessages() async {
    final res = await _dio.get<Map<String, dynamic>>('/chat/support/messages');
    return ChatConnection.fromJson(res.data!);
  }

  Future<ChatMessage> sendSupportMessage(String text) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/chat/support/messages',
      data: {'text': text},
    );
    return ChatMessage.fromJson(res.data!);
  }
}

final chatApiProvider = Provider<ChatApi>(
  (ref) => ChatApi(ref.watch(dioProvider)),
);
