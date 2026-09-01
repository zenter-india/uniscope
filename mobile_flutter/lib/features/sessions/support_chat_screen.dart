import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/chat_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import 'chat_thread_view.dart';

/// Persistent "chat with UniScope" support channel — available any time,
/// independent of any session (unlike SessionChatScreen). Backed by
/// GET /chat/support/messages, which lazily provisions the channel.
class SupportChatScreen extends ConsumerStatefulWidget {
  const SupportChatScreen({super.key});

  @override
  ConsumerState<SupportChatScreen> createState() => _SupportChatScreenState();
}

class _SupportChatScreenState extends ConsumerState<SupportChatScreen> {
  ChatConnection? _connection;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _connect();
  }

  Future<void> _connect() async {
    try {
      final connection = await ref.read(chatApiProvider).getSupportMessages();
      if (!mounted) return;
      setState(() => _connection = connection);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
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

    if (_connection == null) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('UniScope Support')),
      body: ChatThreadView(
        connection: _connection!,
        currentUserId: ref.read(authControllerProvider).user!.id,
        onSend: (text) => ref.read(chatApiProvider).sendSupportMessage(text),
        onRefetch: () async {
          final refreshed = await ref.read(chatApiProvider).getSupportMessages();
          return refreshed.messages;
        },
      ),
    );
  }
}
