import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/mentors_api.dart';
import '../../core/network/universities_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../mentors/mentor_list_screen.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final displayName = ref.watch(authControllerProvider).user?.displayName;
    final firstName = displayName?.split(' ').first;
    final universitiesAsync = ref.watch(universitiesListProvider);
    final mentorsAsync = ref.watch(mentorsListProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Container(
        decoration: const BoxDecoration(gradient: AppGradients.hero),
        child: SafeArea(
          bottom: false,
          child: RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              ref.invalidate(universitiesListProvider);
              ref.invalidate(mentorsListProvider);
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                        AppSpacing.md, AppSpacing.lg, AppSpacing.md, AppSpacing.md),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                firstName == null
                                    ? _greeting
                                    : '$_greeting, $firstName',
                                style: const TextStyle(
                                  fontSize: AppFont.xl,
                                  fontWeight: AppFont.extraBold,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              const Text(
                                'What are you looking for today?',
                                style: TextStyle(
                                  fontSize: AppFont.sm,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const NotificationBell(),
                        if (displayName != null)
                          AppAvatar(name: displayName, size: 44),
                      ],
                    ),
                  ),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                    child: Row(
                      children: [
                        Expanded(
                          child: _QuickCard(
                            label: 'Colleges',
                            icon: Icons.school_rounded,
                            onTap: () => context.go('/colleges'),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: _QuickCard(
                            label: 'Mentors',
                            icon: Icons.people_alt_rounded,
                            onTap: () => context.go('/mentors'),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: _QuickCard(
                            label: 'Sessions',
                            icon: Icons.forum_rounded,
                            onTap: () => context.go('/chats'),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SectionHeader(
                          title: 'Top Colleges',
                          onSeeAll: () => context.go('/colleges'),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        universitiesAsync.when(
                          loading: () => const Column(
                              children: [SkeletonCard(), SkeletonCard()]),
                          error: (_, __) => const SizedBox.shrink(),
                          data: (universities) => Column(
                            children: universities.take(3).map((u) {
                              return _CollegeCard(
                                name: u.name,
                                sub: [
                                  u.type == 'GOVERNMENT' ? 'Government' : 'Private',
                                  if (u.nirfRank != null) 'Rank #${u.nirfRank}',
                                  if (u.mbbsSeats != null) '${u.mbbsSeats} seats',
                                ].join(' · '),
                                onTap: () => context.push(
                                  '/colleges/detail',
                                  extra: {
                                    'universitySlug': u.slug,
                                    'universityName': u.name,
                                  },
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        SectionHeader(
                          title: 'Top Mentors',
                          onSeeAll: () => context.go('/mentors'),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        mentorsAsync.when(
                          loading: () => const Column(
                              children: [SkeletonCard(), SkeletonCard()]),
                          error: (_, __) => const SizedBox.shrink(),
                          data: (mentors) => Column(
                            children: mentors.take(3).map((m) {
                              return _MentorTeaser(
                                mentor: m,
                                onTap: () => context.go('/mentors'),
                              );
                            }).toList(),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xl),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _QuickCard extends StatelessWidget {
  const _QuickCard({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Column(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: const BoxDecoration(
              color: AppColors.primaryLight,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 22, color: AppColors.primary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            label,
            style: const TextStyle(
              fontSize: AppFont.xs,
              fontWeight: AppFont.bold,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _CollegeCard extends StatelessWidget {
  const _CollegeCard({required this.name, required this.sub, required this.onTap});

  final String name;
  final String sub;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: const Icon(Icons.account_balance_rounded,
                size: 20, color: AppColors.primary),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: AppFont.md,
                    fontWeight: AppFont.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  sub,
                  style: const TextStyle(
                    fontSize: AppFont.xs,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded,
              color: AppColors.textMuted, size: 22),
        ],
      ),
    );
  }
}

class _MentorTeaser extends StatelessWidget {
  const _MentorTeaser({required this.mentor, required this.onTap});

  final Mentor mentor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          AppAvatar(name: mentor.displayName, size: 44),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  mentor.displayName,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: AppFont.md,
                    fontWeight: AppFont.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    if (mentor.rating != null) ...[
                      const Icon(Icons.star_rounded,
                          size: 14, color: AppColors.warning),
                      const SizedBox(width: 2),
                      Text('${mentor.rating!.toStringAsFixed(1)} · ',
                          style: const TextStyle(
                              fontSize: AppFont.xs, color: AppColors.textSecondary)),
                    ],
                    Flexible(
                      child: Text(
                        mentor.university?.name ?? 'Mentor',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: AppFont.xs,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const StatusChip(
            label: 'Free chat',
            color: AppColors.primary,
          ),
        ],
      ),
    );
  }
}
