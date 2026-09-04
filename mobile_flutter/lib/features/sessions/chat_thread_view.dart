import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;
import 'package:uuid/uuid.dart';

import '../../core/network/chat_api.dart';
import '../../core/theme/app_theme.dart';

const _uuid = Uuid();

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
    required this.onLoadOlder,
    this.initialDraft,
  });

  /// Pre-fills the composer once, on first mount — used when a chat is
  /// started from a tapped sample question so the aspirant lands with the
  /// question already typed, ready to edit or send.
  final String? initialDraft;

  final ChatConnection connection;
  final String currentUserId;
  final Future<void> Function(String text, String clientMessageId) onSend;
  final Future<ChatConnection> Function() onRefetch;
  final Future<ChatConnection> Function(String beforeMessageId) onLoadOlder;

  @override
  State<ChatThreadView> createState() => _ChatThreadViewState();
}

class _ChatThreadViewState extends State<ChatThreadView>
    with WidgetsBindingObserver {
  late List<ChatMessage> _messages;
  late bool _hasMore;
  sb.SupabaseClient? _realtime;
  sb.RealtimeChannel? _channel;
  final _composerController = TextEditingController();
  final _scrollController = ScrollController();
  bool _sending = false;
  bool _loadingMore = false;
  bool _disposed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _messages = List.of(widget.connection.messages);
    _hasMore = widget.connection.hasMore;
    if (widget.initialDraft != null && widget.initialDraft!.trim().isNotEmpty) {
      _composerController.text = widget.initialDraft!;
    }
    _subscribe();
    _scrollController.addListener(_maybeLoadMore);
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
        .subscribe(_onSubscribeStatusChanged);
    _realtime = realtime;
    _channel = channel;
  }

  /// A dropped/failed subscription (network hiccup, backgrounded app,
  /// token/session churn) needs a fresh channel instance — the underlying
  /// package throws if `subscribe()` is called twice on the same one. Also
  /// refetches on the initial successful `subscribed` status, since a
  /// message can land in the gap between the REST history fetch and the
  /// subscription actually taking effect.
  void _onSubscribeStatusChanged(
    sb.RealtimeSubscribeStatus status,
    Object? error,
  ) {
    if (_disposed) return;
    switch (status) {
      case sb.RealtimeSubscribeStatus.subscribed:
        _onNewMessagePing();
      case sb.RealtimeSubscribeStatus.channelError:
      case sb.RealtimeSubscribeStatus.timedOut:
      case sb.RealtimeSubscribeStatus.closed:
        _scheduleResubscribe();
    }
  }

  void _scheduleResubscribe() {
    _channel?.unsubscribe();
    _realtime?.dispose();
    _channel = null;
    _realtime = null;
    Future.delayed(const Duration(seconds: 3), () {
      if (_disposed) return;
      _subscribe();
    });
  }

  /// Independent of the Realtime channel's own reconnect handling above —
  /// resuming from background is exactly when a channel is most likely to
  /// have silently dropped, so this is a second, simpler safety net that
  /// doesn't depend on the channel's own error callback having fired.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _onNewMessagePing();
    }
  }

  Future<void> _onNewMessagePing() async {
    try {
      final refreshed = await widget.onRefetch();
      if (!mounted) return;
      setState(() {
        _messages = refreshed.messages;
        _hasMore = refreshed.hasMore;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    } catch (_) {
      // transient network hiccup — next ping (or the user reopening the
      // screen) will catch up; nothing to show the user for a missed live
      // update when history is still correct on next real fetch.
    }
  }

  void _maybeLoadMore() {
    if (!_hasMore || _loadingMore || !_scrollController.hasClients) return;
    // Within 200px of the top edge — load the next page before the user
    // actually hits the end, so it feels continuous rather than a visible
    // stall-then-append.
    if (_scrollController.position.pixels <=
        _scrollController.position.minScrollExtent + 200) {
      _loadOlder();
    }
  }

  Future<void> _loadOlder() async {
    if (_messages.isEmpty) return;
    setState(() => _loadingMore = true);
    final oldestId = _messages.first.id;
    final oldOffset = _scrollController.offset;
    final oldMaxExtent = _scrollController.position.maxScrollExtent;
    try {
      final page = await widget.onLoadOlder(oldestId);
      if (!mounted) return;
      setState(() {
        _messages = [...page.messages, ..._messages];
        _hasMore = page.hasMore;
        _loadingMore = false;
      });
      // Keep the visual scroll position stable after prepending older rows
      // above it — without this the list jumps to wherever the new content
      // pushed the viewport.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!_scrollController.hasClients) return;
        final delta = _scrollController.position.maxScrollExtent - oldMaxExtent;
        _scrollController.jumpTo(oldOffset + delta);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
      // Silent — the user can just keep scrolling to retry; a snackbar for
      // a background pagination fetch would be noisier than useful.
    }
  }

  void _scrollToBottom() {
    if (!_scrollController.hasClients) return;
    _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
  }

  Future<void> _send() async {
    final text = _composerController.text.trim();
    if (text.isEmpty || _sending) return;
    _composerController.clear();
    await _sendWithRetryId(text, _uuid.v4());
  }

  /// Shared by a fresh send and a manual retry — a retry MUST reuse the
  /// same [clientMessageId] as the original attempt, not mint a new one,
  /// or the backend's idempotency dedup can't tell it apart from a genuine
  /// second message (see ChatService.sendMessage).
  Future<void> _sendWithRetryId(String text, String clientMessageId) async {
    setState(() => _sending = true);
    try {
      await widget.onSend(text, clientMessageId);
      final refreshed = await widget.onRefetch();
      if (!mounted) return;
      setState(() {
        _messages = refreshed.messages;
        _hasMore = refreshed.hasMore;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not send: $e'),
          action: SnackBarAction(
            label: 'Retry',
            onPressed: () => _sendWithRetryId(text, clientMessageId),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  void dispose() {
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    _scrollController.removeListener(_maybeLoadMore);
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
                  itemCount: _messages.length + (_loadingMore ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (_loadingMore && index == 0) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                        child: Center(
                          child: SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ),
                      );
                    }
                    final message = _messages[index - (_loadingMore ? 1 : 0)];
                    return _MessageBubble(
                      message: message,
                      isMine: message.senderId == widget.currentUserId,
                    );
                  },
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
                      : const Icon(
                          Icons.send_rounded,
                          color: AppColors.primary,
                        ),
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
