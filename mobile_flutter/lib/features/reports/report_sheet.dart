import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/reports_api.dart';
import '../../core/theme/app_theme.dart';

/// Generic report sheet — reason picker + optional details — used to file a
/// report against a user (mentor detail screen) or a chat (session chat
/// screen). Calls the existing backend POST /reports, which an admin
/// reviews via the admin panel's moderation queue.
Future<void> showReportSheet(
  BuildContext context,
  WidgetRef ref, {
  required ReportTargetType targetType,
  required String targetId,
  required String targetLabel,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (sheetContext) => _ReportSheetContent(
      targetType: targetType,
      targetId: targetId,
      targetLabel: targetLabel,
    ),
  );
}

class _ReportSheetContent extends ConsumerStatefulWidget {
  const _ReportSheetContent({
    required this.targetType,
    required this.targetId,
    required this.targetLabel,
  });

  final ReportTargetType targetType;
  final String targetId;
  final String targetLabel;

  @override
  ConsumerState<_ReportSheetContent> createState() => _ReportSheetContentState();
}

class _ReportSheetContentState extends ConsumerState<_ReportSheetContent> {
  ReportReason? _reason;
  final _descriptionController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_reason == null) return;
    setState(() => _submitting = true);
    try {
      await ref.read(reportsApiProvider).create(
            targetType: widget.targetType,
            targetId: widget.targetId,
            reason: _reason!,
            description: _descriptionController.text,
          );
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Report submitted — our team will review it.')),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not submit the report. Try again.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.lg,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Report ${widget.targetLabel}',
            style: const TextStyle(
              fontSize: AppFont.lg,
              fontWeight: AppFont.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          const Text(
            'Our team reviews every report. This won\'t notify the other person.',
            style: TextStyle(fontSize: AppFont.sm, color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.md),
          ...ReportReason.values.map(
            (reason) => RadioListTile<ReportReason>(
              value: reason,
              groupValue: _reason,
              onChanged: (v) => setState(() => _reason = v),
              title: Text(reason.label, style: const TextStyle(fontSize: AppFont.sm)),
              activeColor: AppColors.primary,
              contentPadding: EdgeInsets.zero,
              dense: true,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _descriptionController,
            maxLength: 500,
            maxLines: 3,
            decoration: const InputDecoration(
              hintText: 'Add details (optional)',
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _reason == null || _submitting ? null : _submit,
              style: FilledButton.styleFrom(backgroundColor: AppColors.error),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Submit report'),
            ),
          ),
        ],
      ),
    );
  }
}
