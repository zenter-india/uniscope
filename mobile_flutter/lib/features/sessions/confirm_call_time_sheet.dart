import 'package:flutter/material.dart';

import '../../core/network/sessions_api.dart';
import '../../core/theme/app_theme.dart';
import 'call_time_windows.dart';

/// A time window the mentor has already committed to — a `[start, end)`
/// half-open interval. Used to grey out clashing slots in the confirm sheet
/// (the backend rejects a clash on accept regardless — see
/// SessionsService.accept — this is the matching UX).
typedef BusyInterval = (DateTime start, DateTime end);

/// The mentor's other still-live confirmed calls, as busy intervals. Feed it
/// `ref.read(sessionsListProvider)` — every session the mentor is a party to
/// is already in memory, so no extra fetch. Excludes [excludeSessionId] (the
/// request currently being confirmed).
List<BusyInterval> mentorBusyIntervals(
  List<Session> all, {
  required String excludeSessionId,
}) {
  const activeWire = {'PENDING', 'ACCEPTED', 'RINGING', 'IN_PROGRESS'};
  final out = <BusyInterval>[];
  for (final s in all) {
    if (s.id == excludeSessionId) continue;
    if (s.type != 'AUDIO_CALL') continue;
    if (s.confirmedFor == null) continue;
    if (!activeWire.contains(s.status.wire)) continue;
    final start = s.confirmedFor!.toLocal();
    final end = start.add(Duration(minutes: s.callSlotMinutes ?? 20));
    out.add((start, end));
  }
  return out;
}

/// The mentor's "Confirm a time" sheet. The aspirant offered 1–2 preferred
/// times; each is a *soft anchor* — this sheet expands each into the 30-min
/// slots of its 4-hour block so a busy mentor can pick the exact half hour
/// that fits their day. Returns the chosen slot (local `DateTime`), or null
/// if the mentor backed out.
///
/// Only call this for a scheduled AUDIO_CALL request (`requestedFor != null`).
/// Instant requests connect straight away with no slot to confirm.
///
/// [busy] — the mentor's already-confirmed call windows; any slot that would
/// overlap one is shown greyed and can't be picked (the backend enforces
/// this too).
Future<DateTime?> showConfirmCallTimeSheet(
  BuildContext context, {
  required Session session,
  List<BusyInterval> busy = const [],
}) {
  return showModalBottomSheet<DateTime>(
    context: context,
    backgroundColor: AppColors.surface,
    isScrollControlled: true,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (_) => _ConfirmCallTimeSheet(session: session, busy: busy),
  );
}

class _ConfirmCallTimeSheet extends StatefulWidget {
  const _ConfirmCallTimeSheet({required this.session, this.busy = const []});
  final Session session;
  final List<BusyInterval> busy;

  @override
  State<_ConfirmCallTimeSheet> createState() => _ConfirmCallTimeSheetState();
}

class _ConfirmCallTimeSheetState extends State<_ConfirmCallTimeSheet> {
  DateTime? _picked;

  /// True when a call of this length starting at [slot] would overlap one of
  /// the mentor's already-confirmed windows.
  bool _slotBusy(DateTime slot) {
    final end = slot.add(
      Duration(minutes: widget.session.callSlotMinutes ?? 20),
    );
    for (final (bStart, bEnd) in widget.busy) {
      if (slot.isBefore(bEnd) && bStart.isBefore(end)) return true;
    }
    return false;
  }

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
            if (widget.busy.isNotEmpty) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(
                    Icons.event_busy_rounded,
                    size: 14,
                    color: AppColors.textMuted,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      "Greyed slots overlap a call you've already confirmed.",
                      style: const TextStyle(
                        fontSize: AppFont.xs,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                ],
              ),
            ],
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
                                busy: _slotBusy(slot),
                                isAnchor:
                                    slot ==
                                    DateTime(
                                      g.anchor.year,
                                      g.anchor.month,
                                      g.anchor.day,
                                      g.anchor.hour,
                                      g.anchor.minute >= 30 ? 30 : 0,
                                    ),
                                onTap: _slotBusy(slot)
                                    ? null
                                    : () => setState(() => _picked = slot),
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
    this.busy = false,
  });

  final String label;
  final bool selected;
  final bool isAnchor;
  final bool busy;

  /// Null when the slot can't be picked (it clashes with another confirmed
  /// call) — the chip renders greyed and inert.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    if (busy) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: AppColors.border, width: 1.5),
        ),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: AppFont.sm,
            fontWeight: AppFont.medium,
            color: AppColors.textMuted,
            decoration: TextDecoration.lineThrough,
          ),
        ),
      );
    }
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
