import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/sessions_api.dart';
import '../../core/network/wallet_api.dart';
import '../../core/theme/app_theme.dart';
import 'call_time_windows.dart';
import 'custom_call_time_screen.dart';
import 'session_list_screen.dart' show sessionsListProvider;

/// What the sheet hands back: the slot length plus the aspirant's preferred
/// time(s). [times] is empty for Instant, or holds 1–2 options for the
/// mentor to pick between.
class _CallRequestResult {
  const _CallRequestResult(this.slotMinutes, this.times);
  final int slotMinutes;
  final List<DateTime> times;
}

/// Opens the call-request sheet — a "When?" step (Instant / one of the
/// mentor's stated free windows / a custom slot) and a "How long?" step
/// (6/10/20 min) — and requests an AUDIO_CALL with [mentorId] if the
/// aspirant confirms. Cost is expressed in Uniminutes only; rupees never
/// appear outside the wallet top-up sheet.
///
/// [mentorWindows] is the mentor's `availableDays` (kTimeSlots strings) —
/// pass what the caller already has so the "When?" quick-picks show without
/// a second fetch. Empty is fine: the sheet then offers just Instant +
/// Custom.
Future<void> showCallRequestSheet(
  BuildContext context,
  WidgetRef ref, {
  required String mentorId,
  String? mentorName,
  List<String> mentorWindows = const [],
}) async {
  final result = await showModalBottomSheet<_CallRequestResult>(
    context: context,
    backgroundColor: AppColors.surface,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (_) =>
        _CallRequestSheet(mentorName: mentorName, mentorWindows: mentorWindows),
  );

  if (result == null || !context.mounted) return;

  try {
    await ref
        .read(sessionsApiProvider)
        .create(
          mentorId,
          SessionKind.audioCall,
          slotMinutes: result.slotMinutes,
          requestedFor: result.times.isEmpty ? null : result.times.first,
          requestedForAlt: result.times.length > 1 ? result.times[1] : null,
        );
    // Without this, neither the persistent session dock nor the Sessions
    // tab would show the new request until something else happened to
    // refresh sessionsListProvider — defeating the dock's whole point.
    ref.invalidate(sessionsListProvider);
    if (!context.mounted) return;
    final times = result.times;
    final String msg;
    if (times.isEmpty) {
      msg = 'Call requested — check the Sessions tab';
    } else if (times.length == 1) {
      msg =
          'Call requested for ${friendlyCallTime(times.first)} — '
          'check the Sessions tab';
    } else {
      msg =
          'Call requested — you offered 2 times, the mentor picks one. '
          'Check the Sessions tab.';
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  } catch (e) {
    if (!context.mounted) return;
    final message = e is DioException ? (e.message ?? '$e') : '$e';
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _CallRequestSheet extends StatefulWidget {
  const _CallRequestSheet({this.mentorName, this.mentorWindows = const []});
  final String? mentorName;
  final List<String> mentorWindows;

  @override
  State<_CallRequestSheet> createState() => _CallRequestSheetState();
}

class _CallRequestSheetState extends State<_CallRequestSheet> {
  static const _maxTimes = 2;

  int _slotMinutes = kCallSlotMinutes.first;

  /// The aspirant's preferred connect time(s). Empty = Instant. 1–2 entries
  /// are offered to the mentor as options to pick between.
  final List<DateTime> _times = [];

  bool get _instant => _times.isEmpty;

  /// The mentor free-window (by start hour) currently expanded to show its
  /// individual half-hour slots — null if none is expanded.
  int? _expandedWindowStart;

  late final List<CallDayPart> _windows = mentorFreeDayParts(
    widget.mentorWindows,
  );

  void _pickInstant() => setState(_times.clear);

  /// Add/remove [time] from the picks. Removing is always allowed; adding is
  /// capped at [_maxTimes] — a third pick bumps the oldest so tapping keeps
  /// giving you the last two.
  void _toggleTime(DateTime time) {
    setState(() {
      if (_times.remove(time)) return;
      if (_times.length >= _maxTimes) _times.removeAt(0);
      _times.add(time);
      _times.sort();
    });
  }

  /// Any pick falls inside [part]'s window — shows a check on that row.
  bool _isWindowSelected(CallDayPart part) =>
      _times.any((t) => t.hour >= part.startHour && t.hour < part.endHour);

  void _toggleWindow(CallDayPart part) {
    setState(() {
      _expandedWindowStart = _expandedWindowStart == part.startHour
          ? null
          : part.startHour;
    });
  }

  void _pickSlot(DateTime time) {
    _toggleTime(time);
    setState(() => _expandedWindowStart = null);
  }

  Future<void> _pickCustom() async {
    final picked = await Navigator.of(context).push<DateTime>(
      MaterialPageRoute(
        builder: (_) => CustomCallTimeScreen(
          mentorWindows: widget.mentorWindows,
          mentorName: widget.mentorName,
        ),
      ),
    );
    if (picked != null && mounted) _toggleTime(picked);
  }

  @override
  Widget build(BuildContext context) {
    final cost = slotUniminutes(_slotMinutes);

    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.lg + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
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
                fontSize: AppFont.lg,
                fontWeight: AppFont.extraBold,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            Row(
              children: [
                _sectionLabel('When?'),
                const SizedBox(width: 6),
                Text(
                  '(offer up to 2 times)',
                  style: const TextStyle(
                    fontSize: AppFont.xs,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            _WhenOption(
              icon: Icons.bolt_rounded,
              title: 'Instant connect',
              subtitle: 'Send the request now — connect once they accept',
              selected: _instant,
              onTap: _pickInstant,
            ),
            for (final part in _windows) ...[
              _WhenOption(
                icon: Icons.schedule_rounded,
                title: '${part.label} · ${part.rangeLabel}',
                subtitle: 'Mentor · tap to pick a time',
                selected: _isWindowSelected(part),
                trailing: _expandedWindowStart == part.startHour
                    ? Icons.keyboard_arrow_up_rounded
                    : Icons.keyboard_arrow_down_rounded,
                onTap: () => _toggleWindow(part),
              ),
              if (_expandedWindowStart == part.startHour)
                _HalfHourSlotPicker(
                  part: part,
                  selectedTimes: _times,
                  onPick: _pickSlot,
                ),
            ],
            _WhenOption(
              icon: Icons.calendar_month_rounded,
              title: 'Custom time',
              subtitle: 'Pick a day & slot — today, tomorrow or the day after',
              selected: false,
              trailing: Icons.chevron_right_rounded,
              onTap: _pickCustom,
            ),
            if (_times.isNotEmpty) ...[
              const SizedBox(height: 2),
              _PickedTimesBar(times: _times, onRemove: _toggleTime),
            ],

            const SizedBox(height: AppSpacing.lg),
            _sectionLabel('How long?'),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: kCallSlotMinutes.map((m) {
                final selected = _slotMinutes == m;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(right: AppSpacing.sm),
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        backgroundColor: selected
                            ? AppColors.primaryLight
                            : null,
                        foregroundColor: selected
                            ? AppColors.primaryDark
                            : AppColors.textPrimary,
                        side: BorderSide(
                          color: selected
                              ? AppColors.primary
                              : AppColors.border,
                          width: 1.5,
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 10,
                        ),
                      ),
                      onPressed: () => setState(() => _slotMinutes = m),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('$m min'),
                          const SizedBox(height: 2),
                          // Shrink-to-fit so "10 Uniminutes" stays on one
                          // line inside the narrow 3-across slot card.
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              uniminutesLabel(slotUniminutes(m)),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: AppFont.regular,
                                color: selected
                                    ? AppColors.primaryDark
                                    : AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '${uniminutesLabel(cost)} reserved now — charged only when the '
              'call connects, released if it doesn\'t.',
              style: const TextStyle(
                fontSize: AppFont.xs,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(
                  context,
                ).pop(_CallRequestResult(_slotMinutes, List.of(_times))),
                child: Text(switch (_times.length) {
                  0 => 'Request call',
                  1 => 'Request call · ${friendlyCallTime(_times.first)}',
                  _ => 'Request call · 2 options',
                }),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(String text) => Text(
    text,
    style: const TextStyle(
      fontWeight: AppFont.extraBold,
      fontSize: AppFont.xs,
      letterSpacing: 0.6,
      color: AppColors.textSecondary,
    ),
  );
}

class _WhenOption extends StatelessWidget {
  const _WhenOption({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;
  final IconData? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Material(
        color: selected ? AppColors.primaryLight : AppColors.surface,
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
                  color: selected
                      ? AppColors.primaryDark
                      : AppColors.textSecondary,
                ),
                const SizedBox(width: AppSpacing.sm + 2),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: AppFont.sm,
                          fontWeight: AppFont.bold,
                          color: selected
                              ? AppColors.primaryDark
                              : AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        subtitle,
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
                else if (trailing != null)
                  Icon(trailing, size: 18, color: AppColors.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Shown under a tapped mentor free-window row — splits that 4-hour window
/// into its individual 30-minute slots (today's occurrence, or tomorrow's
/// if today's window has already passed) so the aspirant can pick an exact
/// time instead of just "sometime in this block".
class _HalfHourSlotPicker extends StatelessWidget {
  const _HalfHourSlotPicker({
    required this.part,
    required this.selectedTimes,
    required this.onPick,
  });

  final CallDayPart part;
  final List<DateTime> selectedTimes;
  final ValueChanged<DateTime> onPick;

  @override
  Widget build(BuildContext context) {
    final day = windowAnchorDay(part.startHour, part.endHour);
    final slots = halfHourSlotsInWindow(part.startHour, part.endHour, day);

    if (slots.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(bottom: AppSpacing.sm),
        child: Text(
          'No slots left in this window today.',
          style: TextStyle(fontSize: AppFont.xs, color: AppColors.textMuted),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(
        left: AppSpacing.md,
        bottom: AppSpacing.sm,
      ),
      child: Wrap(
        spacing: AppSpacing.xs,
        runSpacing: AppSpacing.xs,
        children: [
          for (final dt in slots)
            _SlotChip(
              label: clockLabel(dt),
              selected: selectedTimes.contains(dt),
              onTap: () => onPick(dt),
            ),
        ],
      ),
    );
  }
}

class _SlotChip extends StatelessWidget {
  const _SlotChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.primary : AppColors.background,
      borderRadius: BorderRadius.circular(AppRadius.full),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.full),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm + 2,
            vertical: 6,
          ),
          decoration: BoxDecoration(
            border: Border.all(
              color: selected ? AppColors.primary : AppColors.border,
            ),
            borderRadius: BorderRadius.circular(AppRadius.full),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: AppFont.xs,
              fontWeight: AppFont.bold,
              color: selected ? Colors.white : AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}

/// The 1–2 preferred times the aspirant has picked, each removable. Makes
/// the "offer up to 2" state visible in one place regardless of which
/// window/custom row each pick came from.
class _PickedTimesBar extends StatelessWidget {
  const _PickedTimesBar({required this.times, required this.onRemove});

  final List<DateTime> times;
  final ValueChanged<DateTime> onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            times.length == 1
                ? 'Offering 1 time'
                : 'Offering 2 times — the mentor picks one',
            style: const TextStyle(
              fontSize: AppFont.xs,
              fontWeight: AppFont.bold,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              for (final t in times)
                Material(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(AppRadius.full),
                  child: InkWell(
                    onTap: () => onRemove(t),
                    borderRadius: BorderRadius.circular(AppRadius.full),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 6, 8, 6),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            friendlyCallTime(t),
                            style: const TextStyle(
                              fontSize: AppFont.xs,
                              fontWeight: AppFont.bold,
                              color: AppColors.primaryDark,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.close_rounded,
                            size: 14,
                            color: AppColors.primaryDark,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
