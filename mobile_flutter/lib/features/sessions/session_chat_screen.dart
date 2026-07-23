import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stream_chat_flutter/stream_chat_flutter.dart';

import '../../core/network/chat_api.dart';
import '../../core/network/sessions_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import 'call_request_sheet.dart';

/// Real Stream Chat UI for a CHAT session. Chat is free and has no pricing
/// or timing shown anywhere in this screen — the only place a cost ever
/// appears is the "Request a call" sheet, since only calls are billed.
///
/// A session isn't chat-ready until the mentor accepts (the Stream channel
/// itself is only created on accept — see SessionsService.accept()), so
/// this polls the session status first and shows a waiting state until then.
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
  Session? _session;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    try {
      final session = await ref.read(sessionsApiProvider).findById(widget.sessionId);
      if (!mounted) return;
      setState(() => _session = session);

      if (session.status == SessionStatus.accepted) {
        await _connect();
      } else if (_isTerminal(session.status)) {
        setState(() => _error = 'This chat is no longer available.');
      } else {
        _pollTimer ??= Timer.periodic(const Duration(seconds: 3), (_) => _loadSession());
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  bool _isTerminal(SessionStatus status) => const {
        SessionStatus.rejected,
        SessionStatus.cancelled,
        SessionStatus.expired,
        SessionStatus.failed,
      }.contains(status);

  Future<void> _connect() async {
    _pollTimer?.cancel();
    try {
      final userId = ref.read(authControllerProvider).user!.id;
      final chatToken = await ref.read(chatApiProvider).getToken(widget.sessionId);

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
    _pollTimer?.cancel();
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
            child: Text('$_error', style: const TextStyle(color: AppColors.error)),
          ),
        ),
      );
    }

    if (_session != null && _session!.status != SessionStatus.accepted) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(title: const Text('Chat')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(color: AppColors.primary),
                const SizedBox(height: AppSpacing.lg),
                const Text(
                  'Waiting for your mentor to accept…',
                  style: TextStyle(fontWeight: AppFont.bold, fontSize: AppFont.md),
                ),
                const SizedBox(height: AppSpacing.xs),
                const Text(
                  'You\'ll be able to chat as soon as they do.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: AppFont.sm, color: AppColors.textSecondary),
                ),
              ],
            ),
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
          appBar: StreamChannelHeader(
            actions: [
              IconButton(
                icon: const Icon(Icons.call_rounded, color: AppColors.primary),
                tooltip: 'Request a call',
                onPressed: () => showCallRequestSheet(
                  context,
                  ref,
                  mentorId: _session!.mentorId,
                ),
              ),
            ],
          ),
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
