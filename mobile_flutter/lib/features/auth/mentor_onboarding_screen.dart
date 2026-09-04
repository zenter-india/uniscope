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
import '../../widgets/primary_button.dart';
import '../profile/avatar_picker_panel.dart';
import '../profile/profile_options.dart';
import 'college_search_field.dart';
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
  String? _city;
  final _cityOtherController = TextEditingController();

  University? _university;
  final _collegeNameController = TextEditingController();
  bool _resolvingCollege = false;
  String? _stream;
  final _streamOtherController = TextEditingController();
  String? _degree;
  String? _specialization;

  String? _currentStatus;
  String? _yearOfStudyLabel;
  final _graduationYearController = TextEditingController();
  bool _yearInfoPrivate = false;
  final Set<String> _languages = {};
  final _languagesOtherController = TextEditingController();
  final Set<String> _preferredTimings = {};

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
    'Are you still studying or graduated? How can aspirants reach you?',
    'Your institution and degree.',
    'Pick a look — you can always change this later from your profile.',
    'Help us confirm your college identity and build trust with aspirants.',
  ];

  @override
  void dispose() {
    _pageController.dispose();
    _fullNameController.dispose();
    _cityOtherController.dispose();
    _collegeNameController.dispose();
    _streamOtherController.dispose();
    _graduationYearController.dispose();
    _languagesOtherController.dispose();
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
        return _state != null &&
            _city != null &&
            (_city != 'Other' || _cityOtherController.text.trim().isNotEmpty);
      case 2:
        final statusOk = _currentStatus == 'Currently Studying'
            ? _yearOfStudyLabel != null
            : _currentStatus == 'Graduated'
                ? int.tryParse(_graduationYearController.text.trim()) != null
                : false;
        final languagesOk = _languages.isNotEmpty &&
            (!_languages.contains('Others') ||
                _languagesOtherController.text.trim().isNotEmpty);
        return statusOk && languagesOk && _preferredTimings.isNotEmpty;
      case 3:
        final streamOk = _stream != null &&
            (_stream != 'Others' || _streamOtherController.text.trim().isNotEmpty);
        final collegeOk = _collegeNameController.text.trim().isNotEmpty;
        final specializationOk = !_needsSpecialization || _specialization != null;
        return _degree != null && streamOk && collegeOk && specializationOk;
      default:
        return true;
    }
  }

  bool get _needsSpecialization =>
      _stream == 'Medical' && _degree != null && _degree != 'MBBS';

  /// Real bug fix (ported from web/components/MentorForm.tsx's own
  /// shouldFetchMedicalStreamWideSpecialization): Doctorate/Others used to
  /// show only the static kMedicalSpecializations list, which despite its
  /// name only ever reflected MD/MS-shaped specialties -- real DNB/
  /// Diploma/DM-MCh specializations were never in it, so the field
  /// effectively showed just "the MD list". Doctorate/Others now merges
  /// that static list with the real, data-driven union across every one
  /// of Medical's curated degrees (streamWideSpecializationsProvider).
  bool get _needsMedicalStreamWideSpecialization =>
      _stream == 'Medical' && (_degree == 'Doctorate' || _degree == 'Others');

  /// Merges kMedicalSpecializations with streamWideSpecializationsProvider's
  /// real data-driven union across every one of Medical's curated degrees
  /// (see _needsMedicalStreamWideSpecialization above). Merged rather than
  /// replaced so the field never regresses to fewer options while the
  /// fetch is still in flight or if it fails.
  List<String> _medicalStreamWideSpecializationOptions() {
    final curatedDegrees =
        kCuratedDegreeMapByStream['Medical']!.values.toSet().toList();
    final fetched = ref.watch(
      streamWideSpecializationsProvider(
        (stream: 'Medical', curatedDegrees: curatedDegrees),
      ),
    );
    final merged = {...kMedicalSpecializations, ...fetched.value ?? const []}.toList()..sort();
    return merged;
  }

  String get _resolvedCity => _city == 'Other' ? _cityOtherController.text.trim() : (_city ?? '');

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

  /// College Details is the last data-collection step (index 3) — if the
  /// typed college name wasn't picked from the search suggestions, it needs
  /// to resolve (find-or-create) to a real University row before the profile
  /// save, since verification requires one. See UniversitiesApi.findOrCreate.
  Future<void> _resolveCollegeThenSave() async {
    if (_university == null) {
      setState(() => _resolvingCollege = true);
      try {
        final university = await ref.read(universitiesApiProvider).findOrCreate(
              name: _collegeNameController.text.trim(),
              state: _state ?? '',
              city: _resolvedCity,
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
            city: _resolvedCity.isEmpty ? null : _resolvedCity,
            qualification: _degree,
            specialization: _needsSpecialization ? _specialization : null,
            stream: resolvedStream,
            yearOfStudy: _currentStatus == 'Currently Studying'
                ? _yearOfStudyValue()
                : null,
            graduationYear: _currentStatus == 'Graduated'
                ? int.tryParse(_graduationYearController.text.trim())
                : null,
            yearInfoPrivate: _yearInfoPrivate,
            languages: _languages
                .map((l) => l == 'Others' ? _languagesOtherController.text.trim() : l)
                .where((l) => l.isNotEmpty)
                .toList(),
            availableDays: _preferredTimings.toList(),
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
                        // The district list depends entirely on which state
                        // this is, so a city picked under the old state
                        // almost never makes sense under the new one.
                        onChanged: (v) => setState(() {
                          _state = v;
                          _city = null;
                          _cityOtherController.clear();
                        }),
                      ),
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
                        const SizedBox(height: AppSpacing.sm),
                        OnboardingToggle(
                          value: _yearInfoPrivate,
                          onChanged: (v) => setState(() => _yearInfoPrivate = v),
                          label: 'Keep my year of study private',
                          hint:
                              'When on, this stays anonymous and isn\'t shown publicly on your profile.',
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
                        const SizedBox(height: AppSpacing.sm),
                        OnboardingToggle(
                          value: _yearInfoPrivate,
                          onChanged: (v) => setState(() => _yearInfoPrivate = v),
                          label: 'Keep my graduation year private',
                          hint:
                              'When on, this stays anonymous and isn\'t shown publicly on your profile.',
                        ),
                      ],
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Preferred Languages'),
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
                        TextFormField(
                          controller: _languagesOtherController,
                          onChanged: (_) => setState(() {}),
                          decoration:
                              const InputDecoration(hintText: 'Enter language'),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Preferred Timing'),
                      OnboardingChipGroup(
                        options: kTimeSlots,
                        selected: _preferredTimings,
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
                    title: _stepTitles[3],
                    subtitle: _stepSubtitles[3],
                    children: [
                      const OnboardingFieldLabel('Degree'),
                      OnboardingSingleChipGroup(
                        options: degreesForStream(_stream),
                        selected: _degree,
                        onSelect: (v) => setState(() {
                          _degree = v;
                          _specialization = null;
                        }),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Stream / Field'),
                      OnboardingSingleChipGroup(
                        options: kStreamOptions,
                        selected: _stream,
                        // Switching streams invalidates whichever college
                        // was picked/typed for the previous one, and the
                        // previously chosen degree/specialization may no
                        // longer be a valid option for the new stream.
                        onSelect: (v) => setState(() {
                          _stream = v;
                          _university = null;
                          _collegeNameController.clear();
                          _degree = null;
                          _specialization = null;
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
                      CollegeSearchField(
                        initialText: _collegeNameController.text,
                        onPick: (university, text) => setState(() {
                          _university = university;
                          _collegeNameController.text = text;
                        }),
                      ),
                      if (_needsSpecialization) ...[
                        const SizedBox(height: AppSpacing.md),
                        const OnboardingFieldLabel('Specialization'),
                        OnboardingDropdown(
                          value: _specialization,
                          hint: 'Select specialization',
                          options: _needsMedicalStreamWideSpecialization
                              ? _medicalStreamWideSpecializationOptions()
                              : kMedicalSpecializations,
                          onChanged: (v) => setState(() => _specialization = v),
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
