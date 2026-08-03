import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/primary_button.dart';
import '../profile/avatar_picker_panel.dart';
import '../profile/profile_options.dart';
import 'onboarding_widgets.dart';

/// Post-signup 5-step wizard for ASPIRANT users — Basic Information →
/// Location → Academic Qualification → Stream/Field of Interest → Choose
/// Your Avatar. Runs once after role selection. Only the final avatar step
/// is skippable — the first four are mandatory, same as before.
///
/// No Date of Birth here (aspirant-only — the mentor wizard keeps its 16+
/// gate). Collects a real name (private, encrypted — same handling as the
/// mentor wizard's Full Name) alongside the public pseudonym.
class AspirantOnboardingScreen extends ConsumerStatefulWidget {
  const AspirantOnboardingScreen({super.key});

  @override
  ConsumerState<AspirantOnboardingScreen> createState() =>
      _AspirantOnboardingScreenState();
}

class _AspirantOnboardingScreenState
    extends ConsumerState<AspirantOnboardingScreen> {
  final _pageController = PageController();
  final _avatarPanelKey = GlobalKey<AvatarPickerPanelState>();
  int _step = 0;
  bool _saving = false;

  final _fullNameController = TextEditingController();
  String? _gender;

  String? _state;
  final _cityController = TextEditingController();

  String? _qualification;
  String? _currentStatus;

  String? _stream;
  final _streamOtherController = TextEditingController();

  static const _stepTitles = [
    'Basic Information',
    'Location',
    'Academic Qualification',
    'Stream / Field of Interest',
    'Choose Your Avatar',
  ];
  static const _stepSubtitles = [
    'Core identity details.',
    'For regional mentor matching.',
    'Current or highest education level.',
    'Used for mentor matching.',
    'Pick a look — you can always change this later from your profile.',
  ];

  @override
  void dispose() {
    _pageController.dispose();
    _fullNameController.dispose();
    _cityController.dispose();
    _streamOtherController.dispose();
    super.dispose();
  }

  /// Gates the Continue button per step — previously an empty tap silently
  /// advanced with nothing entered despite the doc comment above claiming
  /// steps 0-3 are mandatory. Step 4 (avatar) stays unconditionally
  /// continuable — it's the one deliberately skippable step.
  bool get _canContinue {
    switch (_step) {
      case 0:
        return _fullNameController.text.trim().isNotEmpty && _gender != null;
      case 1:
        return _state != null && _cityController.text.trim().isNotEmpty;
      case 2:
        return _qualification != null && _currentStatus != null;
      case 3:
        return _stream != null &&
            (_stream != 'Others' || _streamOtherController.text.trim().isNotEmpty);
      default:
        return true;
    }
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

  /// [saveAvatar] is false when the user taps "Skip for now" on the final
  /// avatar step — the rest of the profile is still mandatory and saved
  /// either way, only the avatar customisation itself is optional.
  Future<void> _finish({bool saveAvatar = true}) async {
    setState(() => _saving = true);
    try {
      final resolvedStream = _stream == 'Others' &&
              _streamOtherController.text.trim().isNotEmpty
          ? _streamOtherController.text.trim()
          : _stream;
      await ref.read(usersApiProvider).updateProfile(
            realName: _fullNameController.text.trim().isEmpty
                ? null
                : _fullNameController.text.trim(),
            gender: _gender,
            state: _state,
            city: _cityController.text.trim().isEmpty
                ? null
                : _cityController.text.trim(),
            qualification: _qualification,
            stream: resolvedStream,
          );
      if (saveAvatar) {
        final avatarConfig = _avatarPanelKey.currentState?.currentConfig;
        if (avatarConfig != null) {
          try {
            await ref.read(usersApiProvider).updateAvatarConfig(avatarConfig);
          } catch (_) {
            // Non-fatal — avatar customisation is optional, profile data
            // above is what actually matters for this wizard to complete.
          }
        }
      }
      if (!mounted) return;
      ref.read(authControllerProvider.notifier).clearNeedsOnboarding();
      context.go('/home');
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Could not save: $e')));
    }
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
                      const OnboardingFieldLabel('Full Name'),
                      TextFormField(
                        controller: _fullNameController,
                        onChanged: (_) => setState(() {}),
                        decoration:
                            const InputDecoration(hintText: 'Enter your full name'),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      const Text(
                        'Real name stays private. Mentors only see your public alias.',
                        style: TextStyle(fontSize: AppFont.xs, color: AppColors.textMuted),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Gender'),
                      OnboardingSingleChipGroup(
                        options: kGenders,
                        selected: _gender,
                        onSelect: (v) => setState(() => _gender = v),
                      ),
                    ],
                  ),
                  OnboardingStepScaffold(
                    title: _stepTitles[1],
                    subtitle: _stepSubtitles[1],
                    children: [
                      const OnboardingFieldLabel('State'),
                      OnboardingDropdown(
                        value: _state,
                        hint: 'Select your state',
                        options: kIndianStates,
                        onChanged: (v) => setState(() => _state = v),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('City'),
                      TextFormField(
                        controller: _cityController,
                        onChanged: (_) => setState(() {}),
                        decoration:
                            const InputDecoration(hintText: 'Enter your city'),
                      ),
                    ],
                  ),
                  OnboardingStepScaffold(
                    title: _stepTitles[2],
                    subtitle: _stepSubtitles[2],
                    children: [
                      const OnboardingFieldLabel('Qualification Level'),
                      OnboardingSingleChipGroup(
                        options: kQualifications,
                        selected: _qualification,
                        onSelect: (v) => setState(() => _qualification = v),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Current Status'),
                      OnboardingSingleChipGroup(
                        options: kCurrentStatuses,
                        selected: _currentStatus,
                        onSelect: (v) => setState(() => _currentStatus = v),
                      ),
                    ],
                  ),
                  OnboardingStepScaffold(
                    title: _stepTitles[3],
                    subtitle: _stepSubtitles[3],
                    children: [
                      OnboardingSingleChipGroup(
                        options: kStreamOptions,
                        selected: _stream,
                        onSelect: (v) => setState(() => _stream = v),
                      ),
                      if (_stream == 'Others') ...[
                        const SizedBox(height: AppSpacing.sm),
                        TextFormField(
                          controller: _streamOtherController,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                              hintText: 'Tell us your field of interest'),
                        ),
                      ],
                    ],
                  ),
                  OnboardingStepScaffold(
                    title: _stepTitles[4],
                    subtitle: _stepSubtitles[4],
                    children: [
                      AvatarPickerPanel(
                          key: _avatarPanelKey,
                          initialGenderText: _gender,
                          startFromFirstOption: true),
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
                    enabled: _canContinue,
                    onPressed: _next,
                  ),
                  // Only the final avatar step is skippable — the profile
                  // fields on steps 0-3 are mandatory.
                  if (_step == _stepTitles.length - 1) ...[
                    const SizedBox(height: AppSpacing.sm),
                    TextButton(
                      onPressed: _saving ? null : () => _finish(saveAvatar: false),
                      child: const Text(
                        'Skip for now',
                        style: TextStyle(fontSize: AppFont.sm, color: AppColors.textMuted),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
