import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// Shared building blocks for the multi-step post-signup onboarding wizards
/// (AspirantOnboardingScreen, MentorOnboardingScreen) — kept in one place so
/// the two flows share the same look and feel.

/// Age-confirmation gate shown right before a profile is submitted in
/// either onboarding wizard — same wording as the web enrollment site's
/// dialog (product name is "Uniscope", not "Zenter"). Returns true only if
/// the user ticked the box and hit Continue; false on Cancel or dismiss.
Future<bool> showAgeConfirmationDialog(BuildContext context) async {
  final result = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (_) => const _AgeConfirmationDialog(),
  );
  return result ?? false;
}

class _AgeConfirmationDialog extends StatefulWidget {
  const _AgeConfirmationDialog();

  @override
  State<_AgeConfirmationDialog> createState() => _AgeConfirmationDialogState();
}

class _AgeConfirmationDialogState extends State<_AgeConfirmationDialog> {
  bool _agreed = false;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Age confirmation (18+)'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'By continuing, you confirm that you are 18 years of age or '
            'older. If you are under 18 years of age, please access Uniscope '
            'only under the supervision and guidance of your parent or legal '
            'guardian.',
            style: TextStyle(
              fontSize: AppFont.sm,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          InkWell(
            onTap: () => setState(() => _agreed = !_agreed),
            borderRadius: BorderRadius.circular(AppRadius.sm),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Checkbox(
                  value: _agreed,
                  onChanged: (v) => setState(() => _agreed = v ?? false),
                  activeColor: AppColors.primary,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  visualDensity: VisualDensity.compact,
                ),
                const SizedBox(width: AppSpacing.xs),
                const Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(top: 10),
                    child: Text(
                      'I have read and agree to the above.',
                      style: TextStyle(
                        fontSize: AppFont.sm,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed:
              _agreed ? () => Navigator.of(context).pop(true) : null,
          child: const Text('Continue'),
        ),
      ],
    );
  }
}

class OnboardingProgressBar extends StatelessWidget {
  const OnboardingProgressBar({super.key, required this.step, required this.total});
  final int step;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
      child: Row(
        children: List.generate(total, (i) {
          final active = i <= step;
          return Expanded(
            child: Container(
              margin: EdgeInsets.only(right: i == total - 1 ? 0 : AppSpacing.xs),
              height: 4,
              decoration: BoxDecoration(
                color: active ? AppColors.primary : AppColors.border,
                borderRadius: BorderRadius.circular(AppRadius.full),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class OnboardingStepScaffold extends StatelessWidget {
  const OnboardingStepScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    this.children = const [],
    this.expandedChild,
  });
  final String title;
  final String subtitle;
  final List<Widget> children;

  /// When given, the step is a fixed header + this widget filling the rest
  /// of the viewport (the page itself doesn't scroll) — for a step whose
  /// body scrolls itself, like the avatar picker with its pinned preview.
  /// Mutually exclusive with [children].
  final Widget? expandedChild;

  @override
  Widget build(BuildContext context) {
    final header = [
      Text(
        title,
        style: const TextStyle(
          fontSize: AppFont.xl,
          fontWeight: AppFont.bold,
          color: AppColors.textPrimary,
        ),
      ),
      const SizedBox(height: AppSpacing.xs),
      Text(
        subtitle,
        style: const TextStyle(
          fontSize: AppFont.sm,
          color: AppColors.textSecondary,
          height: 1.4,
        ),
      ),
    ];

    if (expandedChild != null) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.xl,
          AppSpacing.xl,
          AppSpacing.xl,
          0,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ...header,
            const SizedBox(height: AppSpacing.lg),
            Expanded(child: expandedChild!),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ...header,
          const SizedBox(height: AppSpacing.xl),
          ...children,
        ],
      ),
    );
  }
}

class OnboardingFieldLabel extends StatelessWidget {
  const OnboardingFieldLabel(this.label, {super.key});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: AppFont.sm,
          fontWeight: AppFont.semibold,
          color: AppColors.textPrimary,
        ),
      ),
    );
  }
}

