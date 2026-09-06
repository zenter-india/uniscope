import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/support_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';

/// "Report a technical issue" — the form behind the Help Centre's
/// "Report a technical issue" button. Posts to `/support/technical-reports`,
/// which lands in the admin panel's Support → Technical reports queue.
class TechnicalReportScreen extends ConsumerStatefulWidget {
  const TechnicalReportScreen({super.key});

  @override
  ConsumerState<TechnicalReportScreen> createState() =>
      _TechnicalReportScreenState();
}

class _TechnicalReportScreenState extends ConsumerState<TechnicalReportScreen> {
  final _controller = TextEditingController();
  bool _submitting = false;
  bool _done = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _controller.text.trim();
    if (text.isEmpty) {
      setState(() => _error = 'Please describe the problem first.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref
          .read(supportApiProvider)
          .submitTechnicalReport(message: text, platform: currentPlatformTag());
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _done = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Could not send your report. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: GradientAppBar(title: const Text('Report technical error')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: _done ? _buildDone() : _buildForm(),
      ),
    );
  }

  Widget _buildForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Report a technical issue',
          style: TextStyle(
            fontSize: AppFont.xl,
            fontWeight: AppFont.extraBold,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        const Text(
          'Please let us know your issue.',
          style: TextStyle(
            fontSize: AppFont.sm,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: AppColors.border),
          ),
          child: TextField(
            controller: _controller,
            minLines: 5,
            maxLines: 10,
            maxLength: 2000,
            textInputAction: TextInputAction.newline,
            style: const TextStyle(fontSize: AppFont.sm),
            decoration: const InputDecoration(
              hintText: 'Describe your problem',
              hintStyle: TextStyle(color: AppColors.textMuted),
              border: InputBorder.none,
              contentPadding: EdgeInsets.all(AppSpacing.md),
              counterText: '',
            ),
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            _error!,
            style: const TextStyle(
              fontSize: AppFont.xs,
              color: AppColors.error,
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            minimumSize: const Size(120, 46),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.xl),
            ),
            textStyle: const TextStyle(
              fontSize: AppFont.sm,
              fontWeight: AppFont.extraBold,
            ),
          ),
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Submit'),
        ),
      ],
    );
  }

  Widget _buildDone() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(
                color: AppColors.primaryLight,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_rounded, color: AppColors.primary),
            ),
            const SizedBox(width: AppSpacing.md),
            const Expanded(
              child: Text(
                'Thanks — we’ve logged your report',
                style: TextStyle(
                  fontSize: AppFont.lg,
                  fontWeight: AppFont.extraBold,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        const Text(
          'Our team will look into it. If it’s urgent, you can also call us '
          'or start a chat from the Help Centre.',
          style: TextStyle(
            fontSize: AppFont.sm,
            height: 1.5,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        OutlinedButton(
          onPressed: () => Navigator.of(context).maybePop(),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.primary,
            side: const BorderSide(color: AppColors.primary),
            minimumSize: const Size(120, 46),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.xl),
            ),
            textStyle: const TextStyle(
              fontSize: AppFont.sm,
              fontWeight: AppFont.extraBold,
            ),
          ),
          child: const Text('Done'),
        ),
      ],
    );
  }
}
