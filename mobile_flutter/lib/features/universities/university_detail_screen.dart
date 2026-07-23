import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/college_wishlist_api.dart';
import '../../core/network/universities_api.dart';
import '../../core/network/university_reviews_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import '../mentors/mentor_list_screen.dart';

final universityDetailProvider =
    FutureProvider.autoDispose.family<University, String>(
  (ref, slug) => ref.watch(universitiesApiProvider).getBySlug(slug),
);

String _typeLabel(String type) {
  switch (type) {
    case 'GOVERNMENT':
      return 'Government';
    case 'PRIVATE':
      return 'Private';
    case 'DEEMED':
      return 'Deemed';
    case 'CENTRAL':
      return 'Central';
    default:
      return type;
  }
}

class UniversityDetailScreen extends ConsumerStatefulWidget {
  const UniversityDetailScreen({
    super.key,
    required this.universitySlug,
    required this.universityName,
  });

  final String universitySlug;
  final String universityName;

  @override
  ConsumerState<UniversityDetailScreen> createState() => _UniversityDetailScreenState();
}

class _UniversityDetailScreenState extends ConsumerState<UniversityDetailScreen> {
  static const _tabs = <(String, String)>[
    ('overview', 'Overview'),
    ('mentors', 'Mentors'),
    ('reviews', 'Reviews'),
    ('questions', 'Q&A'),
    ('students', 'Students'),
    ('alumni', 'Alumni'),
  ];

