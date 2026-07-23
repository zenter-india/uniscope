import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/primary_button.dart';
import '../profile/profile_options.dart';
import 'onboarding_widgets.dart';

/// Post-signup 3-step wizard for ASPIRANT users — "Tell us about you" →
/// "Academic Details" → "Preferences" — matching the Figma onboarding flow.
/// Runs once after ProfileSetupScreen's display-name step; skippable at any
/// point via the same "Skip for now" affordance used elsewhere in auth.
class AspirantOnboardingScreen extends ConsumerStatefulWidget {
  const AspirantOnboardingScreen({super.key});

  @override
  ConsumerState<AspirantOnboardingScreen> createState() =>
      _AspirantOnboardingScreenState();
}

class _AspirantOnboardingScreenState
    extends ConsumerState<AspirantOnboardingScreen> {
  final _pageController = PageController();
  int _step = 0;
  bool _saving = false;

  DateTime? _dateOfBirth;
  String? _gender;
  String? _state;
  String? _qualification;
  String? _currentStatus;
  String? _stream;
  String? _courseInterested;
  String? _preferredLanguage;
  String? _preferredTiming;
  final Set<String> _goals = {};

  static const _stepTitles = [
    'Tell us about you',
    'Academic Details',
    'Preferences',
  ];
  static const _stepSubtitles = [
    'Help us personalize your college recommendations and mentor experience.',
    'This helps us recommend relevant mentors and colleges.',
    'This helps us recommend relevant mentors and colleges.',
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _next() {
    if (_step == _stepTitles.length - 1) {
      _finish();
      return;
    }
    setState(() => _step++);
    _pageController.animateToPage(
      _step,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
    );
  }

  void _skip() {
    if (!mounted) return;
    context.go('/home');
  }

  Future<void> _finish() async {
    setState(() => _saving = true);
    try {
      await ref.read(usersApiProvider).updateProfile(
            gender: _gender,
            state: _state,
            qualification: _qualification,
            stream: _stream,
            goals: _goals.toList(),
            dateOfBirth: _dateOfBirth?.toIso8601String().substring(0, 10),
            courseInterested: _courseInterested,
            preferredLanguage: _preferredLanguage,
            preferredMentorshipTiming: _preferredTiming,
          );
      if (!mounted) return;
      context.go('/home');
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Could not save: $e')));
    }
  }

  Future<void> _pickDateOfBirth() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 18, now.month, now.day),
      firstDate: DateTime(now.year - 80),
      lastDate: now,
    );
    if (picked != null) setState(() => _dateOfBirth = picked);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: Text('Step ${_step + 1} of ${_stepTitles.length}'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: Column(
          children: [
            OnboardingProgressBar(step: _step, total: _stepTitles.length),
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  OnboardingStepScaffold(
                    title: _stepTitles[0],
                    subtitle: _stepSubtitles[0],
                    children: [
                      const OnboardingFieldLabel('Date of Birth'),
                      OnboardingDateField(
                        value: _dateOfBirth,
                        onTap: _pickDateOfBirth,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Gender'),
                      OnboardingDropdown(
                        value: _gender,
                        hint: 'Select gender',
                        options: kGenders,
                        onChanged: (v) => setState(() => _gender = v),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('State'),
                      OnboardingDropdown(
                        value: _state,
                        hint: 'Select state',
                        options: kIndianStates,
                        onChanged: (v) => setState(() => _state = v),
                      ),
                    ],
                  ),
                  OnboardingStepScaffold(
                    title: _stepTitles[1],
                    subtitle: _stepSubtitles[1],
                    children: [
                      const OnboardingFieldLabel('Qualification Level'),
                      OnboardingDropdown(
                        value: _qualification,
                        hint: 'Select qualification',
                        options: kQualifications,
                        onChanged: (v) => setState(() => _qualification = v),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Current Status'),
                      OnboardingDropdown(
                        value: _currentStatus,
                        hint: 'Select current status',
                        options: kCurrentStatuses,
                        onChanged: (v) => setState(() => _currentStatus = v),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Stream / Field of Interest'),
                      OnboardingDropdown(
                        value: _stream,
                        hint: 'Select stream',
                        options: kStreams,
                        onChanged: (v) => setState(() => _stream = v),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Course Interested'),
                      OnboardingDropdown(
                        value: _courseInterested,
                        hint: 'Select course',
                        options: kCoursesInterested,
                        onChanged: (v) => setState(() => _courseInterested = v),
                      ),
                    ],
                  ),
                  OnboardingStepScaffold(
                    title: _stepTitles[2],
                    subtitle: _stepSubtitles[2],
                    children: [
                      const OnboardingFieldLabel('Preferred Language'),
                      OnboardingDropdown(
                        value: _preferredLanguage,
                        hint: 'Select language',
                        options: kLanguageOptions,
                        onChanged: (v) => setState(() => _preferredLanguage = v),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Goal / Aspiration'),
                      OnboardingChipGroup(
                        options: kGoalOptions,
                        selected: _goals,
                        onToggle: (goal, v) => setState(
                            () => v ? _goals.add(goal) : _goals.remove(goal)),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Preferred Mentorship Timing'),
                      OnboardingDropdown(
                        value: _preferredTiming,
                        hint: 'Select preferred timing',
                        options: kMentorshipTimings,
                        onChanged: (v) => setState(() => _preferredTiming = v),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.xl, 0, AppSpacing.xl, AppSpacing.xl),
              child: Column(
                children: [
                  PrimaryButton(
                    label: _step == _stepTitles.length - 1 ? 'Finish' : 'Continue',
                    loading: _saving,
                    onPressed: _next,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextButton(
                    onPressed: _saving ? null : _skip,
                    child: const Text(
                      'Skip for now',
                      style: TextStyle(fontSize: AppFont.sm, color: AppColors.textMuted),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
