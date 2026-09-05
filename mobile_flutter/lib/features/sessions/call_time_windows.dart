/// Shared time helpers for the call-request "When?" step and the custom
/// slot picker. Kept in one place so the sheet and the picker screen can't
/// drift on how a mentor's stated free-window maps to a concrete time.
///
/// No `intl` dependency in this project — the formatters here are
/// hand-rolled, matching the pattern already used elsewhere (see
/// mentor_landing_screen._RecentSessionCard).
library;

/// A slice of the day the custom picker groups slots under. Order here is
/// the order they render (earliest first).
class CallDayPart {
  const CallDayPart(this.label, this.rangeLabel, this.startHour, this.endHour);

  final String label;
  final String rangeLabel;

  /// Inclusive start, exclusive end, 24h. Slots are every 30 min in
  /// `[startHour, endHour)`.
  final int startHour;
  final int endHour;
}

const List<CallDayPart> kCallDayParts = [
  CallDayPart('Early hours', '12 – 6 AM', 0, 6),
  CallDayPart('Morning', '6 AM – 12 PM', 6, 12),
  CallDayPart('Afternoon', '12 – 4 PM', 12, 16),
  CallDayPart('Evening', '4 – 8 PM', 16, 20),
  CallDayPart('Night', '8 – 11 PM', 20, 23),
];

/// The mentor stores their free-time windows as `kTimeSlots` strings
/// ("Morning (6 AM - 12 PM)" …). Maps one to its start hour, or null if it
/// isn't a recognised value.
int? startHourForTimeSlot(String value) {
  switch (value.trim()) {
    case 'Morning (6 AM - 12 PM)':
      return 6;
    case 'Afternoon (12 PM - 4 PM)':
      return 12;
    case 'Evening (4 PM - 8 PM)':
      return 16;
    case 'Night (8 PM - 11 PM)':
      return 20;
  }
  return null;
}

/// The [CallDayPart]s the mentor marked as "usually free", in render order.
List<CallDayPart> mentorFreeDayParts(List<String> mentorWindows) {
  final hours = mentorWindows
      .map(startHourForTimeSlot)
      .whereType<int>()
      .toSet();
  return kCallDayParts.where((p) => hours.contains(p.startHour)).toList();
}

/// The next real datetime a "Morning/Evening/…" quick-pick resolves to:
/// - window still ahead today  → today at its start
/// - window live right now      → the next half-hour inside it
/// - window already over today  → tomorrow at its start
DateTime nextOccurrenceOfWindow(
  int startHour,
  int endHour, [
  DateTime? nowArg,
]) {
  final now = nowArg ?? DateTime.now();
  final todayStart = DateTime(now.year, now.month, now.day, startHour);
  final todayEnd = DateTime(now.year, now.month, now.day, endHour);

  if (now.isBefore(todayStart)) return todayStart;
  if (now.isBefore(todayEnd)) {
    final soon = now.add(const Duration(minutes: 5));
    final ceil = _ceilToHalfHour(soon);
    return ceil.isBefore(todayEnd)
        ? ceil
        : todayStart.add(const Duration(days: 1));
  }
  return todayStart.add(const Duration(days: 1));
}

DateTime _ceilToHalfHour(DateTime dt) {
  if (dt.minute == 0 || dt.minute == 30) {
    return DateTime(dt.year, dt.month, dt.day, dt.hour, dt.minute);
  }
  if (dt.minute < 30) {
    return DateTime(dt.year, dt.month, dt.day, dt.hour, 30);
  }
  return DateTime(
    dt.year,
    dt.month,
    dt.day,
    dt.hour,
  ).add(const Duration(hours: 1));
}

const _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// "9:00 AM"
String clockLabel(DateTime dt) {
  final local = dt.toLocal();
  final h = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final m = local.minute.toString().padLeft(2, '0');
  return '$h:$m ${local.hour < 12 ? 'AM' : 'PM'}';
}

/// "Today, 9:00 AM" / "Tomorrow, 4:30 PM" / "Sat, Sep 6, 9:00 AM"
String friendlyCallTime(DateTime dt) {
  final local = dt.toLocal();
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(local.year, local.month, local.day);
  final delta = day.difference(today).inDays;
  final t = clockLabel(local);
  if (delta == 0) return 'Today, $t';
  if (delta == 1) return 'Tomorrow, $t';
  return '${_weekdays[local.weekday - 1]}, ${_months[local.month - 1]} ${local.day}, $t';
}

/// "Today" / "Tomorrow" / "Sat 6" — for the picker's day tabs.
String dayTabLabel(DateTime day) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final d = DateTime(day.year, day.month, day.day);
  final delta = d.difference(today).inDays;
  if (delta == 0) return 'Today';
  if (delta == 1) return 'Tomorrow';
  return '${_weekdays[d.weekday - 1]} ${d.day}';
}

/// "Fri 6" / "Sep 8" — the small caption under a day tab.
String dayTabSubLabel(DateTime day) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final d = DateTime(day.year, day.month, day.day);
  final delta = d.difference(today).inDays;
  if (delta <= 1) return '${_weekdays[d.weekday - 1]} ${d.day}';
  return '${_months[d.month - 1]} ${d.day}';
}
