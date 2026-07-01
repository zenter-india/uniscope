import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';

/// Port of RN `universities/UniversityDetailScreen.tsx`.
class UniversityDetailScreen extends StatefulWidget {
  const UniversityDetailScreen({
    super.key,
    required this.universityId,
    required this.universityName,
  });

  final String universityId;
  final String universityName;

  @override
  State<UniversityDetailScreen> createState() => _UniversityDetailScreenState();
}

class _UniversityDetailScreenState extends State<UniversityDetailScreen> {
  static const _tabs = <(String, String)>[
    ('overview', 'Overview'),
    ('reviews', 'Reviews'),
    ('questions', 'Q&A'),
    ('students', 'Students'),
    ('alumni', 'Alumni'),
  ];

  String _active = 'overview';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(widget.universityName)),
      body: Column(
        children: [
          _Hero(name: widget.universityName),
          _TabBar(
            tabs: _tabs,
            active: _active,
            onSelect: (id) => setState(() => _active = id),
          ),
          Expanded(
            child: SingleChildScrollView(
              child: _buildContent(context),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(BuildContext context) {
    switch (_active) {
      case 'reviews':
        return _PlaceholderTab(
          icon: '⭐',
          title: 'Reviews',
          description:
              'Verified student and alumni reviews will appear here.',
          actionLabel: 'Write a Review',
          onAction: () => context.go('/colleges/reviews'),
        );
      case 'questions':
        return _PlaceholderTab(
          icon: '❓',
          title: 'Questions & Answers',
          description:
              'Questions about this university from prospective students.',
          actionLabel: 'Ask a Question',
          onAction: () => context.go('/colleges/questions'),
        );
      case 'students':
        return _PlaceholderTab(
          icon: '🩺',
          title: 'Verified Students',
          description: 'Current students available for questions and chat.',
          onAction: () => context.go('/colleges/students'),
        );
      case 'alumni':
        return _PlaceholderTab(
          icon: '🎓',
          title: 'Alumni',
          description: 'Graduates and doctors from this institution.',
          onAction: () => context.go('/colleges/alumni'),
        );
      default:
        return const _OverviewTab();
    }
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.name});
  final String name;

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
            child: const Text('🏥', style: TextStyle(fontSize: 28)),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            name,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: AppFont.xl,
              fontWeight: AppFont.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Government · New Delhi · Rank #1',
            style: TextStyle(fontSize: AppFont.sm, color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              _HeroStat(value: '107', label: 'Seats'),
              SizedBox(width: AppSpacing.xl),
              _HeroStat(value: '1956', label: 'Est.'),
              SizedBox(width: AppSpacing.xl),
              _HeroStat(value: '4.8 ⭐', label: 'Rating'),
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
            fontWeight: AppFont.bold,
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
                          active == id ? AppFont.semibold : AppFont.medium,
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
  const _OverviewTab();

  static const _rows = <(String, String)>[
    ('Type', 'Government (Central)'),
    ('Location', 'Ansari Nagar, New Delhi'),
    ('NIRF Rank', '#1 (Medical)'),
    ('MBBS Seats', '107'),
    ('Established', '1956'),
    ('Affiliation', 'AIIMS Act, MCI recognised'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        children: [
          for (var i = 0; i < _rows.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: i == _rows.length - 1
                        ? Colors.transparent
                        : AppColors.border,
                  ),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(_rows[i].$1,
                      style: const TextStyle(
                          fontSize: AppFont.sm,
                          color: AppColors.textSecondary)),
                  Text(_rows[i].$2,
                      style: const TextStyle(
                          fontSize: AppFont.sm,
                          fontWeight: AppFont.medium,
                          color: AppColors.textPrimary)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _PlaceholderTab extends StatelessWidget {
  const _PlaceholderTab({
    required this.icon,
    required this.title,
    required this.description,
    this.actionLabel,
    this.onAction,
  });

  final String icon;
  final String title;
  final String description;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl).copyWith(top: AppSpacing.xxl),
      child: Column(
        children: [
          Text(icon, style: const TextStyle(fontSize: 40)),
          const SizedBox(height: AppSpacing.md),
          Text(title,
              style: const TextStyle(
                  fontSize: AppFont.lg,
                  fontWeight: AppFont.bold,
                  color: AppColors.textPrimary)),
          const SizedBox(height: AppSpacing.md),
          Text(description,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: AppFont.md,
                  color: AppColors.textSecondary,
                  height: 1.5)),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.md),
            GestureDetector(
              onTap: onAction,
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.xl, vertical: AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Text(actionLabel!,
                    style: const TextStyle(
                        color: AppColors.textInverse,
                        fontWeight: AppFont.semibold)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
