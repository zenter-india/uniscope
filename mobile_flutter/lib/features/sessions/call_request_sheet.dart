import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/sessions_api.dart';
import '../../core/theme/app_theme.dart';

/// Flat per-minute rate for AUDIO_CALL sessions — matches the backend's
/// MENTOR_RATE_PER_MINUTE_MINOR (₹10/min, same for every mentor).
const int kCallRatePerMinuteMinor = 1000;

/// Opens the slot-picker sheet and requests an AUDIO_CALL with [mentorId] if
/// the aspirant confirms. Chat has no pricing UI at all — this is the only
/// place a cost is ever shown, since only calls are billed.
Future<void> showCallRequestSheet(
  BuildContext context,
  WidgetRef ref, {
  required String mentorId,
  String? mentorName,
}) async {
  final slotMinutes = await showModalBottomSheet<int>(
    context: context,
    backgroundColor: AppColors.surface,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (_) => _CallRequestSheet(mentorName: mentorName),
  );

  if (slotMinutes == null || !context.mounted) return;

  try {
    await ref.read(sessionsApiProvider).create(
          mentorId,
          SessionKind.audioCall,
          slotMinutes: slotMinutes,
        );
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Call requested — check the Sessions tab')),
    );
  } catch (e) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text('Could not request call: $e')));
  }
}

class _CallRequestSheet extends StatefulWidget {
  const _CallRequestSheet({this.mentorName});
  final String? mentorName;

  @override
  State<_CallRequestSheet> createState() => _CallRequestSheetState();
}

class _CallRequestSheetState extends State<_CallRequestSheet> {
  int _slotMinutes = kCallSlotMinutes.first;

  @override
  Widget build(BuildContext context) {
    final slotCostRupees = _slotMinutes * kCallRatePerMinuteMinor / 100;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.lg + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(AppRadius.full),
              ),
            ),
          ),
          Text(
            widget.mentorName != null
                ? 'Request a call with ${widget.mentorName}'
                : 'Request a call',
            style: const TextStyle(
                fontSize: AppFont.lg, fontWeight: AppFont.extraBold),
          ),
          const SizedBox(height: AppSpacing.lg),
          const Text('Choose a slot',
              style: TextStyle(fontWeight: AppFont.bold, fontSize: AppFont.sm)),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: kCallSlotMinutes.map((m) {
              final selected = _slotMinutes == m;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      backgroundColor: selected ? AppColors.primaryLight : null,
                      foregroundColor:
                          selected ? AppColors.primaryDark : AppColors.textPrimary,
                      side: BorderSide(
                        color: selected ? AppColors.primary : AppColors.border,
                        width: 1.5,
                      ),
                    ),
                    onPressed: () => setState(() => _slotMinutes = m),
                    child: Text('$m min'),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Full slot cost of ₹${slotCostRupees.toStringAsFixed(0)} is charged once the call '
            'connects — even if it ends early.',
            style: const TextStyle(
                fontSize: AppFont.xs, color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => Navigator.of(context).pop(_slotMinutes),
              child: const Text('Request Call'),
            ),
          ),
        ],
      ),
    );
  }
}
