import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/blocks_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';

/// Lists users the current account has blocked, with an unblock action on
/// each row. Blocking prevents new chat/call sessions in either direction —
/// see BlocksService.isBlockedEitherDirection on the backend.
class BlockedUsersScreen extends ConsumerWidget {
  const BlockedUsersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final blockedAsync = ref.watch(blockedUsersListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Blocked Users')),
      body: blockedAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (err, _) => EmptyState(
          icon: Icons.wifi_off_rounded,
          title: 'Could not load this',
          message: 'Check your connection and try again.',
          actionLabel: 'Retry',
          onAction: () => ref.invalidate(blockedUsersListProvider),
        ),
        data: (blocked) {
          if (blocked.isEmpty) {
            return const EmptyState(
              icon: Icons.block_outlined,
              title: 'No blocked users',
              message: 'Anyone you block will show up here.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.md),
            itemCount: blocked.length,
            separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
            itemBuilder: (context, index) {
              final user = blocked[index];
              return AppCard(
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: AppColors.primaryLight,
                      backgroundImage:
                          user.avatarUrl != null ? NetworkImage(user.avatarUrl!) : null,
                      child: user.avatarUrl == null
                          ? Text(
                              user.displayName.isNotEmpty
                                  ? user.displayName[0].toUpperCase()
                                  : '?',
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontWeight: AppFont.bold,
                              ),
                            )
                          : null,
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Text(
                        user.displayName,
                        style: const TextStyle(
                          fontSize: AppFont.md,
                          fontWeight: AppFont.medium,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () async {
                        await ref.read(blockedUserIdsProvider.notifier).unblock(user.id);
                        ref.invalidate(blockedUsersListProvider);
                      },
                      child: const Text('Unblock'),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}