  String _active = 'overview';

  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(universityDetailProvider(widget.universitySlug));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(widget.universityName),
        actions: [
          Consumer(
            builder: (context, ref, _) {
              final savedIds = ref.watch(savedCollegeIdsProvider).value;
              return detailAsync.maybeWhen(
                data: (uni) {
                  final saved = savedIds?.contains(uni.id) ?? false;
                  return IconButton(
                    onPressed: () => ref
                        .read(savedCollegeIdsProvider.notifier)
                        .toggle(uni.id),
                    icon: Icon(
                      saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                      color: saved ? AppColors.error : AppColors.textInverse,
                    ),
                    tooltip: 'Save college',
                  );
                },
                orElse: () => const SizedBox.shrink(),
              );
            },
          ),
        ],
      ),
      body: detailAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.primary)),
        error: (err, _) => EmptyState(
          icon: Icons.wifi_off_rounded,
          title: 'Could not load this college',
          message: 'Check your connection and try again.',
          actionLabel: 'Retry',
          onAction: () => ref.invalidate(universityDetailProvider(widget.universitySlug)),
        ),
        data: (uni) => Column(
          children: [
            _Hero(university: uni),
            _TabBar(
              tabs: _tabs,
              active: _active,
              onSelect: (id) => setState(() => _active = id),
            ),
            Expanded(
              child: SingleChildScrollView(
                child: _buildContent(context, uni),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, University uni) {
    switch (_active) {
      case 'mentors':
        return _MentorsTab(university: uni);
      case 'reviews':
        return _ReviewsTab(university: uni);
      case 'questions':
        return const _PlaceholderTab(
          icon: Icons.help_rounded,
          title: 'Questions & Answers',
          description: 'Questions about this university from prospective students.',
        );
      case 'students':
        return const _PlaceholderTab(
          icon: Icons.medical_services_rounded,
          title: 'Verified Students',
          description: 'Current students available for questions and chat.',
        );
      case 'alumni':
        return const _PlaceholderTab(
          icon: Icons.school_rounded,
          title: 'Alumni',
          description: 'Graduates and doctors from this institution.',
        );
      default:
        return _OverviewTab(university: uni);
    }
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.university});
  final University university;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            alignment: Alignment.center,
            child: const Icon(Icons.local_hospital_rounded,
                size: 28, color: AppColors.primary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            university.name,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: AppFont.xl,
              fontWeight: AppFont.extraBold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            [
              _typeLabel(university.type),
              university.city,
              if (university.nirfRank != null) 'Rank #${university.nirfRank}',
            ].join(' · '),
            style: const TextStyle(fontSize: AppFont.sm, color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _HeroStat(value: '${university.mbbsSeats ?? "—"}', label: 'Seats'),
              const SizedBox(width: AppSpacing.xl),
              _HeroStat(value: '${university.establishedYear ?? "—"}', label: 'Est.'),
              const SizedBox(width: AppSpacing.xl),
              _HeroStat(
                value: (university.programs?.length ?? 0).toString(),
                label: 'Programs',
              ),
              if (university.rating != null) ...[
                const SizedBox(width: AppSpacing.xl),
                _HeroStat(
                  value: '${university.rating!.toStringAsFixed(1)} ★',
                  label: '${university.reviewCount} reviews',
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            fontSize: AppFont.lg,
            fontWeight: AppFont.extraBold,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(label,
            style: const TextStyle(
                fontSize: AppFont.xs, color: AppColors.textSecondary)),
      ],
    );
  }
}

class _TabBar extends StatelessWidget {
  const _TabBar({
    required this.tabs,
    required this.active,
    required this.onSelect,
  });

  final List<(String, String)> tabs;
  final String active;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        child: Row(
          children: [
            for (final (id, label) in tabs)
              GestureDetector(
                onTap: () => onSelect(id),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: active == id
                            ? AppColors.primary
                            : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: AppFont.sm,
                      color: active == id
                          ? AppColors.primary
                          : AppColors.textSecondary,
                      fontWeight:
                          active == id ? AppFont.bold : AppFont.medium,
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

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.university});
  final University university;

  @override
  Widget build(BuildContext context) {
    final rows = <(String, String)>[
      ('Type', _typeLabel(university.type)),
      ('Location', '${university.city}, ${university.state}'),
      if (university.nirfRank != null) ('NIRF Rank', '#${university.nirfRank}'),
      if (university.mbbsSeats != null) ('MBBS Seats', '${university.mbbsSeats}'),
      if (university.establishedYear != null)
        ('Established', '${university.establishedYear}'),
      if (university.website != null) ('Website', university.website!),
    ];

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (university.description != null) ...[
            AppCard(
              child: Text(
                university.description!,
                style: const TextStyle(
                    fontSize: AppFont.sm, color: AppColors.textPrimary, height: 1.5),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          AppCard(
            child: Column(
              children: [
                for (var i = 0; i < rows.length; i++)
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: i == rows.length - 1
                              ? Colors.transparent
                              : AppColors.border,
                        ),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(rows[i].$1,
                            style: const TextStyle(
                                fontSize: AppFont.sm,
                                color: AppColors.textSecondary)),
                        Flexible(
                          child: Text(rows[i].$2,
                              textAlign: TextAlign.right,
                              style: const TextStyle(
                                  fontSize: AppFont.sm,
                                  fontWeight: AppFont.semibold,
                                  color: AppColors.textPrimary)),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          if (university.programs != null && university.programs!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            const Text('Programs offered',
                style: TextStyle(fontSize: AppFont.md, fontWeight: AppFont.bold)),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final p in university.programs!)
                  StatusChip(label: p.name, color: AppColors.primary),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _MentorsTab extends ConsumerWidget {
  const _MentorsTab({required this.university});
  final University university;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mentorsAsync = ref.watch(mentorsByUniversityProvider(university.id));

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: mentorsAsync.when(
        loading: () => const Column(children: [SkeletonCard(), SkeletonCard()]),
        error: (err, _) => const EmptyState(
          icon: Icons.wifi_off_rounded,
          title: 'Could not load mentors',
          message: 'Pull to refresh to try again.',
        ),
        data: (mentors) => mentors.isEmpty
            ? const EmptyState(
                icon: Icons.people_alt_rounded,
                title: 'No mentors yet',
                message: 'Verified mentors from this college will appear here.',
              )
            : Column(
                children: [for (final m in mentors) MentorCard(mentor: m)],
              ),
      ),
    );
  }
}

class _ReviewsTab extends ConsumerWidget {
  const _ReviewsTab({required this.university});
  final University university;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviewsAsync = ref.watch(universityReviewsListProvider(university.id));
    final hasReviewedAsync = ref.watch(hasReviewedUniversityProvider(university.id));

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasReviewedAsync.value == false)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  final posted = await showModalBottomSheet<bool>(
                    context: context,
                    backgroundColor: AppColors.surface,
                    isScrollControlled: true,
                    shape: const RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
                    ),
                    builder: (_) => _WriteReviewSheet(universityId: university.id),
                  );
                  if (posted == true) {
                    ref.invalidate(universityReviewsListProvider(university.id));
                    ref.invalidate(hasReviewedUniversityProvider(university.id));
                    ref.invalidate(universityDetailProvider(university.slug));
                  }
                },
                icon: const Icon(Icons.edit_rounded, size: 18),
                label: const Text('Write a review'),
              ),
            ),
          if (hasReviewedAsync.value == true)
            const Padding(
              padding: EdgeInsets.only(bottom: AppSpacing.sm),
              child: Text(
                'You\'ve already reviewed this college.',
                style: TextStyle(fontSize: AppFont.sm, color: AppColors.textSecondary),
              ),
            ),
          const SizedBox(height: AppSpacing.md),
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
                    message: 'Be the first verified student or alumni to review.',
                  )
                : Column(
                    children: [for (final r in reviews) _ReviewCard(review: r)],
                  ),
          ),
        ],
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review});
  final UniversityReview review;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppAvatar(name: review.authorDisplayName, size: 32),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(review.authorDisplayName,
                    style: const TextStyle(
                        fontWeight: AppFont.bold, fontSize: AppFont.sm)),
              ),
              Row(
                children: [
                  const Icon(Icons.star_rounded, size: 16, color: AppColors.warning),
                  const SizedBox(width: 2),
                  Text('${review.overallRating}',
                      style: const TextStyle(
                          fontWeight: AppFont.bold, fontSize: AppFont.sm)),
                ],
              ),
            ],
          ),
          if (review.body != null && review.body!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(review.body!,
                style: const TextStyle(fontSize: AppFont.sm, height: 1.4)),
          ],
          if (review.pros != null && review.pros!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text('👍 ${review.pros}',
                style: const TextStyle(
                    fontSize: AppFont.xs, color: AppColors.success)),
          ],
          if (review.cons != null && review.cons!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text('👎 ${review.cons}',
                style: const TextStyle(fontSize: AppFont.xs, color: AppColors.error)),
          ],
        ],
      ),
    );
  }
}

