import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'call_time_windows.dart';

/// The "Custom time" leg of the call-request "When?" step. Pops a
/// [DateTime] (the chosen 30-minute slot) or null if the user backs out.
///
/// A day is ~48 half-hour slots — this never shows all of them at once. It
/// opens with the mentor's stated free windows expanded (marked "usually
/// free") and every other day-part collapsed to one tappable header. Any
/// hour is still reachable in one tap. On "Today", slots already in the
/// past are dropped.
class CustomCallTimeScreen extends StatefulWidget {
  const CustomCallTimeScreen({
    super.key,
    this.mentorWindows = const [],
    this.mentorName,
  });

  /// The mentor's `availableDays` (kTimeSlots strings). The matching
  /// day-parts open expanded and carry the "usually free" tag.
  final List<String> mentorWindows;
  final String? mentorName;

  @override
  State<CustomCallTimeScreen> createState() => _CustomCallTimeScreenState();
}

class _CustomCallTimeScreenState extends State<CustomCallTimeScreen> {
  int _dayIndex = 0;
  final Set<String> _manuallyExpanded = {};
  late final Set<int> _freeStartHours = mentorFreeDayParts(
    widget.mentorWindows,
  ).map((p) => p.startHour).toSet();

  List<DateTime> get _dayAnchors {
    final now = DateTime.now();
    final base = DateTime(now.year, now.month, now.day);
    return [0, 1, 2].map((n) => base.add(Duration(days: n))).toList();
  }

  bool _isFree(CallDayPart part) => _freeStartHours.contains(part.startHour);

  bool _isExpanded(CallDayPart part) =>
      _isFree(part) || _manuallyExpanded.contains(part.label);

  /// Every 30-minute slot inside [part] on the selected day, past ones on
  /// "Today" filtered out.
  List<DateTime> _slotsFor(CallDayPart part) {
    final day = _dayAnchors[_dayIndex];
    final cutoff = DateTime.now().add(const Duration(minutes: 10));
    final out = <DateTime>[];
    for (var h = part.startHour; h < part.endHour; h++) {
      for (final m in const [0, 30]) {
        final dt = DateTime(day.year, day.month, day.day, h, m);
        if (_dayIndex == 0 && dt.isBefore(cutoff)) continue;
        out.add(dt);
      }
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Pick a time'),
        backgroundColor: AppColors.surface,
      ),
      body: Column(
        children: [
          _DayTabs(
            anchors: _dayAnchors,
            selected: _dayIndex,
            onSelect: (i) => setState(() => _dayIndex = i),
          ),
          if (widget.mentorName != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                0,
                AppSpacing.lg,
                AppSpacing.sm,
              ),
              child: Text(
                'Green marks when ${widget.mentorName} is usually free — '
                'you can still pick any slot.',
                style: const TextStyle(
                  fontSize: AppFont.xs,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          Expanded(child: _buildList()),
        ],
      ),
    );
  }

  Widget _buildList() {
    final sections = <Widget>[];
    for (final part in kCallDayParts) {
      final slots = _slotsFor(part);
      if (slots.isEmpty) continue; // whole part is in the past (Today)

      final expanded = _isExpanded(part);
      sections.add(
        _SectionHeader(
          part: part,
          isFree: _isFree(part),
          expanded: expanded,
          hiddenCount: slots.length,
          onToggle: _isFree(part)
              ? null
              : () => setState(() {
                  if (!_manuallyExpanded.remove(part.label)) {
                    _manuallyExpanded.add(part.label);
                  }
                }),
        ),
      );
      if (expanded) {
        for (final dt in slots) {
          sections.add(
            _SlotRow(
              time: clockLabel(dt),
              outsideUsual: !_isFree(part),
              onTap: () => Navigator.of(context).pop(dt),
            ),
          );
        }
      }
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.xs,
        AppSpacing.lg,
        AppSpacing.xl,
      ),
      children: [
        if (sections.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xl),
            child: Text(
              "No time left today — try Tomorrow or the day after.",
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textSecondary,
              ),
            ),
          )
        else
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(children: sections),
          ),
      ],
    );
  }
}

class _DayTabs extends StatelessWidget {
  const _DayTabs({
    required this.anchors,
    required this.selected,
    required this.onSelect,
  });

  final List<DateTime> anchors;
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.md,
      ),
      child: Row(
        children: [
          for (var i = 0; i < anchors.length; i++) ...[
            if (i > 0) const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _DayTab(
                label: dayTabLabel(anchors[i]),
                sub: dayTabSubLabel(anchors[i]),
                selected: i == selected,
                onTap: () => onSelect(i),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _DayTab extends StatelessWidget {
  const _DayTab({
    required this.label,
    required this.sub,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String sub;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.primaryLight : AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
          decoration: BoxDecoration(
            border: Border.all(
              color: selected ? AppColors.primary : AppColors.border,
              width: 1.5,
            ),
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Column(
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: AppFont.sm,
                  fontWeight: AppFont.bold,
                  color: selected
                      ? AppColors.primaryDark
                      : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                sub,
                style: TextStyle(
                  fontSize: AppFont.xs,
                  color: selected ? AppColors.primaryDark : AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.part,
    required this.isFree,
    required this.expanded,
    required this.hiddenCount,
    required this.onToggle,
  });

  final CallDayPart part;
  final bool isFree;
  final bool expanded;
  final int hiddenCount;
  final VoidCallback? onToggle;

  @override
  Widget build(BuildContext context) {
    final title = Text(
      '${part.label.toUpperCase()}  ·  ${part.rangeLabel}',
      style: TextStyle(
        fontSize: AppFont.xs,
        fontWeight: AppFont.extraBold,
        letterSpacing: 0.4,
        color: isFree ? AppColors.textSecondary : AppColors.textMuted,
      ),
    );

    Widget trailing;
    if (isFree) {
      trailing = Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: AppColors.primaryLight,
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        child: const Text(
          'USUALLY FREE',
          style: TextStyle(
            fontSize: 9,
            fontWeight: AppFont.extraBold,
            color: AppColors.primaryDark,
            letterSpacing: 0.4,
          ),
        ),
      );
    } else {
      trailing = Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            expanded ? 'Hide' : 'Show $hiddenCount times',
            style: const TextStyle(
              fontSize: 10,
              fontWeight: AppFont.extraBold,
              color: AppColors.primaryDark,
            ),
          ),
          Icon(
            expanded
                ? Icons.keyboard_arrow_up_rounded
                : Icons.keyboard_arrow_down_rounded,
            size: 16,
            color: AppColors.primaryDark,
          ),
        ],
      );
    }

    final row = Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: const BoxDecoration(
        color: AppColors.background,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(child: title),
          trailing,
        ],
      ),
    );

    if (onToggle == null) return row;
    return Material(
      color: Colors.transparent,
      child: InkWell(onTap: onToggle, child: row),
    );
  }
}

class _SlotRow extends StatelessWidget {
  const _SlotRow({
    required this.time,
    required this.outsideUsual,
    required this.onTap,
  });

  final String time;
  final bool outsideUsual;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.md - 2,
          ),
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  time,
                  style: const TextStyle(
                    fontSize: AppFont.sm,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              if (outsideUsual)
                const Text(
                  'outside usual hours',
                  style: TextStyle(
                    fontSize: AppFont.xs,
                    color: AppColors.textMuted,
                  ),
                )
              else
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppColors.textMuted,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
