import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/network/universities_api.dart';
import '../../core/network/verification_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';

class VerificationScreen extends ConsumerWidget {
  const VerificationScreen({super.key});

  static const _unlocks = <String>[
    'Answer questions from prospective students',
    'Write university reviews',
    'Accept chat requests from students',
    'Verified badge on your profile',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final myRequestsAsync = ref.watch(myVerificationProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Get Verified')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
              child: Column(
                children: [
                  Icon(Icons.verified_user_rounded, size: 48, color: AppColors.primary),
                  SizedBox(height: AppSpacing.sm),
                  Text(
                    'Verify your identity',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: AppFont.xl,
                      fontWeight: AppFont.extraBold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  SizedBox(height: AppSpacing.sm),
                  Text(
                    'Verification is confidential. Your real identity is never shown publicly — only your role and university.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: AppFont.sm,
                      color: AppColors.textSecondary,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
            myRequestsAsync.when(
              loading: () => const Column(
                  children: [SkeletonCard(), SizedBox(height: AppSpacing.md)]),
              error: (_, __) => const _SubmissionForm(),
              data: (requests) {
                final latest = requests.isNotEmpty ? requests.first : null;
                if (latest == null ||
                    latest.status == 'REJECTED' ||
                    latest.status == 'DRAFT') {
                  return Column(
                    children: [
                      if (latest?.status == 'REJECTED')
                        _StatusCard(request: latest!),
                      if (latest?.status == 'REJECTED')
                        const SizedBox(height: AppSpacing.md),
                      AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('What you unlock',
                                style: TextStyle(
                                    fontSize: AppFont.md,
                                    fontWeight: AppFont.bold)),
                            for (final item in _unlocks)
                              Padding(
                                padding: const EdgeInsets.only(top: AppSpacing.sm),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Icon(Icons.check_circle_rounded,
                                        size: 16, color: AppColors.primary),
                                    const SizedBox(width: AppSpacing.sm),
                                    Expanded(
                                      child: Text(item,
                                          style: const TextStyle(
                                              fontSize: AppFont.sm,
                                              color: AppColors.textPrimary)),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const _SubmissionForm(),
                    ],
                  );
                }
                return _StatusCard(request: latest);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.request});
  final VerificationRequest request;

  (IconData, Color, String) get _presentation {
    switch (request.status) {
      case 'VERIFIED':
        return (Icons.verified_rounded, AppColors.primary, "You're verified!");
      case 'REJECTED':
        return (Icons.cancel_rounded, AppColors.error, 'Verification declined');
      case 'UNDER_REVIEW':
        return (Icons.hourglass_top_rounded, AppColors.warning, 'Under review');
      default:
        return (Icons.hourglass_top_rounded, AppColors.warning, 'Submitted — awaiting review');
    }
  }

  @override
  Widget build(BuildContext context) {
    final (icon, color, title) = _presentation;
    return AppCard(
      child: Column(
        children: [
          Icon(icon, size: 40, color: color),
          const SizedBox(height: AppSpacing.sm),
          Text(title,
              style: const TextStyle(
                  fontSize: AppFont.lg, fontWeight: AppFont.extraBold)),
          if (request.reviewNote != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(request.reviewNote!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: AppFont.sm, color: AppColors.textSecondary)),
          ],
        ],
      ),
    );
  }
}

class _SubmissionForm extends ConsumerStatefulWidget {
  const _SubmissionForm();

  @override
  ConsumerState<_SubmissionForm> createState() => _SubmissionFormState();
}

class _SubmissionFormState extends ConsumerState<_SubmissionForm> {
  University? _university;
  DocumentType _docType = DocumentType.studentId;
  Uint8List? _imageBytes;
  bool _submitting = false;

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

  Future<void> _submit() async {
    if (_university == null || _imageBytes == null) return;
    setState(() => _submitting = true);
    try {
      final base64Image = base64Encode(_imageBytes!);
      await ref.read(verificationApiProvider).submit(
            universityId: _university!.id,
            documentType: _docType,
            documentBase64: base64Image,
          );
      ref.invalidate(myVerificationProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Submitted — we\'ll review it within 48 hours')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Could not submit: $e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final universitiesAsync = ref.watch(universitiesListProvider);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Submit your document',
              style: TextStyle(fontSize: AppFont.md, fontWeight: AppFont.bold)),
          const SizedBox(height: AppSpacing.md),
          const Text('University',
              style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.semibold)),
          const SizedBox(height: AppSpacing.xs),
          universitiesAsync.when(
            loading: () => const Skeleton(height: 48),
            error: (_, __) => const Text('Could not load universities',
                style: TextStyle(color: AppColors.error, fontSize: AppFont.xs)),
            data: (universities) => DropdownButtonFormField<University>(
              initialValue: _university,
              isExpanded: true,
              hint: const Text('Select your university'),
              items: universities
                  .map((u) => DropdownMenuItem(value: u, child: Text(u.name)))
                  .toList(),
              onChanged: (u) => setState(() => _university = u),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          const Text('Document type',
              style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.semibold)),
          const SizedBox(height: AppSpacing.xs),
          DropdownButtonFormField<DocumentType>(
            initialValue: _docType,
            isExpanded: true,
            items: DocumentType.values
                .map((d) => DropdownMenuItem(value: d, child: Text(d.label)))
                .toList(),
            onChanged: (d) => setState(() => _docType = d ?? _docType),
          ),
          const SizedBox(height: AppSpacing.md),
          const Text('Photo',
              style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.semibold)),
          const SizedBox(height: AppSpacing.xs),
          InkWell(
            onTap: _pickImage,
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: Container(
              height: 160,
              decoration: BoxDecoration(
                color: AppColors.background,
                border: Border.all(color: AppColors.border, style: BorderStyle.solid),
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
                          Text('Tap to choose a photo',
                              style: TextStyle(
                                  fontSize: AppFont.xs,
                                  color: AppColors.textSecondary)),
                        ],
                      ),
                    )
                  : ClipRRect(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      child: Image.memory(_imageBytes!, fit: BoxFit.cover, width: double.infinity),
                    ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.lock_rounded, size: 15, color: AppColors.primaryDark),
                SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'Documents are stored securely and reviewed only by verified Uniscope admins.',
                    style: TextStyle(
                        fontSize: AppFont.xs, color: AppColors.primaryDark, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: (_university != null && _imageBytes != null && !_submitting)
                  ? _submit
                  : null,
              child: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Submit for Review'),
            ),
          ),
        ],
      ),
    );
  }
}
