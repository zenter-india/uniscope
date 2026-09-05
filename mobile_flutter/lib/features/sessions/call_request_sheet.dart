import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/sessions_api.dart';
import '../../core/network/wallet_api.dart';
import '../../core/theme/app_theme.dart';
import 'call_time_windows.dart';
import 'custom_call_time_screen.dart';
import 'session_list_screen.dart' show sessionsListProvider;

/// What the sheet hands back: the slot length plus, for a non-Instant pick,
/// the time the aspirant wants to connect (null = Instant).
class _CallRequestResult {
  const _CallRequestResult(this.slotMinutes, this.requestedFor);
  final int slotMinutes;
  final DateTime? requestedFor;
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
          requestedFor: result.requestedFor,
        );
    // Without this, neither the persistent session dock nor the Sessions
    // tab would show the new request until something else happened to
    // refresh sessionsListProvider — defeating the dock's whole point.
    ref.invalidate(sessionsListProvider);
    if (!context.mounted) return;
    final when = result.requestedFor;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          when == null
              ? 'Call requested — check the Sessions tab'
              : 'Call requested for ${friendlyCallTime(when)} — '
                    'check the Sessions tab',
        ),
      ),
    );
  } catch (e) {
    if (!context.mounted) return;
    final message = e is DioException ? (e.message ?? '$e') : '$e';
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

/// The "When?" selection: Instant, one of the mentor's free windows (by
/// index into the resolved list), or a custom slot.
sealed class _WhenChoice {
  const _WhenChoice();
}

class _Instant extends _WhenChoice {
  const _Instant();
}

class _WindowChoice extends _WhenChoice {
  const _WindowChoice(this.part);
  final CallDayPart part;
}

class _CustomChoice extends _WhenChoice {
  const _CustomChoice(this.time);
  final DateTime time;
}

class _CallRequestSheet extends StatefulWidget {
  const _CallRequestSheet({this.mentorName, this.mentorWindows = const []});
  final String? mentorName;
  final List<String> mentorWindows;

  @override
  State<_CallRequestSheet> createState() => _CallRequestSheetState();
}

class _CallRequestSheetState extends State<_CallRequestSheet> {
  int _slotMinutes = kCallSlotMinutes.first;
  _WhenChoice _when = const _Instant();

  late final List<CallDayPart> _windows = mentorFreeDayParts(
    widget.mentorWindows,
  );

  DateTime? _resolvedTime() {
    final w = _when;
    return switch (w) {
      _Instant() => null,
      _WindowChoice(:final part) => nextOccurrenceOfWindow(
        part.startHour,
        part.endHour,
      ),
      _CustomChoice(:final time) => time,
    };
  }

  bool _sameChoice(_WhenChoice a, _WhenChoice b) {
    if (a is _Instant && b is _Instant) return true;
    if (a is _WindowChoice && b is _WindowChoice) {
      return a.part.startHour == b.part.startHour;
    }
    if (a is _CustomChoice && b is _CustomChoice) return a.time == b.time;
    return false;
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
    if (picked != null && mounted) {
      setState(() => _when = _CustomChoice(picked));
    }
  }

  @override
  Widget build(BuildContext context) {
    final cost = slotUniminutes(_slotMinutes);
    final resolved = _resolvedTime();

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

            _sectionLabel('When?'),
            const SizedBox(height: AppSpacing.sm),
            _WhenOption(
              icon: Icons.bolt_rounded,
              title: 'Instant connect',
              subtitle: 'Send the request now — connect once they accept',
              selected: _when is _Instant,
              onTap: () => setState(() => _when = const _Instant()),
            ),
            for (final part in _windows)
              _WhenOption(
                icon: Icons.schedule_rounded,
                title: '${part.label} · ${part.rangeLabel}',
                subtitle:
                    'Mentor · next: ${friendlyCallTime(nextOccurrenceOfWindow(part.startHour, part.endHour))}',
                selected: _sameChoice(_when, _WindowChoice(part)),
                onTap: () => setState(() => _when = _WindowChoice(part)),
              ),
            _WhenOption(
              icon: Icons.calendar_month_rounded,
              title: 'Custom time',
              subtitle: _when is _CustomChoice
                  ? friendlyCallTime((_when as _CustomChoice).time)
                  : 'Pick a day & slot — today, tomorrow or the day after',
              selected: _when is _CustomChoice,
              trailing: Icons.chevron_right_rounded,
              onTap: _pickCustom,
            ),

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
              '${uniminutesLabel(cost)} are deducted once the call connects.',
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
                ).pop(_CallRequestResult(_slotMinutes, resolved)),
                child: Text(
                  resolved == null
                      ? 'Request call'
                      : 'Request call · ${friendlyCallTime(resolved)}',
                ),
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
