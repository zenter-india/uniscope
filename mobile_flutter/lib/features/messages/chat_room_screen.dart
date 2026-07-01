import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

class _Message {
  _Message(this.id, this.text, this.isMine, this.time);
  final String id;
  final String text;
  final bool isMine;
  final String time;
}

/// Port of RN `messages/ChatRoomScreen.tsx`.
class ChatRoomScreen extends StatefulWidget {
  const ChatRoomScreen({
    super.key,
    required this.roomId,
    required this.participantName,
  });

  final String roomId;
  final String participantName;

  @override
  State<ChatRoomScreen> createState() => _ChatRoomScreenState();
}

class _ChatRoomScreenState extends State<ChatRoomScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  late final List<_Message> _messages = [
    _Message('1',
        "Hi! I saw you're a 3rd year student at AIIMS Delhi. Can I ask about clinical rotations?",
        true, '10:30'),
    _Message('2', 'Of course! Happy to help. What would you like to know?', false,
        '10:32'),
    _Message('3',
        'How many hours a week are spent in OPD / clinical in 3rd year?', true,
        '10:33'),
    _Message('4',
        'Yes, the clinical rotations start from 3rd year. You spend around 4-5 hours daily in OPD across different departments.',
        false, '10:35'),
  ];
  String _input = '';

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _send() {
    final text = _input.trim();
    if (text.isEmpty) return;
    final now = TimeOfDay.now();
    final time =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    setState(() {
      _messages.add(_Message(
          DateTime.now().millisecondsSinceEpoch.toString(), text, true, time));
      _input = '';
      _controller.clear();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(widget.participantName)),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md, vertical: AppSpacing.sm),
            decoration: const BoxDecoration(
              color: AppColors.primaryLight,
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: AppColors.success,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  widget.participantName,
                  style: const TextStyle(
                    fontSize: AppFont.sm,
                    fontWeight: AppFont.semibold,
                    color: AppColors.primaryDark,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                const Text(
                  'Identity anonymous · verified',
                  style: TextStyle(fontSize: AppFont.xs, color: AppColors.primary),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.separated(
              controller: _scrollController,
              padding: const EdgeInsets.all(AppSpacing.md),
              itemCount: _messages.length,
              separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
              itemBuilder: (_, i) => _Bubble(message: _messages[i]),
            ),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 100),
                      child: TextField(
                        controller: _controller,
                        onChanged: (t) => setState(() => _input = t),
                        maxLines: null,
                        maxLength: 1000,
                        style: const TextStyle(
                            fontSize: AppFont.md, color: AppColors.textPrimary),
                        decoration: InputDecoration(
                          counterText: '',
                          isDense: true,
                          filled: true,
                          fillColor: AppColors.background,
                          hintText: 'Type a message...',
                          hintStyle: const TextStyle(color: AppColors.textMuted),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadius.full),
                            borderSide:
                                const BorderSide(color: AppColors.border),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadius.full),
                            borderSide:
                                const BorderSide(color: AppColors.border),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadius.full),
                            borderSide:
                                const BorderSide(color: AppColors.border),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  GestureDetector(
                    onTap: _input.trim().isEmpty ? null : _send,
                    child: Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: _input.trim().isEmpty
                            ? AppColors.border
                            : AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: const Text('➤',
                          style: TextStyle(
                              color: AppColors.textInverse, fontSize: 18)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});
  final _Message message;

  @override
  Widget build(BuildContext context) {
    final mine = message.isMine;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.78),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: mine ? AppColors.primary : AppColors.surface,
            border: mine ? null : Border.all(color: AppColors.border),
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(AppRadius.lg),
              topRight: const Radius.circular(AppRadius.lg),
              bottomLeft: Radius.circular(mine ? AppRadius.lg : AppRadius.sm),
              bottomRight: Radius.circular(mine ? AppRadius.sm : AppRadius.lg),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                message.text,
                style: TextStyle(
                  fontSize: AppFont.md,
                  height: 1.4,
                  color: mine ? AppColors.textInverse : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                message.time,
                style: TextStyle(
                  fontSize: AppFont.xs,
                  color: mine
                      ? Colors.white.withValues(alpha: 0.7)
                      : AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
