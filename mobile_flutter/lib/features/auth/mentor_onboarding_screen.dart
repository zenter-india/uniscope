import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/network/universities_api.dart';
import '../../core/network/users_api.dart';
import '../../core/network/verification_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import '../../widgets/primary_button.dart';
import '../profile/profile_options.dart';
import 'onboarding_widgets.dart';

/// Post-signup wizard for MENTOR users — Basic Info → College Details →
/// Areas of Guidance → Mentoring Preferences → identity verification —
/// matching the Figma mentor onboarding flow. Bigger than the aspirant
/// wizard because it folds in a college-ID upload step; the underlying
/// `POST /verification` call is the same one used by the standalone
/// VerificationScreen reached later from the Profile tab.
///
/// Deliberately has no "Call Rate" field even though Figma's design shows
/// one — mentor pay is a flat ₹10/min platform-wide (see CLAUDE.md), so a
/// per-mentor rate field would contradict that locked-in decision.
class MentorOnboardingScreen extends ConsumerStatefulWidget {
  const MentorOnboardingScreen({super.key});

  @override
  ConsumerState<MentorOnboardingScreen> createState() =>
      _MentorOnboardingScreenState();
}

class _MentorOnboardingScreenState extends ConsumerState<MentorOnboardingScreen> {
  final _pageController = PageController();
  int _step = 0;
  bool _saving = false;
  bool _verificationSubmitted = false;

  DateTime? _dateOfBirth;
  String? _gender;
  String? _qualification;
  String? _currentStatus;
  String? _specialty;
  final Set<String> _languages = {};
  final Set<String> _availableDays = {};

  University? _university;
  DocumentType _docType = DocumentType.studentId;
  File? _image;

  static const _stepTitles = [
    'Basic Information',
    'College Details',
    'Areas of Guidance',
    'Mentoring Preferences',
    'Verify it\'s really you',
  ];
  static const _stepSubtitles = [
    'Tell us a little about yourself.',
    'Tell us about your academic background.',
    'Select the topics you can confidently guide aspirants on.',
    'Set your languages and availability.',
    'Help us confirm your college identity and build trust with aspirants.',
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
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
      _saveProfile();
      return;
    }
    if (_step == 4) {
      _submitVerification();
      return;
    }
    _goTo(_step + 1);
  }

  void _skip() {
    if (!mounted) return;
    context.go('/home');
  }

  Future<void> _saveProfile() async {
    setState(() => _saving = true);
    try {
      await ref.read(usersApiProvider).updateProfile(
            gender: _gender,
            qualification: _qualification,
            specialty: _specialty,
            languages: _languages.toList(),
            availableDays: _availableDays.toList(),
            dateOfBirth: _dateOfBirth?.toIso8601String().substring(0, 10),
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
    if (picked != null) setState(() => _image = File(picked.path));
  }

  Future<void> _submitVerification() async {
    if (_university == null || _image == null) return;
    setState(() => _saving = true);
    try {
      final bytes = await _image!.readAsBytes();
      final base64Image = base64Encode(bytes);
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

  Future<void> _pickDateOfBirth() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 25, now.month, now.day),
      firstDate: DateTime(now.year - 80),
      lastDate: now,
    );
    if (picked != null) setState(() => _dateOfBirth = picked);
  }

  @override
  Widget build(BuildContext context) {
    if (_verificationSubmitted) {
      return _SubmittedScreen(onContinue: () => context.go('/home'));
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
                      const OnboardingFieldLabel('Date of Birth'),
                      OnboardingDateField(value: _dateOfBirth, onTap: _pickDateOfBirth),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Gender'),
                      OnboardingDropdown(
                        value: _gender,
                        hint: 'Select gender',
                        options: kGenders,
                        onChanged: (v) => setState(() => _gender = v),
                      ),
                    ],
                  ),
                  OnboardingStepScaffold(
                    title: _stepTitles[1],
                    subtitle: _stepSubtitles[1],
                    children: [
                      const OnboardingFieldLabel('Highest Qualification'),
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
                    ],
                  ),
                  OnboardingStepScaffold(
                    title: _stepTitles[2],
                    subtitle: _stepSubtitles[2],
                    children: [
                      const OnboardingFieldLabel('What can you guide aspirants on?'),
                      OnboardingDropdown(
                        value: _specialty,
                        hint: 'Select area of guidance',
                        options: kGuidanceAreas,
                        onChanged: (v) => setState(() => _specialty = v),
                      ),
                    ],
                  ),
                  OnboardingStepScaffold(
                    title: _stepTitles[3],
                    subtitle: _stepSubtitles[3],
                    children: [
                      const OnboardingFieldLabel('Languages you can mentor in'),
                      OnboardingChipGroup(
                        options: kLanguageOptions,
                        selected: _languages,
                        onToggle: (lang, v) => setState(
                            () => v ? _languages.add(lang) : _languages.remove(lang)),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const OnboardingFieldLabel('Available Days'),
                      OnboardingChipGroup(
                        options: kWeekdays,
                        selected: _availableDays,
                        onToggle: (day, v) => setState(() =>
                            v ? _availableDays.add(day) : _availableDays.remove(day)),
                      ),
                    ],
                  ),
                  OnboardingStepScaffold(
                    title: _stepTitles[4],
                    subtitle: _stepSubtitles[4],
                    children: [
                      const OnboardingFieldLabel('College'),
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
                            hint: const Text('Select your college'),
                            items: universities
                                .map((u) => DropdownMenuItem(value: u, child: Text(u.name)))
                                .toList(),
                            onChanged: (u) => setState(() => _university = u),
                          ),
                        );
                      }),
                      const SizedBox(height: AppSpacing.md),
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
                      Text(
                        'We\'ll need a geo-tagged photo of your valid college ID.',
                        style: const TextStyle(
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
                          child: _image == null
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
                                  child: Image.file(_image!, fit: BoxFit.cover,
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
                    label: _step == 4 ? 'Submit for Verification' : 'Continue',
                    loading: _saving,
                    enabled: _step != 4 || (_university != null && _image != null),
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
