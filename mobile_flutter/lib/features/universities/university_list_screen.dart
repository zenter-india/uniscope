import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';

class _University {
  const _University(this.id, this.name, this.state, this.type, this.rank, this.seats);
  final String id;
  final String name;
  final String state;
  final String type;
  final int rank;
  final int seats;
}

const _placeholderData = <_University>[
  _University('1', 'AIIMS New Delhi', 'Delhi', 'Government', 1, 107),
  _University('2', 'CMC Vellore', 'Tamil Nadu', 'Private', 2, 100),
  _University('3', 'JIPMER Puducherry', 'Puducherry', 'Government', 3, 150),
  _University('4', 'AIIMS Jodhpur', 'Rajasthan', 'Government', 8, 125),
  _University('5', 'Kasturba Medical College', 'Karnataka', 'Deemed', 5, 250),
];

/// Port of RN `universities/UniversityListScreen.tsx`.
class UniversityListScreen extends StatefulWidget {
  const UniversityListScreen({super.key});

  @override
  State<UniversityListScreen> createState() => _UniversityListScreenState();
}

class _UniversityListScreenState extends State<UniversityListScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final filtered = _placeholderData
        .where((u) => u.name.toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md, vertical: AppSpacing.sm),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        border: Border.all(color: AppColors.border),
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                      padding:
                          const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                      child: Row(
                        children: [
                          const Text('🔍', style: TextStyle(fontSize: 16)),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: TextField(
                              onChanged: (t) => setState(() => _query = t),
                              style: const TextStyle(
                                  fontSize: AppFont.md,
                                  color: AppColors.textPrimary),
                              decoration: const InputDecoration(
                                isDense: true,
                                border: InputBorder.none,
                                hintText: 'Search universities...',
                                hintStyle: TextStyle(color: AppColors.textMuted),
                                contentPadding: EdgeInsets.symmetric(
                                    vertical: AppSpacing.md),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    alignment: Alignment.center,
                    child: const Text('⚙️', style: TextStyle(fontSize: 18)),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Row(
                children: [
                  for (final f in const ['All', 'Government', 'Private', 'Deemed'])
                    Padding(
                      padding: const EdgeInsets.only(right: AppSpacing.sm),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md, vertical: AppSpacing.xs),
                        decoration: BoxDecoration(
                          color: f == 'All'
                              ? AppColors.primary
                              : AppColors.surface,
                          border: Border.all(
                            color: f == 'All'
                                ? AppColors.primary
                                : AppColors.border,
                          ),
                          borderRadius: BorderRadius.circular(AppRadius.full),
                        ),
                        child: Text(
                          f,
                          style: TextStyle(
                            fontSize: AppFont.sm,
                            color: f == 'All'
                                ? AppColors.textInverse
                                : AppColors.textSecondary,
                            fontWeight:
                                f == 'All' ? AppFont.medium : AppFont.regular,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md, 0, AppSpacing.md, AppSpacing.xl),
                itemCount: filtered.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: AppSpacing.sm),
                itemBuilder: (_, i) => _UniversityCard(
                  university: filtered[i],
                  onTap: () => context.go(
                    '/colleges/detail',
                    extra: {
                      'universityId': filtered[i].id,
                      'universityName': filtered[i].name,
                    },
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

class _UniversityCard extends StatelessWidget {
  const _UniversityCard({required this.university, required this.onTap});

  final _University university;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isGov = university.type == 'Government';
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              alignment: Alignment.center,
              child: Text(
                '#${university.rank}',
                style: const TextStyle(
                  fontSize: AppFont.sm,
                  fontWeight: AppFont.bold,
                  color: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    university.name,
                    style: const TextStyle(
                      fontSize: AppFont.md,
                      fontWeight: AppFont.semibold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '${university.state} · ${university.seats} seats',
                    style: const TextStyle(
                      fontSize: AppFont.sm,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
              decoration: BoxDecoration(
                color: isGov ? AppColors.primaryLight : AppColors.background,
                border: Border.all(
                    color: isGov ? AppColors.primary : AppColors.border),
                borderRadius: BorderRadius.circular(AppRadius.full),
              ),
              child: Text(
                university.type,
                style: const TextStyle(
                  fontSize: AppFont.xs,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
