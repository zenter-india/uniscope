import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;

import '../../core/network/chat_api.dart';
import '../../core/theme/app_theme.dart';

/// Shared message list + composer for both SessionChatScreen and
/// SupportChatScreen — replaces Stream Chat's StreamMessageListView /
/// StreamMessageInput (see migration/chat-supabase-realtime). Messages
/// persist via the authenticated REST API (onSend); live delivery is a
/// content-free Supabase Realtime Broadcast ping on [connection]'s topic —
/// on receiving one, this refetches history via [onRefetch] rather than
/// trusting anything in the broadcast payload itself, matching the
/// backend's deliberate "never put the message body on the open topic"
/// design (see ChatService).
class ChatThreadView extends StatefulWidget {
  const ChatThreadView({
    super.key,
    required this.connection,
    required this.currentUserId,
    required this.onSend,
    required this.onRefetch,
  });

  final ChatConnection connection;
  final String currentUserId;
  final Future<void> Function(String text) onSend;
  final Future<List<ChatMessage>> Function() onRefetch;

  @override
  State<ChatThreadView> createState() => _ChatThreadViewState();
}

class _ChatThreadViewState extends State<ChatThreadView> {
  late List<ChatMessage> _messages;
  sb.SupabaseClient? _realtime;
  sb.RealtimeChannel? _channel;
  final _composerController = TextEditingController();
  final _scrollController = ScrollController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _messages = List.of(widget.connection.messages);
    _subscribe();
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
  }

  void _subscribe() {
    final realtime = sb.SupabaseClient(
      widget.connection.supabaseUrl,
      widget.connection.supabaseAnonKey,
    );
    final channel = realtime.channel(widget.connection.broadcastTopic);
    channel
        .onBroadcast(
          event: 'new_message',
          callback: (payload) => _onNewMessagePing(),
        )
        .subscribe();
    _realtime = realtime;
    _channel = channel;
  }

  Future<void> _onNewMessagePing() async {
    try {
      final refreshed = await widget.onRefetch();
      if (!mounted) return;
      setState(() => _messages = refreshed);
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    } catch (_) {
      // transient network hiccup — next ping (or the user reopening the
      // screen) will catch up; nothing to show the user for a missed live
      // update when history is still correct on next real fetch.
    }
  }

  void _scrollToBottom() {
    if (!_scrollController.hasClients) return;
    _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
  }

  Future<void> _send() async {
    final text = _composerController.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    _composerController.clear();
    try {
      await widget.onSend(text);
      final refreshed = await widget.onRefetch();
      if (!mounted) return;
      setState(() => _messages = refreshed);
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not send: $e')));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    _realtime?.dispose();
    _composerController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: _messages.isEmpty
              ? const Center(
                  child: Text(
                    'No messages yet — say hello!',
                    style: TextStyle(color: AppColors.textMuted),
                  ),
                )
              : ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.md,
                  ),
                  itemCount: _messages.length,
                  itemBuilder: (context, index) =>
                      _MessageBubble(
                        message: _messages[index],
                        isMine: _messages[index].senderId == widget.currentUserId,
                      ),
                ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _composerController,
                    minLines: 1,
                    maxLines: 4,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _send(),
                    decoration: InputDecoration(
                      hintText: 'Message',
                      filled: true,
                      fillColor: AppColors.background,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.sm,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                IconButton(
                  onPressed: _sending ? null : _send,
                  icon: _sending
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send_rounded, color: AppColors.primary),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, required this.isMine});

  final ChatMessage message;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.75,
        ),
        decoration: BoxDecoration(
          color: isMine ? AppColors.primary : AppColors.surface,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isMine ? 16 : 4),
            bottomRight: Radius.circular(isMine ? 4 : 16),
          ),
          border: isMine ? null : Border.all(color: AppColors.border),
        ),
        child: Text(
          message.text,
          style: TextStyle(
            color: isMine ? AppColors.textInverse : AppColors.textPrimary,
            fontSize: AppFont.sm,
          ),
        ),
      ),
    );
  }
}
