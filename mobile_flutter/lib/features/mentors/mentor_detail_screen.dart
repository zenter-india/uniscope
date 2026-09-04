import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/mentors_api.dart';
import '../../core/network/reviews_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../reports/safety_menu_sheet.dart';
import '../sessions/call_request_sheet.dart';
import 'pre_chat_confirm_sheet.dart';

final mentorDetailProvider =
    FutureProvider.autoDispose.family<Mentor, String>(
  (ref, mentorId) => ref.watch(mentorsApiProvider).getById(mentorId),
);

final mentorReviewsListProvider =
    FutureProvider.autoDispose.family<List<MentorReview>, String>(
  (ref, mentorId) => ref.watch(reviewsApiProvider).listForMentor(mentorId),
);

/// Read-only mentor profile: identity, track record, bio, expertise, and
/// reviews, over a persistent Chat / Call action bar. Reviews are written
/// from the post-session flow in SessionListScreen, never from here.
class MentorDetailScreen extends ConsumerWidget {
  const MentorDetailScreen({super.key, required this.mentorId});
  final String mentorId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mentorAsync = ref.watch(mentorDetailProvider(mentorId));

    return Scaffold(
      backgroundColor: AppColors.background,
      body: mentorAsync.when(
        loading: () => const _HeaderScaffold(
          child: Center(
              child: CircularProgressIndicator(color: AppColors.primary)),
        ),
        error: (err, _) => _HeaderScaffold(
          child: EmptyState(
            icon: Icons.wifi_off_rounded,
            title: 'Could not load this mentor',
            message: 'Check your connection and try again.',
            actionLabel: 'Retry',
            onAction: () => ref.invalidate(mentorDetailProvider(mentorId)),
          ),
        ),
        data: (mentor) => Column(
          children: [
            _GradientHeader(mentorId: mentor.id, mentorName: mentor.displayName),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md, 0, AppSpacing.md, AppSpacing.lg),
                child: Column(
                  // stretch, not start — otherwise cards whose content is
                  // narrow (the expertise Wrap) shrink-wrap instead of
                  // spanning the column.
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Previously floated up over the header via
                    // Transform.translate — that's a paint-only shift that
                    // doesn't reserve layout space, so it clipped the
                    // mentor's name under the header on shorter viewports.
                    const SizedBox(height: AppSpacing.md),
                    _IdentityCard(mentor: mentor),
                    _AboutCard(mentor: mentor),
                    const SizedBox(height: AppSpacing.md),
                    _ReviewsSection(
                        mentorId: mentorId, reviewCount: mentor.reviewCount),
                  ],
                ),
              ),
            ),
            _ActionBar(mentor: mentor),
          ],
        ),
      ),
    );
  }
}

/// Header + a plain body, for the loading and error states — keeps the
/// back button reachable even when the mentor never loads.
class _HeaderScaffold extends StatelessWidget {
  const _HeaderScaffold({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const _GradientHeader(),
        Expanded(child: child),
      ],
    );
  }
}

class _GradientHeader extends ConsumerWidget {
  const _GradientHeader({this.mentorId, this.mentorName});

  final String? mentorId;
  final String? mentorName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(gradient: AppGradients.canopy),
      padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.sm, AppSpacing.sm, AppSpacing.sm, AppSpacing.lg),
        child: Row(
          children: [
            IconButton(
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
              tooltip: 'Back',
            ),
            const Expanded(
              child: Text(
                'MENTOR PROFILE',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: AppFont.sm,
                  fontWeight: AppFont.bold,
                  letterSpacing: 1.4,
                ),
              ),
            ),
            if (mentorId != null && mentorName != null)
              IconButton(
                onPressed: () => showSafetyMenuSheet(
                  context,
                  ref,
                  userId: mentorId!,
                  userLabel: mentorName!,
                ),
                icon: const Icon(Icons.more_vert_rounded, color: Colors.white),
                tooltip: 'Report or block',
              )
            else
              // Balances the back button so the title stays optically
              // centred while the mentor data (and thus the menu) hasn't
              // loaded yet.
              const SizedBox(width: 48),
          ],
        ),
      ),
    );
  }
}

class _IdentityCard extends StatelessWidget {
  const _IdentityCard({required this.mentor});
  final Mentor mentor;

