import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/network/universities_api.dart';
import '../../core/network/users_api.dart';
import '../../core/network/verification_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../../widgets/primary_button.dart';
import '../profile/avatar_picker_panel.dart';
import '../profile/profile_options.dart';
import 'onboarding_widgets.dart';

/// Post-signup wizard for MENTOR users — Basic Information → Location →
/// Current Status → College Details → Choose Your Avatar → identity
/// verification. Uniscope mentors span every academic stream now (not just
/// medical — see CLAUDE.md), so this collects a real name up front rather
/// than relying solely on an auto-generated pseudonym, and the old
/// Areas-of-Guidance step is gone: discovery now filters by `stream`
/// (college field of study) instead of a curated topic list.
///
/// Reached via RoleSelectionScreen -> ProfileSetupScreen (display name,
/// shared with aspirants) -> here. Ends by going straight home; there's
/// nothing left to collect.
///
/// The avatar step and the verification step each have their own "Skip for
/// now" — neither is mandatory, and both stay reachable later from Profile
/// (the pencil badge on the avatar, and the Verification screen).
class MentorOnboardingScreen extends ConsumerStatefulWidget {
  const MentorOnboardingScreen({super.key});

  @override
  ConsumerState<MentorOnboardingScreen> createState() =>
      _MentorOnboardingScreenState();
}

class _MentorOnboardingScreenState extends ConsumerState<MentorOnboardingScreen> {
  final _pageController = PageController();
  final _avatarPanelKey = GlobalKey<AvatarPickerPanelState>();
  int _step = 0;
  bool _saving = false;
  bool _verificationSubmitted = false;

  final _fullNameController = TextEditingController();
  String? _gender;

  String? _state;
  final _cityController = TextEditingController();

  University? _university;
  final _collegeNameController = TextEditingController();
  bool _resolvingCollege = false;
  String? _stream;
  final _streamOtherController = TextEditingController();
  String? _degree;

  String? _currentStatus;
  String? _yearOfStudyLabel;
  final _graduationYearController = TextEditingController();

  DocumentType _docType = DocumentType.studentId;
  Uint8List? _imageBytes;

  static const _stepTitles = [
    'Basic Information',
    'Location',
    'Current Status',
    'College Details',
    'Choose Your Avatar',
    'Verify it\'s really you',
  ];
  static const _stepSubtitles = [
    'Core identity details.',
    'For regional aspirant matching.',
    'Are you still studying or graduated?',
    'Your institution and degree.',
    'Pick a look — you can always change this later from your profile.',
    'Help us confirm your college identity and build trust with aspirants.',
  ];

  @override
  void dispose() {
    _pageController.dispose();
    _fullNameController.dispose();
    _cityController.dispose();
    _collegeNameController.dispose();
    _streamOtherController.dispose();
    _graduationYearController.dispose();
    super.dispose();
  }