class OnboardingDropdown extends StatelessWidget {
  const OnboardingDropdown({
    super.key,
    required this.value,
    required this.hint,
    required this.options,
    required this.onChanged,
    this.enabled = true,
  });
  final String? value;
  final String hint;
  final List<String> options;
  final ValueChanged<String?> onChanged;

  /// False disables the dropdown entirely (e.g. City before a State is
  /// picked) — passing `onChanged: null` is what Flutter's own
  /// DropdownButtonFormField uses to render its disabled state.
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      isExpanded: true,
      hint: Text(hint),
      items: options.map((o) => DropdownMenuItem(value: o, child: Text(o))).toList(),
      onChanged: enabled ? onChanged : null,
    );
  }
}

class OnboardingDateField extends StatelessWidget {
  const OnboardingDateField({super.key, required this.value, required this.onTap});
  final DateTime? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = value == null
        ? 'Select date of birth'
        : '${value!.day.toString().padLeft(2, '0')}/'
            '${value!.month.toString().padLeft(2, '0')}/${value!.year}';
    return InkWell(
      onTap: onTap,
      child: InputDecorator(
        decoration: const InputDecoration(),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: TextStyle(
                color: value == null ? AppColors.textMuted : AppColors.textPrimary,
              ),
            ),
            const Icon(Icons.calendar_today_rounded, size: 18, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

class OnboardingChipGroup extends StatelessWidget {
  const OnboardingChipGroup({
    super.key,
    required this.options,
    required this.selected,
    required this.onToggle,
    this.maxSelections,
  });
  final List<String> options;
  final Set<String> selected;
  final void Function(String option, bool value) onToggle;

  /// Caps how many chips can be selected at once (e.g. mentor "Preferred
  /// Timing": at most 2). Null (the default) means unlimited, unchanged
  /// behavior for every other caller. Once the cap is hit, unselected chips
  /// render disabled rather than silently rejecting the tap — a mentor
  /// shouldn't have to guess why a chip stopped responding.
  final int? maxSelections;

  @override
  Widget build(BuildContext context) {
    final atCap = maxSelections != null && selected.length >= maxSelections!;
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: options.map((option) {
        final isSelected = selected.contains(option);
        final disabled = atCap && !isSelected;
        return FilterChip(
          label: Text(option),
          selected: isSelected,
          onSelected: disabled ? null : (v) => onToggle(option, v),
          selectedColor: AppColors.primaryLight,
          checkmarkColor: AppColors.primary,
          labelStyle: TextStyle(
            fontSize: AppFont.sm,
            color: isSelected
                ? AppColors.primaryDark
                : disabled
                    ? AppColors.textMuted
                    : AppColors.textSecondary,
            fontWeight: isSelected ? AppFont.semibold : AppFont.medium,
          ),
          side: BorderSide(color: isSelected ? AppColors.primary : AppColors.border),
        );
      }).toList(),
    );
  }
}

/// Single-select variant of [OnboardingChipGroup] — for fields like Gender,
/// Degree, or Stream/Field where exactly one choice makes sense, rather than
/// a multi-select set (languages, goals).
class OnboardingSingleChipGroup extends StatelessWidget {
  const OnboardingSingleChipGroup({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelect,
  });
  final List<String> options;
  final String? selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: options.map((option) {
        final isSelected = selected == option;
        return ChoiceChip(
          label: Text(option),
          selected: isSelected,
          onSelected: (_) => onSelect(option),
          selectedColor: AppColors.primaryLight,
          labelStyle: TextStyle(
            fontSize: AppFont.sm,
            color: isSelected ? AppColors.primaryDark : AppColors.textSecondary,
            fontWeight: isSelected ? AppFont.semibold : AppFont.medium,
          ),
          side: BorderSide(color: isSelected ? AppColors.primary : AppColors.border),
        );
      }).toList(),
    );
  }
}

/// On/off switch with a label and optional hint below it — used for the
/// "keep this private" choice on year-of-study / graduation year.
/// A read-only field that opens a searchable, scrollable option sheet on
/// tap — for lists too long for a plain [OnboardingDropdown] (Medical has
/// ~100 specializations). Same idea as the web enrollment form's
/// SearchableCombobox and the Discover tab's own picker sheet.
class OnboardingSearchableField extends StatelessWidget {
  const OnboardingSearchableField({
    super.key,
    required this.value,
    required this.hint,
    required this.options,
    required this.onChanged,
    this.sheetTitle,
    this.widenedOptions,
  });

