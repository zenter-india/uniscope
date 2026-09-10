import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart' show UserRole;
import '../../widgets/app_widgets.dart';
import '../auth/onboarding_widgets.dart';
import 'profile_options.dart';

/// Profile Details (route `/profile/edit`). Per explicit client decision
/// (2026-09-06), most profile fields are read-only after sign-up — changes
/// go through support. **One deliberate exception (2026-09-07, per explicit
/// follow-up request):** a MENTOR keeps a small editable set that
/// legitimately changes over time — year of study / graduation year (+ its
/// privacy toggle), bio, languages, and preferred call-time slots — because
/// those are exactly the things a real mentor's situation moves on (a new
/// academic year, a better bio, more languages, a schedule change), unlike
/// name/DOB/college/degree which are fixed identity facts set once at
/// verification. An ASPIRANT has no editable fields at all; their block
/// below stays the plain read-only `_DetailRow` list. The avatar stays
/// editable for both roles (the pencil badge → `/profile/avatar`).
class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _bioController = TextEditingController();
  final _graduationYearController = TextEditingController();
  final _upiController = TextEditingController();
  String? _currentStatus;
  String? _yearOfStudyLabel;
  bool _yearInfoPrivate = false;
  final Set<String> _languages = {};
  // A saved language that isn't one of kLanguageOptions' fixed values is a
  // previously-typed "Others" answer (see _save's mapping below — the
  // literal "Others" is never itself stored, it's replaced by what was
  // typed).
  final _languagesOtherController = TextEditingController();
  final Set<String> _timings = {};
  bool _loaded = false;
  bool _saving = false;

  void _hydrate(UserProfile profile) {
    if (_loaded) return;
    _loaded = true;
    _bioController.text = profile.bio ?? '';
    _upiController.text = profile.upiId ?? '';
    if (profile.graduationYear != null) {
      _currentStatus = 'Graduated';
      _graduationYearController.text = '${profile.graduationYear}';
    } else if (profile.yearOfStudy != null) {
      _currentStatus = 'Currently Studying';
      final index = profile.yearOfStudy! - 1;
      if (index >= 0 && index < kYearsOfStudy.length) {
        _yearOfStudyLabel = kYearsOfStudy[index];
      }
    }
    _yearInfoPrivate = profile.yearInfoPrivate;
    final customLanguages = profile.languages
        .where((l) => !kLanguageOptions.contains(l))
        .toList();
    _languages.addAll(profile.languages.where(kLanguageOptions.contains));
    if (customLanguages.isNotEmpty) {
      _languages.add('Others');
      _languagesOtherController.text = customLanguages.join(', ');
    }
    _timings.addAll(profile.availableDays);
  }

  @override
  void dispose() {
    _bioController.dispose();
    _graduationYearController.dispose();
    _upiController.dispose();
    _languagesOtherController.dispose();
    super.dispose();
  }

  int? _yearOfStudyValue() {
    if (_yearOfStudyLabel == null) return null;
    final index = kYearsOfStudy.indexOf(_yearOfStudyLabel!);
    return index == -1 ? null : index + 1;
  }

  static final _upiPattern = RegExp(r'^[\w.\-]{2,256}@[a-zA-Z][\w.\-]{1,63}$');

  Future<void> _save() async {
    final upi = _upiController.text.trim();
    if (upi.isNotEmpty && !_upiPattern.hasMatch(upi)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid UPI ID, e.g. name@bank')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final resolvedLanguages = _languages
          .map((l) => l == 'Others' ? _languagesOtherController.text.trim() : l)
          .where((l) => l.isNotEmpty)
          .toList();
      await ref
          .read(usersApiProvider)
          .updateProfile(
            bio: _bioController.text.trim(),
            languages: resolvedLanguages,
            availableDays: _timings.toList(),
            // "" clears any saved UPI ID; a VPA sets it.
            upiId: upi,
            yearInfoPrivate: _yearInfoPrivate,
            yearOfStudy: _currentStatus == 'Currently Studying'
                ? _yearOfStudyValue()
                : null,
            graduationYear: _currentStatus == 'Graduated'
                ? int.tryParse(_graduationYearController.text.trim())
                : null,
          );
      ref.invalidate(myProfileProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Profile updated')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not save: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(myProfileProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Profile Details')),
      body: profileAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (err, _) => EmptyState(
          icon: Icons.wifi_off_rounded,
          title: 'Could not load your profile',
          message: 'Check your connection and try again.',
          actionLabel: 'Retry',
          onAction: () => ref.invalidate(myProfileProvider),
        ),
        data: (profile) {
          final isMentor = profile.role == UserRole.mentor;
          if (isMentor) _hydrate(profile);

          final rows = <(String, String)>[
            ('Display name', profile.displayName),
            if (profile.uniqueId != null) ('ID', profile.uniqueId!),
            if ((profile.gender ?? '').isNotEmpty) ('Gender', profile.gender!),
            if (isMentor)
              ('Field of study', _orDash(profile.stream))
            else ...[
              ('Qualification', _orDash(profile.qualification)),
              ('Field of interest', _orDash(profile.stream)),
              // Only set once a qualification beyond "Higher Secondary
              // (12th)" is picked in onboarding (see AspirantOnboarding
              // Screen's Academics step) — a 12th-grader has no college yet,
              // so this row just doesn't appear for them rather than
              // showing a dash.
              if (profile.universityName != null)
                ('College', profile.universityName!),
              ('State', _orDash(profile.state)),
              ('City', _orDash(profile.city)),
            ],
          ];

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.only(
                  top: AppSpacing.md,
                  bottom: AppSpacing.sm,
                ),
                child: Center(
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      AppAvatar(
                        name: profile.displayName,
                        size: 72,
                        avatarUrl: profile.avatarUrl,
                      ),
                      // Avatar stays editable even though most fields don't.
                      Positioned(
                        bottom: -2,
                        right: -2,
                        child: Material(
                          color: AppColors.primary,
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: () => context.push('/profile/avatar'),
                            child: const Padding(
                              padding: EdgeInsets.all(6),
                              child: Icon(
                                Icons.edit_rounded,
                                size: 14,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppCard(
                        padding: EdgeInsets.zero,
                        child: Column(
                          children: [
                            for (var i = 0; i < rows.length; i++)
                              _DetailRow(
                                label: rows[i].$1,
                                value: rows[i].$2,
                                isLast: i == rows.length - 1 && !isMentor,
                              ),
                          ],
                        ),
                      ),
                      if (isMentor) ...[
                        const SizedBox(height: AppSpacing.md),
                        const OnboardingFieldLabel('Current status'),
                        OnboardingSingleChipGroup(
                          options: kCurrentStatuses,
                          selected: _currentStatus,
                          onSelect: (v) => setState(() => _currentStatus = v),
                        ),
                        if (_currentStatus == 'Currently Studying') ...[
                          const SizedBox(height: AppSpacing.md),
                          const OnboardingFieldLabel('Year of study'),
                          OnboardingSingleChipGroup(
                            options: kYearsOfStudy,
                            selected: _yearOfStudyLabel,
                            onSelect: (v) =>
                                setState(() => _yearOfStudyLabel = v),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          OnboardingToggle(
                            value: _yearInfoPrivate,
                            onChanged: (v) =>
                                setState(() => _yearInfoPrivate = v),
                            label: 'Keep my year of study private',
                            hint:
                                'When on, this stays anonymous and isn\'t shown publicly on your profile.',
                          ),
                        ],
                        if (_currentStatus == 'Graduated') ...[
                          const SizedBox(height: AppSpacing.md),
                          const OnboardingFieldLabel('Year of graduation'),
                          TextFormField(
                            controller: _graduationYearController,
                            keyboardType: TextInputType.number,
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(
                              hintText: 'e.g. 2023',
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          OnboardingToggle(
                            value: _yearInfoPrivate,
                            onChanged: (v) =>
                                setState(() => _yearInfoPrivate = v),
                            label: 'Keep my graduation year private',
                            hint:
                                'When on, this stays anonymous and isn\'t shown publicly on your profile.',
                          ),
                        ],
                        const SizedBox(height: AppSpacing.md),
                        const OnboardingFieldLabel('Bio'),
                        TextField(
                          controller: _bioController,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            hintText:
                                'A short introduction for aspirants browsing mentors',
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        const OnboardingFieldLabel('Languages'),
                        OnboardingChipGroup(
                          options: kLanguageOptions,
                          selected: _languages,
                          onToggle: (option, value) => setState(() {
                            if (value) {
                              _languages.add(option);
                            } else {
                              _languages.remove(option);
                            }
                          }),
                        ),
                        if (_languages.contains('Others')) ...[
                          const SizedBox(height: AppSpacing.sm),
                          TextField(
                            controller: _languagesOtherController,
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(
                              hintText: 'Enter language',
                            ),
                          ),
                        ],
                        const SizedBox(height: AppSpacing.md),
                        const OnboardingFieldLabel(
                          'Available time slot (choose up to 2)',
                        ),
                        OnboardingChipGroup(
                          options: kTimeSlots,
                          selected: _timings,
                          maxSelections: 2,
                          onToggle: (option, value) => setState(() {
                            if (value) {
                              _timings.add(option);
                            } else {
                              _timings.remove(option);
                            }
                          }),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        const OnboardingFieldLabel('Payout UPI ID'),
                        TextField(
                          controller: _upiController,
                          keyboardType: TextInputType.emailAddress,
                          autocorrect: false,
                          decoration: const InputDecoration(
                            hintText: 'yourname@bank',
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          'Weekly payouts are sent to this UPI ID. Add one '
                          'before requesting a withdrawal.',
                          style: TextStyle(
                            fontSize: AppFont.xs,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: _saving ? null : _save,
                            child: _saving
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text('Save changes'),
                          ),
                        ),
                      ] else ...[
                        const SizedBox(height: AppSpacing.md),
                        const Text(
                          'These details were set during sign-up and can\'t '
                          'be changed here. Your profile photo is the '
                          'exception — tap the pencil above to update it.',
                          style: TextStyle(
                            fontSize: AppFont.xs,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.xl),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

String _orDash(String? v) => (v ?? '').trim().isEmpty ? '—' : v!.trim();

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.isLast = false,
  });

  final String label;
  final String value;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: AppFont.sm,
                fontWeight: AppFont.semibold,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
