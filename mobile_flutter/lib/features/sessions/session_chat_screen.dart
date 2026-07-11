import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stream_chat_flutter/stream_chat_flutter.dart';

import '../../core/network/chat_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';

/// Real Stream Chat UI for an ACCEPTED CHAT session. Fetches a short-lived
/// token from `GET /sessions/:id/chat/token` (gated server-side by session
/// party + status), connects a StreamChatClient, and renders the channel
/// with Stream's own message list / composer widgets.
class SessionChatScreen extends ConsumerStatefulWidget {
  const SessionChatScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  ConsumerState<SessionChatScreen> createState() => _SessionChatScreenState();
}

class _SessionChatScreenState extends ConsumerState<SessionChatScreen> {
  StreamChatClient? _client;
  Channel? _channel;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _connect();
  }

  Future<void> _connect() async {
    try {
      final userId = ref.read(authControllerProvider).user!.id;
      final chatToken = await ref.read(chatApiProvider).getToken(widget.sessionId);

      final client = StreamChatClient(chatToken.apiKey);
      await client.connectUser(
        User(id: userId),
        chatToken.token,
      );

      final channel = client.channel('messaging', id: chatToken.channelId);
      await channel.watch();

      if (!mounted) return;
      setState(() {
        _client = client;
        _channel = channel;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  @override
  void dispose() {
    _client?.disconnectUser();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(title: const Text('Chat')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Text('Could not open chat: $_error',
                style: const TextStyle(color: AppColors.error)),
          ),
        ),
      );
    }

    if (_client == null || _channel == null) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    return StreamChat(
      client: _client!,
      child: StreamChannel(
        channel: _channel!,
        child: Scaffold(
          appBar: const StreamChannelHeader(),
          body: const Column(
            children: [
              Expanded(child: StreamMessageListView()),
              StreamMessageInput(),
            ],
          ),
        ),
      ),
    );
  }
}