  String? get _affiliation {
    final parts = <String>[
      if (mentor.university != null) mentor.university!.name,
      if (mentor.yearOfStudy != null) 'Year ${mentor.yearOfStudy}',
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppAvatar(
                  name: mentor.displayName,
                  size: 76,
                  avatarUrl: mentor.avatarUrl),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      mentor.displayName,
                      style: const TextStyle(
                        fontSize: AppFont.xl,
                        fontWeight: AppFont.extraBold,
                        color: AppColors.textPrimary,
                        height: 1.15,
                      ),
                    ),
                    if (mentor.isVerified) ...[
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(AppRadius.full),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.verified_rounded,
                                size: 14, color: AppColors.primary),
                            SizedBox(width: 4),
                            Text(
                              'Verified student',
                              style: TextStyle(
                                fontSize: AppFont.xs,
                                fontWeight: AppFont.bold,
                                color: AppColors.primaryDark,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Align(
                      alignment: Alignment.centerLeft,
                      child:
                          CallAvailabilityChip(isAvailable: mentor.isAvailable),
                    ),
                    if (_affiliation != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        _affiliation!,
                        style: const TextStyle(
                          fontSize: AppFont.sm,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                    if (mentor.rating != null) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.star_rounded,
                              size: 18, color: AppColors.warning),
                          const SizedBox(width: 3),
                          Text(
                            mentor.rating!.toStringAsFixed(1),
                            style: const TextStyle(
                              fontSize: AppFont.md,
                              fontWeight: AppFont.extraBold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            '(${mentor.reviewCount} reviews)',
                            style: const TextStyle(
                              fontSize: AppFont.xs,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),
          // Only stats the backend can actually compute. The reference
          // design also showed "response rate" and "responds within X" —
          // nothing timestamps individual messages, so those are omitted
          // rather than invented.
          Row(
            children: [
              _TrackStat(
                icon: Icons.schedule_rounded,
                value: mentor.minutesMentored != null
                    ? '${mentor.minutesMentored}'
                    : '—',
                label: 'Minutes mentored',
              ),
              const _StatDivider(),
              _TrackStat(
                icon: Icons.people_alt_rounded,
                value: mentor.studentsHelped != null
                    ? '${mentor.studentsHelped}'
                    : '—',
                label: 'Students helped',
              ),
              const _StatDivider(),
              _TrackStat(
                icon: Icons.star_rounded,
                value: mentor.rating != null
                    ? mentor.rating!.toStringAsFixed(1)
                    : '—',
                label: mentor.reviewCount == 1
                    ? '1 review'
                    : '${mentor.reviewCount} reviews',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TrackStat extends StatelessWidget {
  const _TrackStat({
    required this.icon,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 18, color: AppColors.primary),
          const SizedBox(height: 5),
          Text(
            value,
            style: const TextStyle(
              fontSize: AppFont.md,
              fontWeight: AppFont.extraBold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: AppFont.xs,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatDivider extends StatelessWidget {
  const _StatDivider();

  @override
  Widget build(BuildContext context) =>
      Container(width: 1, height: 40, color: AppColors.border);
}

class _AboutCard extends StatelessWidget {
  const _AboutCard({required this.mentor});
  final Mentor mentor;

  @override
  Widget build(BuildContext context) {
    final hasBio = mentor.bio != null && mentor.bio!.trim().isNotEmpty;
    final hasSpecialty =
        mentor.specialty != null && mentor.specialty!.trim().isNotEmpty;
    // `stream` (college field of study) is the field new mentors set —
    // `specialty` only remains for mentors who onboarded before the
    // Areas-of-Guidance step was removed.
    final hasStream = !hasSpecialty &&
        mentor.stream != null &&
        mentor.stream!.trim().isNotEmpty;
    final hasExpertise = hasSpecialty || hasStream || mentor.languages.isNotEmpty;
    final hasDays = mentor.availableDays.isNotEmpty;

    if (!hasBio && !hasExpertise && !hasDays) return const SizedBox.shrink();

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasBio) ...[
            const Text(
              'About',
              style: TextStyle(
                fontSize: AppFont.md,
                fontWeight: AppFont.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              mentor.bio!,
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textPrimary,
                height: 1.5,
              ),
            ),
          ],
          if (hasBio && hasExpertise) const SizedBox(height: AppSpacing.md),
          if (hasExpertise) ...[
            const Text(
              'Can help with',
              style: TextStyle(
                fontSize: AppFont.md,
                fontWeight: AppFont.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (hasSpecialty)
                  _ExpertiseChip(
                    icon: Icons.school_rounded,
                    label: mentor.specialty!,
                  ),
                if (hasStream)
                  _ExpertiseChip(
                    icon: Icons.school_rounded,
                    label: mentor.stream!,
                  ),
                for (final language in mentor.languages)
                  _ExpertiseChip(
                    icon: Icons.translate_rounded,
                    label: language,
                  ),
              ],
            ),
          ],
          if (hasDays) ...[
            if (hasBio || hasExpertise) const SizedBox(height: AppSpacing.md),
            const Text(
              'Usually free on',
              style: TextStyle(
                fontSize: AppFont.md,
                fontWeight: AppFont.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            // Advisory only — the mentor said these are their typical days,
            // and nothing blocks a booking on any other day. Worded as a
            // habit ("usually") rather than a schedule so it can't be read
            // as a guarantee.
            Text(
              mentor.availableDays.join(' · '),
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ExpertiseChip extends StatelessWidget {
  const _ExpertiseChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(AppRadius.full),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.primary),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: AppFont.xs,
              fontWeight: AppFont.semibold,
              color: AppColors.primaryDark,
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewsSection extends ConsumerWidget {
  const _ReviewsSection({required this.mentorId, required this.reviewCount});
  final String mentorId;
  final int reviewCount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviewsAsync = ref.watch(mentorReviewsListProvider(mentorId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          reviewCount > 0 ? 'Reviews ($reviewCount)' : 'Reviews',
          style: const TextStyle(
            fontSize: AppFont.lg,
            fontWeight: AppFont.extraBold,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        reviewsAsync.when(
          loading: () => const Column(children: [SkeletonCard(), SkeletonCard()]),
          error: (err, _) => const EmptyState(
            icon: Icons.wifi_off_rounded,
            title: 'Could not load reviews',
            message: 'Pull to refresh to try again.',
          ),
          data: (reviews) => reviews.isEmpty
              ? const EmptyState(
                  icon: Icons.star_rounded,
                  title: 'No reviews yet',
                  message:
                      'Reviews appear here after aspirants complete a session.',
                )
              : Column(
                  children: [
                    for (final review in reviews) _ReviewTile(review: review),
                  ],
                ),
        ),
      ],
    );
  }
}

class _ReviewTile extends StatelessWidget {
  const _ReviewTile({required this.review});
  final MentorReview review;

  /// Coarse relative age — reviews are anonymous, so the date is the only
  /// context a reader gets about how current the feedback is.
  String get _age {
    final created = DateTime.tryParse(review.createdAt);
    if (created == null) return '';
    final days = DateTime.now().difference(created).inDays;
    if (days <= 0) return 'Today';
    if (days == 1) return 'Yesterday';
    if (days < 7) return '$days days ago';
    if (days < 30) {
      final weeks = (days / 7).floor();
      return weeks == 1 ? '1 week ago' : '$weeks weeks ago';
    }
    final months = (days / 30).floor();
    return months <= 1 ? '1 month ago' : '$months months ago';
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Reviewers stay anonymous by product design — no name, no
              // avatar initials that could identify them.
              Container(
                width: 30,
                height: 30,
                decoration: const BoxDecoration(
                  color: AppColors.primaryLight,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.person_rounded,
                    size: 16, color: AppColors.primary),
              ),
              const SizedBox(width: AppSpacing.sm),
              const Text(
                'Anonymous',
                style: TextStyle(
                  fontSize: AppFont.sm,
                  fontWeight: AppFont.semibold,
                  color: AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              for (var i = 0; i < 5; i++)
                Icon(
                  i < review.rating
                      ? Icons.star_rounded
                      : Icons.star_border_rounded,
                  size: 14,
                  color: AppColors.warning,
                ),
            ],
          ),
          if (review.comment != null && review.comment!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              review.comment!,
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textPrimary,
                height: 1.45,
              ),
            ),
          ],
          if (_age.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              _age,
              style: const TextStyle(
                fontSize: AppFont.xs,
                color: AppColors.textMuted,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ActionBar extends ConsumerWidget {
  const _ActionBar({required this.mentor});
  final Mentor mentor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Chat and call are both aspirant→mentor actions — a mentor (or admin)
    // landing on another mentor's profile has nothing to do down here, and
    // the Call button in particular would run a Uniminutes balance check
    // against a wallet that never funds calls. Hide the whole bar.
    final isAspirant =
        ref.watch(authControllerProvider).user?.role == UserRole.aspirant;
    if (!isAspirant) return const SizedBox.shrink();

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.sm),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => showPreChatConfirmSheet(
                        context,
                        ref,
                        mentorId: mentor.id,
                        mentorName: mentor.displayName,
                        mentorAvatarUrl: mentor.avatarUrl,
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        side: const BorderSide(color: AppColors.primary),
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadius.md),
                        ),
                      ),
                      icon: const Icon(Icons.forum_rounded, size: 18),
                      label: const Text(
                        'Chat',
                        style: TextStyle(fontWeight: AppFont.bold),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: mentor.isAvailable
                          ? () => showCallRequestSheet(
                                context,
                                ref,
                                mentorId: mentor.id,
                              )
                          : null,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadius.md),
                        ),
                      ),
                      icon: const Icon(Icons.call_rounded, size: 18),
                      label: Text(
                        mentor.isAvailable ? 'Call' : 'Calls off',
                        style: const TextStyle(fontWeight: AppFont.bold),
                      ),
                    ),
                  ),
                ],
              ),
              // Explains the disabled Call button at the exact moment it's
              // confusing, and makes the model explicit: chat never depends
              // on availability, calls do.
              if (!mentor.isAvailable) ...[
                const SizedBox(height: AppSpacing.xs),
                const Text(
                  "This mentor isn't taking call bookings right now. "
                  'You can still message them anytime.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: AppFont.xs,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
