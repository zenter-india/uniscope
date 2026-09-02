import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import 'dio_client.dart';

const _uuid = Uuid();

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
/// plus a page of message history.
class ChatConnection {
  const ChatConnection({
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    required this.broadcastTopic,
    required this.channelId,
    required this.messages,
    required this.hasMore,
  });

  final String supabaseUrl;
  final String supabaseAnonKey;
  final String broadcastTopic;
  final String channelId;
  final List<ChatMessage> messages;

  /// True if there's older history beyond [messages] — pass the oldest
  /// message's id as `before` to fetch the next page.
  final bool hasMore;

  factory ChatConnection.fromJson(Map<String, dynamic> json) => ChatConnection(
    supabaseUrl: json['supabaseUrl'] as String,
    supabaseAnonKey: json['supabaseAnonKey'] as String,
    broadcastTopic: json['broadcastTopic'] as String,
    channelId: json['channelId'] as String,
    messages: (json['messages'] as List<dynamic>)
        .map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
        .toList(),
    hasMore: json['hasMore'] as bool? ?? false,
  );
}

class ChatApi {
  ChatApi(this._dio);

  final Dio _dio;

  Future<ChatConnection> getMessages(String sessionId, {String? before}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/sessions/$sessionId/chat/messages',
      queryParameters: {if (before != null) 'before': before},
    );
    return ChatConnection.fromJson(res.data!);
  }

  /// [clientMessageId] defaults to a freshly-generated UUID so every real
  /// send is retry-safe by default — a caller only needs to pass its own
  /// when it wants to reuse the exact same id across an explicit retry
  /// (see ChatThreadView._send).
  Future<ChatMessage> sendMessage(
    String sessionId,
    String text, {
    String? clientMessageId,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/sessions/$sessionId/chat/messages',
      data: {'text': text, 'clientMessageId': clientMessageId ?? _uuid.v4()},
    );
    return ChatMessage.fromJson(res.data!);
  }

  /// Persistent per-user support channel, independent of any session.
  Future<ChatConnection> getSupportMessages({String? before}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/chat/support/messages',
      queryParameters: {if (before != null) 'before': before},
    );
    return ChatConnection.fromJson(res.data!);
  }

  Future<ChatMessage> sendSupportMessage(
    String text, {
    String? clientMessageId,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/chat/support/messages',
      data: {'text': text, 'clientMessageId': clientMessageId ?? _uuid.v4()},
    );
    return ChatMessage.fromJson(res.data!);
  }
}

final chatApiProvider = Provider<ChatApi>(
  (ref) => ChatApi(ref.watch(dioProvider)),
);
