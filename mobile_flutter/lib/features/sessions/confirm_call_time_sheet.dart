import 'package:flutter/material.dart';

import '../../core/network/sessions_api.dart';
import '../../core/theme/app_theme.dart';
import 'call_time_windows.dart';
import 'custom_call_time_screen.dart';

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
/// times — the mentor picks one of those exact times to accept it as-is
/// (2026-09-11: no more picking a different half-hour slot from within the
/// same 4-hour block; if neither offered time works, "Suggest another time"
/// opens the same day-and-slot picker the aspirant uses to request a call,
/// `CustomCallTimeScreen`, so both sides pick a time the exact same way).
/// Returns the chosen `DateTime` (local), or null if the mentor backed out.
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

  /// A time picked via "Suggest another time" (`CustomCallTimeScreen`) —
  /// kept separate from [_picked] so it stays visible as its own option if
  /// the mentor taps back to one of the aspirant's original offers.
  DateTime? _customPick;

  /// True when a call of this length starting at [slot] would overlap one of
  /// the mentor's already-confirmed windows — the same rule the backend's
  /// double-booking guard enforces on accept (see `SessionsService.accept`).
  bool _slotBusy(DateTime slot) {
    final end = slot.add(
      Duration(minutes: widget.session.callSlotMinutes ?? 20),
    );
    for (final (bStart, bEnd) in widget.busy) {
      if (slot.isBefore(bEnd) && bStart.isBefore(end)) return true;
    }
    return false;
  }

  /// The aspirant's offered times, exact — accepting one confirms that
  /// precise moment, not a nearby slot. Anything already in the past is
  /// dropped (accepting it would just 400 on the backend).
  List<DateTime> get _offeredTimes {
    final s = widget.session;
    final now = DateTime.now();
    return <DateTime>[
      if (s.requestedFor != null) s.requestedFor!.toLocal(),
      if (s.requestedForAlt != null) s.requestedForAlt!.toLocal(),
    ].where((t) => t.isAfter(now)).toList();
  }

  /// Opens the exact same day-and-slot picker the aspirant used to request
  /// this call in the first place — no mentor-specific "usually free"
  /// styling here, just the plain picker, so both sides pick a time the
  /// same way.
  Future<void> _suggestAnotherTime() async {
    final picked = await Navigator.of(
      context,
    ).push<DateTime>(MaterialPageRoute(builder: (_) => const CustomCallTimeScreen()));
    if (picked != null && mounted) {
      setState(() {
        _customPick = picked;
        _picked = picked;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final offered = _offeredTimes;
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
              slotMin != null ? '$slotMin-minute call' : 'Pick a time',
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            if (offered.isEmpty)
              const Padding(
                padding: EdgeInsets.only(bottom: AppSpacing.sm),
                child: Text(
                  'Both times offered have already passed — suggest a new '
                  'time below.',
                  style: TextStyle(
                    fontSize: AppFont.sm,
                    color: AppColors.textSecondary,
                  ),
                ),
              )
            else
              for (final t in offered)
                _TimeOption(
                  label: friendlyCallTime(t),
                  subtitle: 'Requested by $name',
                  selected: _picked == t,
                  busy: _slotBusy(t),
                  onTap: _slotBusy(t)
                      ? null
                      : () => setState(() => _picked = t),
                ),

            if (_customPick != null)
              _TimeOption(
                label: friendlyCallTime(_customPick!),
                subtitle: 'Your suggestion',
                selected: _picked == _customPick,
                busy: false,
                onTap: () => setState(() => _picked = _customPick),
              ),

            _TimeOption(
              icon: Icons.calendar_month_rounded,
              label: 'Suggest another time',
              subtitle: 'Pick a day & slot — same picker the student uses',
              selected: false,
              busy: false,
              trailing: Icons.chevron_right_rounded,
              onTap: _suggestAnotherTime,
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
                          ? 'Pick a time'
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

/// One selectable time row — either one of the aspirant's exact offers, a
/// mentor-suggested alternative, or the "Suggest another time" escape
/// hatch. Styled to match `_WhenOption` in `call_request_sheet.dart` (kept
/// as a separate, file-local widget rather than shared — it's a small,
/// simple presentation and the two sheets' selection states don't overlap).
class _TimeOption extends StatelessWidget {
  const _TimeOption({
    required this.label,
    required this.subtitle,
    required this.selected,
    required this.busy,
    required this.onTap,
    this.icon = Icons.schedule_rounded,
    this.trailing,
  });

  final String label;
  final String subtitle;
  final bool selected;

  /// True when this exact time overlaps a call the mentor already
  /// confirmed — greyed, struck through, and not tappable (the backend
  /// would 409 it anyway).
  final bool busy;
  final VoidCallback? onTap;
  final IconData icon;
  final IconData? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Material(
        color: busy
            ? AppColors.background
            : selected
            ? AppColors.primaryLight
            : AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.md - 3),
            decoration: BoxDecoration(
              border: Border.all(
                color: selected ? AppColors.primary : AppColors.border,
                width: 1.5,
              ),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 20,
                  color: busy
                      ? AppColors.textMuted
                      : selected
                      ? AppColors.primaryDark
                      : AppColors.textSecondary,
                ),
                const SizedBox(width: AppSpacing.sm + 2),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: AppFont.sm,
                          fontWeight: AppFont.bold,
                          color: busy
                              ? AppColors.textMuted
                              : selected
                              ? AppColors.primaryDark
                              : AppColors.textPrimary,
                          decoration: busy
                              ? TextDecoration.lineThrough
                              : null,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        busy
                            ? "Busy — you've already confirmed a call then"
                            : subtitle,
                        style: const TextStyle(
                          fontSize: AppFont.xs,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                if (selected)
                  const Icon(
                    Icons.check_rounded,
                    size: 18,
                    color: AppColors.primary,
                  )
                else if (trailing != null && !busy)
                  Icon(trailing, size: 18, color: AppColors.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
