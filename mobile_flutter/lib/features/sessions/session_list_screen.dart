import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/sessions_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';

final sessionsListProvider = FutureProvider.autoDispose<List<Session>>(
  (ref) => ref.watch(sessionsApiProvider).list(),
);

/// Replaces the old placeholder chat-room list. Backed by the real
/// marketplace booking API (`GET /sessions`) — shows sessions where the
/// current user is either the aspirant or the mentor, with role-appropriate
/// actions (mentor: accept/reject a PENDING request; aspirant: cancel).
class SessionListScreen extends ConsumerWidget {
  const SessionListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.watch(sessionsListProvider);
    final myUserId = ref.watch(authControllerProvider).user?.id;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Sessions'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _SupportChatEntry(onTap: () => context.push('/chats/support')),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => ref.refresh(sessionsListProvider.future),
                child: sessionsAsync.when(
                  loading: () => const Center(
                      child: CircularProgressIndicator(color: AppColors.primary)),
                  error: (err, _) => ListView(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(AppSpacing.xl),
                        child: Text('Failed to load sessions: $err',
                            style: const TextStyle(color: AppColors.error)),
                      ),
                    ],
                  ),
                  data: (sessions) => sessions.isEmpty
                      ? ListView(
                          children: const [
                            Padding(
                              padding: EdgeInsets.all(AppSpacing.xl),
                              child: Text(
                                'No sessions yet — book one from the Mentors tab.',
                                style: TextStyle(color: AppColors.textSecondary),
                              ),
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          itemCount: sessions.length,
                          itemBuilder: (_, i) => _SessionCard(
                            session: sessions[i],
                            isMentor: sessions[i].mentorId == myUserId,
                          ),
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SupportChatEntry extends StatelessWidget {
  const _SupportChatEntry({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, 0),
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.primaryLight,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            const Text('💬', style: TextStyle(fontSize: 20)),
            const SizedBox(width: AppSpacing.sm),
            const Expanded(
              child: Text(
                'Need Help? Chat with our support team anytime.',
                style: TextStyle(
                  fontSize: AppFont.sm,
                  fontWeight: AppFont.medium,
                  color: AppColors.primaryDark,
                ),
              ),
            ),
            const Text('›', style: TextStyle(fontSize: 18, color: AppColors.primary)),
          ],
        ),
      ),
    );
  }
}

class _SessionCard extends ConsumerStatefulWidget {
  const _SessionCard({required this.session, required this.isMentor});
  final Session session;
  final bool isMentor;

  @override
  ConsumerState<_SessionCard> createState() => _SessionCardState();
}

class _SessionCardState extends ConsumerState<_SessionCard> {
  bool _busy = false;

  Future<void> _act(Future<Session> Function(String) action) async {
    setState(() => _busy = true);
    try {
      await action(widget.session.id);
      ref.invalidate(sessionsListProvider);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Color _statusColor(SessionStatus status) {
    switch (status) {
      case SessionStatus.pending:
        return AppColors.warning;
      case SessionStatus.accepted:
      case SessionStatus.inProgress:
        return AppColors.success;
      case SessionStatus.completed:
        return AppColors.info;
      case SessionStatus.rejected:
      case SessionStatus.cancelled:
      case SessionStatus.expired:
      case SessionStatus.failed:
        return AppColors.error;
      case SessionStatus.ringing:
        return AppColors.accent;
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final api = ref.read(sessionsApiProvider);
    final canOpenChat = session.type == 'CHAT' &&
        (session.status == SessionStatus.accepted ||
            session.status == SessionStatus.inProgress ||
            session.status == SessionStatus.completed);

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  widget.isMentor ? 'Aspirant request' : 'Your request',
                  style: const TextStyle(fontWeight: AppFont.semibold, fontSize: AppFont.md),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 2),
                decoration: BoxDecoration(
                  color: _statusColor(session.status).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadius.full),
                ),
                child: Text(
                  session.status.wire,
                  style: TextStyle(
                    fontSize: AppFont.xs,
                    fontWeight: AppFont.medium,
                    color: _statusColor(session.status),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text('${session.type} · ₹${(session.ratePerMinuteMinor / 100).toStringAsFixed(2)}/min',
              style: const TextStyle(fontSize: AppFont.sm, color: AppColors.textSecondary)),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              if (widget.isMentor && session.status == SessionStatus.pending) ...[
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => _act(api.reject),
                    child: const Text('Reject'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
                    onPressed: _busy ? null : () => _act(api.accept),
                    child: _busy
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Accept'),
                  ),
                ),
              ] else if (!widget.isMentor &&
                  (session.status == SessionStatus.pending ||
                      session.status == SessionStatus.accepted)) ...[
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => _act(api.cancel),
                    child: const Text('Cancel'),
                  ),
                ),
              ],
              if (canOpenChat)
                Expanded(
                  child: FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: AppColors.primaryDark),
                    onPressed: () => context.push('/chats/room', extra: {'sessionId': session.id}),
                    child: const Text('Open Chat'),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
