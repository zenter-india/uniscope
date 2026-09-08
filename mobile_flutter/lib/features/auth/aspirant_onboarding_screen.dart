import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/universities_api.dart';
import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/primary_button.dart';
import '../profile/avatar_picker_panel.dart';
import '../profile/profile_options.dart';
import 'college_search_field.dart';
import 'onboarding_widgets.dart';

/// Post-signup 5-step wizard for ASPIRANT users — Basic Information →
/// Location → Academics → Preferences → Choose Your Avatar. Runs once after
/// role selection. Only the final avatar step is skippable — the rest are
/// mandatory.
///
/// **Academics (2026-09-07 rework)** replaces what used to be two separate
/// steps ("Academic Qualification" then "Stream / Field of Interest") with
/// one step ordered and gated the same way the web enrollment form's own
/// "Academics" step (AspirantForm.tsx) already works: Field of interest is
/// picked first, Current qualification's options then depend on it
/// (`degreesForStream`, "Higher Secondary (12th)" always prepended since a
/// 12th-grader hasn't picked a track yet), then College + Specialization
/// show once qualification isn't 12th — reusing the same `CollegeSearchField`
/// find-or-create pattern the mentor onboarding wizard already uses for its
/// own College field. "Course you're aiming for" moved here too, matching
/// the website (it was never really a "preference"). The old separate
/// "Current Status" chip (Currently Studying/Graduated) is dropped entirely
/// — the website's aspirant form never asked it, and tracing `_finish()`
/// showed the old mobile-only field was never actually sent to the backend
/// either, so nothing regresses by removing it.
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
  bool _resolvingCollege = false;
  bool _ageConfirmed = false;

  final _fullNameController = TextEditingController();
  String? _gender;

  String? _state;
  final _stateOtherController = TextEditingController();
  String? _city;
  final _cityOtherController = TextEditingController();

  String? _qualification;
  final _qualificationOtherController = TextEditingController();

  String? _stream;
  final _streamOtherController = TextEditingController();

  String? _universityId;
  final _collegeNameController = TextEditingController();
  String? _specialization;

  final _courseInterestedController = TextEditingController();
  final Set<String> _preferredLanguages = {};
  final _preferredLanguageOtherController = TextEditingController();
  final Set<String> _preferredTimings = {};

  static const _stepTitles = [
    'Basic Information',
    'Location',
    'Academics',
    'Preferences',
    'Choose Your Avatar',
  ];
  static const _stepSubtitles = [
    'Core identity details.',
    'Helps us suggest mentors from your region.',
    'What stage are you at, and what are you aiming for?',
    'Helps us find the right mentors for you.',
    'Pick a look — you can always change this later from your profile.',
  ];

  @override
  void dispose() {
    _pageController.dispose();
    _fullNameController.dispose();
    _stateOtherController.dispose();
    _cityOtherController.dispose();
    _qualificationOtherController.dispose();
    _streamOtherController.dispose();
    _collegeNameController.dispose();
    _courseInterestedController.dispose();
    _preferredLanguageOtherController.dispose();
    super.dispose();
  }

  bool get _showCollege =>
      _qualification != null && _qualification != 'Higher Secondary (12th)';

  /// Backend curated key for the picked stream+qualification, or null when
  /// that combination has no per-college dataset (see
  /// [kCuratedDegreeMapByStream]). Drives both the College picker (curated
  /// list, with district in the label) and the Specialization options.
  String? get _curatedDegree => curatedDegreeKey(_stream, _qualification);

  /// `level` for the *general* (non-curated) college search — an undergrad
  /// medical/dental degree searches only UG-tagged colleges, matching the
  /// web forms' COLLEGE_SEARCH_LEVEL_MAP / Medical-MBBS handling.
  String? get _collegeLevel {
    if (_stream == 'Medical' && _qualification == 'MBBS') return 'UG';
    if (_stream == 'Dental' && _qualification == 'BDS') return 'UG';
    return null;
  }

  bool get _needsMedicalStreamWideSpecialization =>
      _stream == 'Medical' &&
      (_qualification == 'Doctorate' || _qualification == 'Others');

  /// Specialization shows for any stream+degree that has real data behind it
  /// — a specific curated degree, or Medical's stream-wide union — but never
  /// for an undergraduate degree (MBBS / BDS / plain UG have no
  /// specialization concept), matching the web enrollment form.
  bool get _needsSpecialization {
    if (!_showCollege) return false;
    if (_qualification == 'MBBS' ||
        _qualification == 'BDS' ||
        _qualification == 'UG') {
      return false;
    }
    return _curatedDegree != null || _needsMedicalStreamWideSpecialization;
  }

  List<String> _specializationOptions() {
    if (_needsMedicalStreamWideSpecialization) {
      final curatedDegrees =
          kCuratedDegreeMapByStream['Medical']!.values.toSet().toList();
      final fetched = ref.watch(
        streamWideSpecializationsProvider(
          (stream: 'Medical', curatedDegrees: curatedDegrees),
        ),
      );
      return {...kMedicalSpecializations, ...fetched.value ?? const []}.toList()
        ..sort();
    }
    if (_curatedDegree != null) {
      final fetched = ref
          .watch(specializationsForDegreeProvider(
            (stream: _stream!, degree: _curatedDegree!),
          ))
          .value ??
          const [];
      if (fetched.isNotEmpty) return fetched;
    }
    return _stream == 'Medical' ? kMedicalSpecializations : const [];
  }

  String get _resolvedCity =>
      _city == 'Other' ? _cityOtherController.text.trim() : (_city ?? '');

  String? get _resolvedState => _state == 'Other'
      ? (_stateOtherController.text.trim().isEmpty
          ? null
          : _stateOtherController.text.trim())
      : _state;

  /// Gates the Continue button per step — previously an empty tap silently
  /// advanced with nothing entered despite the doc comment above claiming
  /// steps 0-3 are mandatory. Step 4 (avatar) stays unconditionally
  /// continuable — it's the one deliberately skippable step.
  bool get _canContinue {
    switch (_step) {
      case 0:
        return _fullNameController.text.trim().isNotEmpty && _gender != null;
      case 1:
        return _state != null &&
            (_state != 'Other' ||
                _stateOtherController.text.trim().isNotEmpty) &&
            _city != null &&
            (_city != 'Other' || _cityOtherController.text.trim().isNotEmpty);
      case 2:
        final streamOk = _stream != null &&
            (_stream != 'Others' ||
                _streamOtherController.text.trim().isNotEmpty);
        final qualificationOk = _qualification != null &&
            (_qualification != 'Others' ||
                _qualificationOtherController.text.trim().isNotEmpty);
        final collegeOk =
            !_showCollege || _collegeNameController.text.trim().isNotEmpty;
        final specializationOk =
            !_needsSpecialization || _specialization != null;
        return streamOk && qualificationOk && collegeOk && specializationOk;
      case 3:
        return _preferredLanguages.isNotEmpty &&
            (!_preferredLanguages.contains('Others') ||
                _preferredLanguageOtherController.text.trim().isNotEmpty) &&
            _preferredTimings.isNotEmpty;
      default:
        return true;
    }
  }

  void _goTo(int step) {
    setState(() => _step = step);
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
    );
  }

  void _next() {
    if (_step == 2) {
      _resolveCollegeThenAdvance();
      return;
    }
    if (_step == _stepTitles.length - 1) {
      _finish();
      return;
    }
    _goTo(_step + 1);
  }

  /// Step back one page — every field's value lives in this State, so a
  /// half-filled wizard survives going back to fix something.
  void _back() {
    if (_step == 0 || _saving) return;
    _goTo(_step - 1);
  }

  /// Academics is the step that collects College — if a real one wasn't
  /// picked from the search suggestions, it needs to resolve (find-or-
  /// create) to a real University row before moving on, same pattern the
  /// mentor onboarding wizard uses (see MentorOnboardingScreen's own
  /// `_resolveCollegeThenSave`). Skipped entirely for a 12th-grade aspirant,
  /// who never sees the College field.
  Future<void> _resolveCollegeThenAdvance() async {
    if (!_showCollege || _universityId != null) {
      _goTo(_step + 1);
      return;
    }
    setState(() => _resolvingCollege = true);
    try {
      final university = await ref.read(universitiesApiProvider).findOrCreate(
            name: _collegeNameController.text.trim(),
            state: _resolvedState ?? '',
            city: _resolvedCity,
            stream:
                _stream == 'Others' ? _streamOtherController.text.trim() : _stream,
          );
      if (!mounted) return;
      setState(() {
        _universityId = university.id;
        _resolvingCollege = false;
      });
      _goTo(_step + 1);
    } catch (e) {
      if (!mounted) return;
      setState(() => _resolvingCollege = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Could not save your college: $e')));
    }
  }

  /// [saveAvatar] is false when the user taps "Skip for now" on the final
  /// avatar step — the rest of the profile is still mandatory and saved
  /// either way, only the avatar customisation itself is optional.
  Future<void> _finish({bool saveAvatar = true}) async {
    // Age-confirmation gate before the profile is actually submitted — both
    // "Finish" and "Skip for now" route through here. Asked once.
    if (!_ageConfirmed) {
      if (!await showAgeConfirmationDialog(context)) return;
      if (!mounted) return;
      _ageConfirmed = true;
    }
    setState(() => _saving = true);
    try {
      final resolvedStream = _stream == 'Others' &&
              _streamOtherController.text.trim().isNotEmpty
          ? _streamOtherController.text.trim()
          : _stream;
      final resolvedQualification = _qualification == 'Others' &&
              _qualificationOtherController.text.trim().isNotEmpty
          ? _qualificationOtherController.text.trim()
          : _qualification;
      await ref.read(usersApiProvider).updateProfile(
            realName: _fullNameController.text.trim().isEmpty
                ? null
                : _fullNameController.text.trim(),
            gender: _gender,
            state: _resolvedState,
            city: _resolvedCity.isEmpty ? null : _resolvedCity,
            qualification: resolvedQualification,
            specialization: _needsSpecialization ? _specialization : null,
            stream: resolvedStream,
            universityId: _showCollege ? _universityId : null,
            courseInterested: _courseInterestedController.text.trim().isEmpty
                ? null
                : _courseInterestedController.text.trim(),
            // Backend column is a single free-text string — multiple picks
            // join into one readable value, same pattern as the web
            // enrollment form.
            preferredLanguage: _preferredLanguages.isEmpty
                ? null
                : _preferredLanguages
                    .map((l) => l == 'Others'
                        ? _preferredLanguageOtherController.text.trim()
                        : l)
                    .where((l) => l.isNotEmpty)
                    .join(', '),
            preferredMentorshipTiming:
                _preferredTimings.isEmpty ? null : _preferredTimings.join(', '),
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
        // Back arrow appears from step 2 on — lets the user return to an
        // earlier step to fix something without restarting the wizard.
        leading: _step > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: _saving ? null : _back,
              )
            : null,
      ),
      body: PopScope(
        // Android system-back / edge swipe steps back through the wizard
        // instead of dropping out of onboarding entirely.
        canPop: _step == 0,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _back();
        },
        child: SafeArea(
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
                        // The district list depends entirely on which state
                        // this is, so a city picked under the old state
                        // almost never makes sense under the new one.
                        onChanged: (v) => setState(() {
                          _state = v;
                          _city = null;
                          _cityOtherController.clear();
                          if (v != 'Other') _stateOtherController.clear();
                        }),
                      ),
                      if (_state == 'Other') ...[
                        const SizedBox(height: AppSpacing.sm),
                        TextFormField(
                          controller: _stateOtherController,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                              hintText: 'Enter your state'),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('City'),
                      OnboardingDropdown(
                        value: _city,
                        hint: _state == null ? 'Select a state first' : 'Select your city',
                        enabled: _state != null,
                        options: [...?kStateDistricts[_state], 'Other'],
                        onChanged: (v) => setState(() => _city = v),
                      ),
                      if (_city == 'Other') ...[
                        const SizedBox(height: AppSpacing.sm),
                        TextFormField(
                          controller: _cityOtherController,
                          onChanged: (_) => setState(() {}),
                          decoration:
                              const InputDecoration(hintText: 'Enter your city'),
                        ),
                      ],
                    ],
                  ),
                  OnboardingStepScaffold(
                    title: _stepTitles[2],
                    subtitle: _stepSubtitles[2],
                    children: [
                      const OnboardingFieldLabel('Field of interest'),
                      OnboardingSingleChipGroup(
                        options: kStreamOptions,
                        selected: _stream,
                        // Qualification's options, and College/Specialization's
                        // data, are all stream-specific — the previously
                        // picked values may no longer be valid for the newly
                        // picked stream, so reset them (same reasoning the
                        // web AspirantForm's own Field-of-interest change
                        // handler uses).
                        onSelect: (v) => setState(() {
                          _stream = v;
                          _qualification = null;
                          _universityId = null;
                          _collegeNameController.clear();
                          _specialization = null;
                        }),
                      ),
                      if (_stream == 'Others') ...[
                        const SizedBox(height: AppSpacing.sm),
                        TextFormField(
                          controller: _streamOtherController,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                              hintText: 'Enter your field of interest'),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Current qualification'),
                      OnboardingSingleChipGroup(
                        options: [
                          'Higher Secondary (12th)',
                          ...degreesForStream(_stream),
                        ],
                        selected: _qualification,
                        onSelect: (v) => setState(() {
                          _qualification = v;
                          _universityId = null;
                          _collegeNameController.clear();
                          _specialization = null;
                        }),
                      ),
                      if (_qualification == 'Others') ...[
                        const SizedBox(height: AppSpacing.sm),
                        TextFormField(
                          controller: _qualificationOtherController,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                              hintText: 'Enter your qualification'),
                        ),
                      ],
                      if (_showCollege) ...[
                        const SizedBox(height: AppSpacing.md),
                        const OnboardingFieldLabel('College / university'),
                        CollegeSearchField(
                          // Keyed so switching stream/qualification rebuilds
                          // the field fresh (clears the old typed text + list)
                          // rather than reusing the previous data set's state.
                          key: ValueKey('${_stream}_$_qualification'),
                          initialText: _collegeNameController.text,
                          stream: _stream == 'Others'
                              ? _streamOtherController.text.trim()
                              : _stream,
                          curatedDegree: _curatedDegree,
                          level: _collegeLevel,
                          onPick: (universityId, text) => setState(() {
                            _universityId = universityId;
                            _collegeNameController.text = text;
                          }),
                        ),
                      ],
                      if (_needsSpecialization) ...[
                        const SizedBox(height: AppSpacing.md),
                        const OnboardingFieldLabel('Specialization'),
                        OnboardingSearchableField(
                          value: _specialization,
                          hint: 'Select specialization',
                          options: _specializationOptions(),
                          onChanged: (v) => setState(() => _specialization = v),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Course you\'re aiming for (optional)'),
                      TextFormField(
                        controller: _courseInterestedController,
                        onChanged: (_) => setState(() {}),
                        decoration:
                            const InputDecoration(hintText: 'e.g. MBBS, B.Tech, BL'),
                      ),
                    ],
                  ),
                  OnboardingStepScaffold(
                    title: _stepTitles[3],
                    subtitle: _stepSubtitles[3],
                    children: [
                      const OnboardingFieldLabel('Preferred Language'),
                      OnboardingChipGroup(
                        options: kLanguageOptions,
                        selected: _preferredLanguages,
                        onToggle: (option, value) => setState(() {
                          if (value) {
                            _preferredLanguages.add(option);
                          } else {
                            _preferredLanguages.remove(option);
                          }
                        }),
                      ),
                      if (_preferredLanguages.contains('Others')) ...[
                        const SizedBox(height: AppSpacing.sm),
                        TextFormField(
                          controller: _preferredLanguageOtherController,
                          onChanged: (_) => setState(() {}),
                          decoration:
                              const InputDecoration(hintText: 'Enter language'),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel(
                        'Preferred Timing (choose up to 2)',
                      ),
                      OnboardingChipGroup(
                        options: kTimeSlots,
                        selected: _preferredTimings,
                        // Capped at 2 (2026-09-07 per request) — matches the
                        // mentor onboarding wizard's own "Preferred Timing"
                        // step exactly (see mentor_onboarding_screen.dart).
                        maxSelections: 2,
                        onToggle: (option, value) => setState(() {
                          if (value) {
                            _preferredTimings.add(option);
                          } else {
                            _preferredTimings.remove(option);
                          }
                        }),
                      ),
                    ],
                  ),
                  OnboardingStepScaffold(
                    title: _stepTitles[4],
                    subtitle: _stepSubtitles[4],
                    expandedChild: StickyPreviewAvatarPicker(
                        panelKey: _avatarPanelKey,
                        initialGenderText: _gender,
                        startFromFirstOption: true),
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
                    loading: _saving || _resolvingCollege,
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
      ),
    );
  }
}
