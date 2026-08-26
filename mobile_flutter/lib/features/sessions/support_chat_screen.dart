import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stream_chat_flutter/stream_chat_flutter.dart';

import '../../core/network/chat_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';

/// Persistent "chat with UniScope" support channel — available any time,
/// independent of any session (unlike SessionChatScreen). Backed by
/// GET /chat/support/token, which lazily provisions the channel.
class SupportChatScreen extends ConsumerStatefulWidget {
  const SupportChatScreen({super.key});

  @override
  ConsumerState<SupportChatScreen> createState() => _SupportChatScreenState();
}

class _SupportChatScreenState extends ConsumerState<SupportChatScreen> {
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
      final chatToken = await ref.read(chatApiProvider).getSupportToken();

      final client = StreamChatClient(chatToken.apiKey);
      await client.connectUser(User(id: userId), chatToken.token);

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
        appBar: AppBar(title: const Text('UniScope Support')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Text(
              'Could not open support chat: $_error',
              style: const TextStyle(color: AppColors.error),
            ),
          ),
        ),
      );
    }

    if (_client == null || _channel == null) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
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
              StreamMessageInput(
                showCommandsButton: false,
                disableAttachments: true,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
