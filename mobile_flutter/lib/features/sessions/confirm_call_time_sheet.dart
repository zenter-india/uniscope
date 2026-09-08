import 'package:flutter/material.dart';

import '../../core/network/sessions_api.dart';
import '../../core/theme/app_theme.dart';
import 'call_time_windows.dart';

/// The mentor's "Confirm a time" sheet. The aspirant offered 1–2 preferred
/// times; each is a *soft anchor* — this sheet expands each into the 30-min
/// slots of its 4-hour block so a busy mentor can pick the exact half hour
/// that fits their day. Returns the chosen slot (local `DateTime`), or null
/// if the mentor backed out.
///
/// Only call this for a scheduled AUDIO_CALL request (`requestedFor != null`).
/// Instant requests connect straight away with no slot to confirm.
Future<DateTime?> showConfirmCallTimeSheet(
  BuildContext context, {
  required Session session,
}) {
  return showModalBottomSheet<DateTime>(
    context: context,
    backgroundColor: AppColors.surface,
    isScrollControlled: true,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (_) => _ConfirmCallTimeSheet(session: session),
  );
}

class _ConfirmCallTimeSheet extends StatefulWidget {
  const _ConfirmCallTimeSheet({required this.session});
  final Session session;

  @override
  State<_ConfirmCallTimeSheet> createState() => _ConfirmCallTimeSheetState();
}

class _ConfirmCallTimeSheetState extends State<_ConfirmCallTimeSheet> {
  DateTime? _picked;

  List<({DateTime anchor, List<DateTime> slots})> get _groups {
    final s = widget.session;
    final anchors = <DateTime>[
      if (s.requestedFor != null) s.requestedFor!.toLocal(),
      if (s.requestedForAlt != null) s.requestedForAlt!.toLocal(),
    ];
    return [
      for (final a in anchors) (anchor: a, slots: slotsAroundAnchor(a)),
    ].where((g) => g.slots.isNotEmpty).toList();
  }

  @override
  Widget build(BuildContext context) {
    final groups = _groups;
    final slotMin = widget.session.callSlotMinutes;
    final name = widget.session.aspirantName;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          0,
          AppSpacing.lg,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Confirm a time with $name',
              style: const TextStyle(
                fontSize: AppFont.lg,
                fontWeight: AppFont.extraBold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              slotMin != null
                  ? '$slotMin-minute call · pick any 30-minute slot around the '
                        'time${groups.length > 1 ? 's' : ''} $name offered'
                  : 'Pick any 30-minute slot around the time $name offered',
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            if (groups.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                child: Text(
                  'Both of those times have already passed. Reject this '
                  'request and the student can send a new one.',
                  style: TextStyle(
                    fontSize: AppFont.sm,
                    color: AppColors.textSecondary,
                  ),
                ),
              )
            else
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final g in groups) ...[
                        _GroupLabel(anchor: g.anchor),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            for (final slot in g.slots)
                              _SlotChip(
                                label: clockLabel(slot),
                                selected: _picked == slot,
                                isAnchor:
                                    slot ==
                                    DateTime(
                                      g.anchor.year,
                                      g.anchor.month,
                                      g.anchor.day,
                                      g.anchor.hour,
                                      g.anchor.minute >= 30 ? 30 : 0,
                                    ),
                                onTap: () => setState(() => _picked = slot),
                              ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),
                      ],
                      Row(
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.warning,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'The time $name asked for. Pick whatever works for you.',
                            style: const TextStyle(
                              fontSize: AppFont.xs,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: _picked == null
                        ? null
                        : () => Navigator.of(context).pop(_picked),
                    child: Text(
                      _picked == null
                          ? 'Pick a slot'
                          : 'Confirm ${friendlyCallTime(_picked!)}',
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _GroupLabel extends StatelessWidget {
  const _GroupLabel({required this.anchor});
  final DateTime anchor;

  @override
  Widget build(BuildContext context) {
    return RichText(
      text: TextSpan(
        style: const TextStyle(
          fontSize: AppFont.sm,
          fontWeight: AppFont.bold,
          color: AppColors.textPrimary,
        ),
        children: [
          TextSpan(text: _dayLabel(anchor)),
          TextSpan(
            text: '  — free around ${clockLabel(anchor)}',
            style: const TextStyle(
              fontWeight: AppFont.regular,
              color: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }

  static String _dayLabel(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final d = DateTime(dt.year, dt.month, dt.day);
    final delta = d.difference(today).inDays;
    if (delta == 0) return 'Today';
    if (delta == 1) return 'Tomorrow';
    const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const mo = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${wd[dt.weekday - 1]}, ${mo[dt.month - 1]} ${dt.day}';
  }
}

class _SlotChip extends StatelessWidget {
  const _SlotChip({
    required this.label,
    required this.selected,
    required this.isAnchor,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final bool isAnchor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: selected
                ? AppColors.primary
                : isAnchor
                ? AppColors.warning
                : AppColors.border,
            width: 1.5,
          ),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: AppFont.sm,
                fontWeight: selected ? AppFont.bold : AppFont.medium,
                color: selected ? Colors.white : AppColors.textPrimary,
              ),
            ),
            if (isAnchor && !selected)
              Positioned(
                right: -8,
                top: -6,
                child: Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.warning,
                    border: Border.all(color: AppColors.surface, width: 1.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