class _WriteReviewSheet extends ConsumerStatefulWidget {
  const _WriteReviewSheet({required this.universityId});
  final String universityId;

  @override
  ConsumerState<_WriteReviewSheet> createState() => _WriteReviewSheetState();
}

class _WriteReviewSheetState extends ConsumerState<_WriteReviewSheet> {
  int _overallRating = 5;
  final _bodyController = TextEditingController();
  final _prosController = TextEditingController();
  final _consController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _bodyController.dispose();
    _prosController.dispose();
    _consController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(universityReviewsApiProvider).create(
            widget.universityId,
            overallRating: _overallRating,
            body: _bodyController.text.trim(),
            pros: _prosController.text.trim(),
            cons: _consController.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      setState(() {
        _submitting = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.lg + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(AppRadius.full),
                ),
              ),
            ),
            const Text('Write a review',
                style: TextStyle(
                    fontSize: AppFont.lg, fontWeight: AppFont.extraBold)),
            const SizedBox(height: AppSpacing.md),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 1; i <= 5; i++)
                  IconButton(
                    onPressed: () => setState(() => _overallRating = i),
                    icon: Icon(
                      i <= _overallRating ? Icons.star_rounded : Icons.star_border_rounded,
                      color: AppColors.warning,
                      size: 32,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _bodyController,
              maxLines: 4,
              maxLength: 3000,
              decoration: const InputDecoration(
                hintText: 'Share your experience — academics, faculty, campus life...',
                border: OutlineInputBorder(),
              ),
            ),
            TextField(
              controller: _prosController,
              maxLength: 1000,
              decoration: const InputDecoration(
                labelText: 'Pros (optional)',
                border: OutlineInputBorder(),
              ),
            ),
            TextField(
              controller: _consController,
              maxLength: 1000,
              decoration: const InputDecoration(
                labelText: 'Cons (optional)',
                border: OutlineInputBorder(),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(_error!,
                  style: const TextStyle(fontSize: AppFont.xs, color: AppColors.error)),
            ],
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Post review'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlaceholderTab extends StatelessWidget {
  const _PlaceholderTab({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl).copyWith(top: AppSpacing.xxl),
      child: EmptyState(icon: icon, title: title, message: description),
    );
  }
}
