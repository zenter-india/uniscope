import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';

class _Conversation {
  const _Conversation(this.id, this.name, this.university, this.lastMessage,
      this.unread, this.time);
  final String id;
  final String name;
  final String university;
  final String lastMessage;
  final int unread;
  final String time;
}

const _conversations = <_Conversation>[
  _Conversation('r1', 'Verified 3rd Year Student', 'AIIMS New Delhi',
      'Yes, the clinical rotations start from 3rd year.', 2, '2m'),
  _Conversation('r2', 'Verified Alumni', 'CMC Vellore',
      'Happy to help! What would you like to know?', 0, '1h'),
];

/// Port of RN `messages/ConversationListScreen.tsx`.
class ConversationListScreen extends StatelessWidget {
  const ConversationListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: _conversations.isEmpty
            ? const _EmptyState()
            : ListView.builder(
                itemCount: _conversations.length,
                itemBuilder: (_, i) => _ConversationRow(
                  conversation: _conversations[i],
                  onTap: () => context.go(
                    '/chats/room',
                    extra: {
                      'roomId': _conversations[i].id,
                      'participantName': _conversations[i].name,
                    },
                  ),
                ),
              ),
      ),
    );
  }
}

class _ConversationRow extends StatelessWidget {
  const _ConversationRow({required this.conversation, required this.onTap});

  final _Conversation conversation;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(bottom: BorderSide(color: AppColors.border)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: const BoxDecoration(
                color: AppColors.primaryLight,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text(
                conversation.university == 'AIIMS New Delhi' ? '🏥' : '🎓',
                style: const TextStyle(fontSize: 22),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          conversation.name,
                          style: const TextStyle(
                            fontSize: AppFont.md,
                            fontWeight: AppFont.semibold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                      Text(conversation.time,
                          style: const TextStyle(
                              fontSize: AppFont.xs, color: AppColors.textMuted)),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(conversation.university,
                      style: const TextStyle(
                          fontSize: AppFont.xs, color: AppColors.primary)),
                  const SizedBox(height: 2),
                  Text(
                    conversation.lastMessage,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: AppFont.sm, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            if (conversation.unread > 0) ...[
              const SizedBox(width: AppSpacing.md),
              Container(
                constraints: const BoxConstraints(minWidth: 20),
                height: 20,
                padding: const EdgeInsets.symmetric(horizontal: 4),
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  '${conversation.unread}',
                  style: const TextStyle(
                    fontSize: AppFont.xs,
                    color: AppColors.textInverse,
                    fontWeight: AppFont.bold,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('💬', style: TextStyle(fontSize: 40)),
            SizedBox(height: AppSpacing.md),
            Text('No conversations yet',
                style: TextStyle(
                    fontSize: AppFont.lg,
                    fontWeight: AppFont.bold,
                    color: AppColors.textPrimary)),
            SizedBox(height: AppSpacing.md),
            Text(
              'Find a verified mentor on a university page and start a conversation.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: AppFont.md,
                  color: AppColors.textSecondary,
                  height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}
