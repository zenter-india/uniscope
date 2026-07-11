import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

class ChatToken {
  const ChatToken({required this.token, required this.channelId, required this.apiKey});

  final String token;
  final String channelId;
  final String apiKey;

  factory ChatToken.fromJson(Map<String, dynamic> json) => ChatToken(
        token: json['token'] as String,
        channelId: json['channelId'] as String,
        apiKey: json['apiKey'] as String,
      );
}

class ChatApi {
  ChatApi(this._dio);

  final Dio _dio;

  Future<ChatToken> getToken(String sessionId) async {
    final res = await _dio.get<Map<String, dynamic>>('/sessions/$sessionId/chat/token');
    return ChatToken.fromJson(res.data!);
  }
}

final chatApiProvider = Provider<ChatApi>(
  (ref) => ChatApi(ref.watch(dioProvider)),
);