  /// Gates the Continue button per step — steps 0-3 collect the mandatory
  /// profile data every mentor needs before they're discoverable at all
  /// (see the "Skip is only offered on avatar/verification" comment below),
  /// so previously an empty Continue tap silently advanced with nothing
  /// saved. Step 4 (avatar) and step 5 (verification, already gated above)
  /// are unaffected.
  bool get _canContinue {
    switch (_step) {
      case 0:
        return _fullNameController.text.trim().isNotEmpty && _gender != null;
      case 1:
        return _state != null && _cityController.text.trim().isNotEmpty;
      case 2:
        if (_currentStatus == 'Currently Studying') {
          return _yearOfStudyLabel != null;
        }
        if (_currentStatus == 'Graduated') {
          return int.tryParse(_graduationYearController.text.trim()) != null;
        }
        return false;
      case 3:
        final streamOk = _stream != null &&
            (_stream != 'Others' || _streamOtherController.text.trim().isNotEmpty);
        final collegeOk = _stream == 'Medical'
            ? _university != null
            : _collegeNameController.text.trim().isNotEmpty;
        return _degree != null && streamOk && collegeOk;
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
    if (_step == 3) {
      _resolveCollegeThenSave();
      return;
    }
    if (_step == 4) {
      _continueFromAvatar();
      return;
    }
    if (_step == 5) {
      _submitVerification();
      return;
    }
    _goTo(_step + 1);
  }

  /// College Details is the last data-collection step (index 3) — for
  /// non-Medical streams, the typed college name needs to resolve (find-or-
  /// create) to a real University row before the profile save, since
  /// verification requires one. See UniversitiesApi.findOrCreate.
  Future<void> _resolveCollegeThenSave() async {
    if (_stream != 'Medical') {
      setState(() => _resolvingCollege = true);
      try {
        final university = await ref.read(universitiesApiProvider).findOrCreate(
              name: _collegeNameController.text.trim(),
              state: _state ?? '',
              city: _cityController.text.trim(),
              stream: _stream == 'Others' ? _streamOtherController.text.trim() : _stream,
            );
        if (!mounted) return;
        setState(() {
          _university = university;
          _resolvingCollege = false;
        });
      } catch (e) {
        if (!mounted) return;
        setState(() => _resolvingCollege = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Could not save your college: $e')));
        return;
      }
    }
    await _saveProfile();
  }

  /// Best-effort persist of whatever the user picked — non-fatal, since
  /// the avatar step is optional and a failed save here shouldn't block
  /// the wizard (they can always redo it later from Profile).
  Future<void> _continueFromAvatar() async {
    final config = _avatarPanelKey.currentState?.currentConfig;
    if (config != null) {
      try {
        await ref.read(usersApiProvider).updateAvatarConfig(config);
      } catch (_) {
        // Ignored — see doc comment above.
      }
    }
    _goTo(5);
  }

  /// Skips the avatar step without saving anything — the random avatar
  /// assigned at signup stays as-is. Just advances; doesn't end the wizard.
  void _skipAvatar() => _goTo(5);

  void _skip() {
    if (!mounted) return;
    ref.read(authControllerProvider.notifier).clearNeedsOnboarding();
    context.go('/home');
  }

  int? _yearOfStudyValue() {
    if (_yearOfStudyLabel == null) return null;
    final index = kYearsOfStudy.indexOf(_yearOfStudyLabel!);
    return index == -1 ? null : index + 1;
  }

  Future<void> _saveProfile() async {
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
            qualification: _degree,
            stream: resolvedStream,
            yearOfStudy: _currentStatus == 'Currently Studying'
                ? _yearOfStudyValue()
                : null,
            graduationYear: _currentStatus == 'Graduated'
                ? int.tryParse(_graduationYearController.text.trim())
                : null,
          );
      if (!mounted) return;
      setState(() => _saving = false);
      _goTo(4);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Could not save: $e')));
    }
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 70,
      maxWidth: 1600,
    );
    // Read via XFile.readAsBytes (works on web, iOS, Android) rather than
    // wrapping in dart:io's File — that stub throws "Unsupported operation:
    // _Namespace" the moment anything tries to read it on Flutter web.
    if (picked != null) {
      final bytes = await picked.readAsBytes();
      setState(() => _imageBytes = bytes);
    }
  }

  Future<void> _submitVerification() async {
    if (_university == null || _imageBytes == null) return;
    setState(() => _saving = true);
    try {
      final base64Image = base64Encode(_imageBytes!);
      await ref.read(verificationApiProvider).submit(
            universityId: _university!.id,
            documentType: _docType,
            documentBase64: base64Image,
          );
      if (!mounted) return;
      setState(() {
        _saving = false;
        _verificationSubmitted = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Could not submit: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_verificationSubmitted) {
      return _SubmittedScreen(onContinue: () {
        ref.read(authControllerProvider.notifier).clearNeedsOnboarding();
        context.go('/home');
      });
    }

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
                        'Real name stays private. Aspirants only see your display name.',
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
                      OnboardingSingleChipGroup(
                        options: kCurrentStatuses,
                        selected: _currentStatus,
                        onSelect: (v) => setState(() => _currentStatus = v),
                      ),
                      if (_currentStatus == 'Currently Studying') ...[
                        const SizedBox(height: AppSpacing.md),
                        const OnboardingFieldLabel('Year of Study'),
                        OnboardingSingleChipGroup(
                          options: kYearsOfStudy,
                          selected: _yearOfStudyLabel,
                          onSelect: (v) => setState(() => _yearOfStudyLabel = v),
                        ),
                      ],
                      if (_currentStatus == 'Graduated') ...[
                        const SizedBox(height: AppSpacing.md),
                        const OnboardingFieldLabel('Year of Graduation'),
                        TextFormField(
                          controller: _graduationYearController,
                          keyboardType: TextInputType.number,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(hintText: 'e.g. 2023'),
                        ),
                      ],
                    ],
                  ),
                  OnboardingStepScaffold(
                    title: _stepTitles[3],
                    subtitle: _stepSubtitles[3],
                    children: [
                      const OnboardingFieldLabel('Degree'),
                      OnboardingSingleChipGroup(
                        options: kDegrees,
                        selected: _degree,
                        onSelect: (v) => setState(() => _degree = v),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Stream / Field'),
                      OnboardingSingleChipGroup(
                        options: kStreamOptions,
                        selected: _stream,
                        // Switching streams invalidates whichever college
                        // input the previous stream used — Medical uses the
                        // dropdown (_university), everything else uses the
                        // typed name (_collegeNameController).
                        onSelect: (v) => setState(() {
                          _stream = v;
                          _university = null;
                          _collegeNameController.clear();
                        }),
                      ),
                      if (_stream == 'Others') ...[
                        const SizedBox(height: AppSpacing.sm),
                        TextFormField(
                          controller: _streamOtherController,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                              hintText: 'Tell us your field of study'),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('College'),
                      if (_stream == 'Medical')
                        Consumer(builder: (context, ref, _) {
                          final universitiesAsync = ref.watch(universitiesListProvider);
                          return universitiesAsync.when(
                            loading: () => const Skeleton(height: 48),
                            error: (_, __) => const Text(
                              'Could not load universities',
                              style: TextStyle(color: AppColors.error, fontSize: AppFont.xs),
                            ),
                            data: (universities) => DropdownButtonFormField<University>(
                              initialValue: _university,
                              isExpanded: true,
                              hint: const Text('Search or select your college'),
                              items: universities
                                  .map((u) => DropdownMenuItem(value: u, child: Text(u.name)))
                                  .toList(),
                              onChanged: (u) => setState(() => _university = u),
                            ),
                          );
                        })
                      else
                        TextFormField(
                          controller: _collegeNameController,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                              hintText: 'Enter your college name'),
                        ),
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
                  OnboardingStepScaffold(
                    title: _stepTitles[5],
                    subtitle: _stepSubtitles[5],
                    children: [
                      const OnboardingFieldLabel('Document type'),
                      DropdownButtonFormField<DocumentType>(
                        initialValue: _docType,
                        isExpanded: true,
                        items: DocumentType.values
                            .map((d) => DropdownMenuItem(value: d, child: Text(d.label)))
                            .toList(),
                        onChanged: (d) => setState(() => _docType = d ?? _docType),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('College ID'),
                      const Text(
                        'We\'ll need a geo-tagged photo of your valid college ID.',
                        style: TextStyle(
                          fontSize: AppFont.xs,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      InkWell(
                        onTap: _pickImage,
                        borderRadius: BorderRadius.circular(AppRadius.md),
                        child: Container(
                          height: 160,
                          decoration: BoxDecoration(
                            color: AppColors.background,
                            border: Border.all(color: AppColors.border),
                            borderRadius: BorderRadius.circular(AppRadius.md),
                          ),
                          child: _imageBytes == null
                              ? const Center(
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.add_photo_alternate_rounded,
                                          size: 32, color: AppColors.textMuted),
                                      SizedBox(height: AppSpacing.xs),
                                      Text('Take picture to upload',
                                          style: TextStyle(
                                              fontSize: AppFont.xs,
                                              color: AppColors.textSecondary)),
                                      Text('JPEG, PNG, formats upto 25 MB.',
                                          style: TextStyle(
                                              fontSize: AppFont.xs,
                                              color: AppColors.textMuted)),
                                    ],
                                  ),
                                )
                              : ClipRRect(
                                  borderRadius: BorderRadius.circular(AppRadius.md),
                                  child: Image.memory(_imageBytes!, fit: BoxFit.cover,
                                      width: double.infinity),
                                ),
                        ),
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
                    label: _step == 5 ? 'Submit for Verification' : 'Continue',
                    loading: _saving || _resolvingCollege,
                    enabled: _step == 5
                        ? (_university != null && _imageBytes != null)
                        : _canContinue,
                    onPressed: _next,
                  ),
                  // Skip is only offered on the avatar and identity-
                  // verification steps — steps 0-3 collect the basic
                  // profile data every mentor needs before they can be
                  // discovered at all, so skipping those isn't meaningful
                  // the way skipping avatar/verification (both still
                  // reachable later from Profile) is.
                  if (_step == 4) ...[
                    const SizedBox(height: AppSpacing.sm),
                    TextButton(
                      onPressed: _saving ? null : _skipAvatar,
                      child: const Text(
                        'Skip for now',
                        style: TextStyle(fontSize: AppFont.sm, color: AppColors.textMuted),
                      ),
                    ),
                  ],
                  if (_step == 5) ...[
                    const SizedBox(height: AppSpacing.sm),
                    TextButton(
                      onPressed: _saving ? null : _skip,
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

class _SubmittedScreen extends StatelessWidget {
  const _SubmittedScreen({required this.onContinue});
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 88,
                height: 88,
                decoration: const BoxDecoration(
                  color: AppColors.primaryLight,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: const Icon(Icons.verified_rounded,
                    size: 44, color: AppColors.primary),
              ),
              const SizedBox(height: AppSpacing.xl),
              const Text(
                'Verification Submitted!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: AppFont.xxl,
                  fontWeight: AppFont.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              const Text(
                'Your college ID has been submitted for review. We\'ll notify you once your mentor profile has been verified.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: AppFont.sm,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              PrimaryButton(label: 'Go to Home', onPressed: onContinue),
            ],
          ),
        ),
      ),
    );
  }
}