  final String? value;
  final String hint;
  final List<String> options;
  final ValueChanged<String?> onChanged;
  final String? sheetTitle;
  /// A broader option pool the sheet's search falls back to once the user
  /// types something — [options] alone stays the list shown with nothing
  /// typed. Lets a field default to a narrow, scoped list (e.g. a picked
  /// college's own specializations) while still surfacing a real option
  /// that just isn't in that narrow list once the user searches for it —
  /// mirrors web's SearchableCombobox "browse = scoped / search =
  /// everything" split. Leave null when [options] is already the full set.
  final List<String>? widenedOptions;

  Future<void> _open(BuildContext context) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      builder: (_) => _SearchableOptionSheet(
        title: sheetTitle ?? hint,
        options: options,
        widenedOptions: widenedOptions,
        selected: value,
      ),
    );
    if (picked != null) onChanged(picked);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = options.isNotEmpty;
    return InkWell(
      onTap: enabled ? () => _open(context) : null,
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: InputDecorator(
        decoration: const InputDecoration(),
        isEmpty: value == null,
        child: Row(
          children: [
            Expanded(
              child: Text(
                value ?? hint,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: AppFont.md,
                  color: value == null
                      ? AppColors.textMuted
                      : AppColors.textPrimary,
                ),
              ),
            ),
            const Icon(Icons.expand_more_rounded, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

class _SearchableOptionSheet extends StatefulWidget {
  const _SearchableOptionSheet({
    required this.title,
    required this.options,
    required this.selected,
    this.widenedOptions,
  });
  final String title;
  final List<String> options;
  final String? selected;
  final List<String>? widenedOptions;

  @override
  State<_SearchableOptionSheet> createState() => _SearchableOptionSheetState();
}

class _SearchableOptionSheetState extends State<_SearchableOptionSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final q = _query.trim().toLowerCase();
    // With nothing typed, show the narrow (e.g. college-scoped) list as-is.
    // Once searching, widen the pool first so a real option outside the
    // narrow list is still findable, then filter that wider pool.
    final pool = q.isEmpty ? widget.options : (widget.widenedOptions ?? widget.options);
    final filtered = q.isEmpty
        ? pool
        : pool.where((o) => o.toLowerCase().contains(q)).toList(growable: false);
    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.md,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.md,
      ),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.7,
        child: Column(
          children: [
            Text(
              widget.title,
              style: const TextStyle(
                fontSize: AppFont.md,
                fontWeight: AppFont.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              autofocus: true,
              onChanged: (v) => setState(() => _query = v),
              decoration: const InputDecoration(
                hintText: 'Search…',
                prefixIcon: Icon(Icons.search_rounded),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Expanded(
              child: filtered.isEmpty
                  ? const Center(
                      child: Text(
                        'No matches',
                        style: TextStyle(color: AppColors.textMuted),
                      ),
                    )
                  : ListView.builder(
                      itemCount: filtered.length,
                      itemBuilder: (context, i) {
                        final o = filtered[i];
                        final isSelected = o == widget.selected;
                        return ListTile(
                          title: Text(o),
                          trailing: isSelected
                              ? const Icon(Icons.check_rounded,
                                  color: AppColors.primary)
                              : null,
                          onTap: () => Navigator.of(context).pop(o),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class OnboardingToggle extends StatelessWidget {
  const OnboardingToggle({
    super.key,
    required this.value,
    required this.onChanged,
    required this.label,
    this.hint,
  });
  final bool value;
  final ValueChanged<bool> onChanged;
  final String label;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Switch(value: value, onChanged: onChanged, activeThumbColor: AppColors.primary),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: AppFont.sm,
                    fontWeight: AppFont.semibold,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (hint != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    hint!,
                    style: const TextStyle(fontSize: AppFont.xs, color: AppColors.textMuted),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}
