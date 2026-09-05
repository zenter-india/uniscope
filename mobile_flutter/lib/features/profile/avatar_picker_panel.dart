import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import 'avatar_options.dart';

const _previewDebounce = Duration(milliseconds: 200);

/// Embeddable avatar picker — used standalone inside [AvatarCustomizerScreen]
/// (Profile → pencil badge) and inline as an onboarding wizard step. The
/// wizard reads the in-progress selection via a `GlobalKey<AvatarPickerPanelState>`
/// and persists it itself when the user taps Continue; this widget never
/// saves anything on its own.
class AvatarPickerPanel extends ConsumerStatefulWidget {
  const AvatarPickerPanel({
    super.key,
    this.initialGenderText,
    this.startFromFirstOption = false,
    this.showInlinePreview = true,
    this.onPreviewChanged,
  });

  /// When false, the panel omits the big preview avatar at the top —
  /// [AvatarCustomizerScreen] turns this off so it can pin its own copy
  /// above the scroll instead. The onboarding wizards leave it on.
  final bool showInlinePreview;

  /// Fires whenever the live preview updates (rendered SVG, and the saved
  /// avatar URL fallback), so a pinned external preview can stay in sync
  /// while the option list scrolls underneath it.
  final void Function(String? previewSvg, String? previewUrl)? onPreviewChanged;

  /// Seeds the gender toggle — e.g. the 'Male'/'Female'/'Other' value the
  /// user already picked earlier in the same wizard, before it's persisted
  /// to their profile. Falls back to the saved profile gender, then to
  /// Male, when not given (the standalone customizer passes nothing and
  /// relies on the profile fetch instead).
  final String? initialGenderText;

  /// When true, always seeds every category from the first catalog option
  /// instead of the account's existing (randomly auto-assigned at signup)
  /// avatar config — used by the onboarding wizards so the "Choose Your
  /// Avatar" step shows one consistent, fully-populated starting look
  /// rather than a different random avatar per signup. The standalone
  /// customizer (Edit Profile) leaves this false so it keeps showing
  /// whatever the user actually has saved.
  final bool startFromFirstOption;

  @override
  ConsumerState<AvatarPickerPanel> createState() => AvatarPickerPanelState();
}

class AvatarPickerPanelState extends ConsumerState<AvatarPickerPanel> {
  Map<String, dynamic>? _catalog;
  Map<String, dynamic>? _config;
  String? _previewUrl;
  String? _previewSvg;
  AvatarGender _gender = AvatarGender.male;
  bool _loading = true;
  String? _error;
  Timer? _debounce;

  /// The wizard/customizer reads this to decide what to persist.
  Map<String, dynamic>? get currentConfig => _config;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  List<dynamic> _visibleOptions(String key) {
    final serverValues = (_catalog![key] as List).toSet();
    final curated = switch (key) {
      'top' => topsByGender[_gender]!,
      'facialHair' => facialHairByGender[_gender]!,
      _ => curatedOptions[key] ?? _catalog![key] as List,
    };
    final visible = curated.where((v) => serverValues.contains(v)).toList();
    return visible.isEmpty ? (_catalog![key] as List) : visible;
  }

  void _setGender(AvatarGender gender) {
    setState(() {
      _gender = gender;
      // 'top' and 'facialHair' are the two gender-curated categories —
      // re-pick either if the current choice fell outside the new set.
      for (final key in ['top', 'facialHair']) {
        final options = _visibleOptions(key);
        if (!options.contains(_config![key])) {
          _config![key] = options.first;
        }
      }
    });
    _schedulePreview();
  }

  void _schedulePreview() {
    _debounce?.cancel();
    _debounce = Timer(_previewDebounce, () async {
      if (_config == null) return;
      try {
        final svg =
            await ref.read(usersApiProvider).previewAvatarConfig(_config!);
        if (!mounted) return;
        setState(() => _previewSvg = svg);
        widget.onPreviewChanged?.call(_previewSvg, _previewUrl);
      } catch (_) {
        // Non-fatal — the last good preview (or the fallback disc) stays.
      }
    });
  }

  Future<void> _load() async {
    final api = ref.read(usersApiProvider);
    try {
      final results = await Future.wait([
        api.getAvatarOptions(),
        // Skip fetching the existing (randomly auto-assigned) config
        // entirely when starting from first options — no point fetching
        // a value we're about to discard.
        widget.startFromFirstOption
            ? Future<Map<String, dynamic>?>.value(null)
            : api.getAvatarConfig(),
      ]);
      final catalog = results[0]!;
      final config = (widget.startFromFirstOption ? null : results[1]) ??
          {
            for (final entry in catalog.entries)
              entry.key: (entry.value as List).first,
          };
      final seedGender = widget.initialGenderText ??
          ref.read(myProfileProvider).asData?.value.gender;
      setState(() {
        _catalog = catalog;
        _config = Map<String, dynamic>.from(config);
        _gender = genderFromProfile(seedGender);
        _previewUrl =
            widget.startFromFirstOption ? null : ref.read(myProfileProvider).asData?.value.avatarUrl;
        _loading = false;
        // Reconcile the two gender-curated categories against whatever
        // config we loaded — e.g. a female-seeded user whose stored
        // config still has facial hair set from before this feature.
        for (final key in ['top', 'facialHair']) {
          final options = _visibleOptions(key);
          if (!options.contains(_config![key])) {
            _config![key] = options.first;
          }
        }
      });
      widget.onPreviewChanged?.call(_previewSvg, _previewUrl);
      _schedulePreview();
    } catch (e) {
      setState(() {
        _error = 'Could not load avatar options: $e';
        _loading = false;
      });
    }
  }

  void retry() {
    setState(() => _loading = true);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.xl),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null) {
      return EmptyState(
        icon: Icons.wifi_off_rounded,
        title: 'Something went wrong',
        message: _error!,
        actionLabel: 'Retry',
        onAction: retry,
      );
    }

    final catalog = _catalog!;
    final config = _config!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.showInlinePreview)
          Center(
            child: Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.lg),
              child: _previewSvg != null
                  ? ClipOval(
                      child: SvgPicture.string(
                        _previewSvg!,
                        width: 120,
                        height: 120,
                        fit: BoxFit.cover,
                      ),
                    )
                  : AppAvatar(name: '?', size: 120, avatarUrl: _previewUrl),
            ),
          ),
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Avatar style',
                style: TextStyle(
                  fontSize: AppFont.sm,
                  fontWeight: AppFont.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final gender in AvatarGender.values)
                    _OptionChip(
                      label: genderLabels[gender]!,
                      isSelected: gender == _gender,
                      onTap: () => _setGender(gender),
                    ),
                ],
              ),
            ],
          ),
        ),
        for (final key in catalog.keys)
          if (key != 'facialHair' || _gender == AvatarGender.male)
            _CategoryPicker(
              category: key,
              label: categoryLabels[key] ?? key,
              options: _visibleOptions(key),
              isColor: colorCategories.contains(key),
              selected: config[key],
              onSelected: (value) {
                setState(() => config[key] = value);
                _schedulePreview();
              },
            ),
      ],
    );
  }
}

class _CategoryPicker extends StatelessWidget {
  const _CategoryPicker({
    required this.category,
    required this.label,
    required this.options,
    required this.isColor,
    required this.selected,
    required this.onSelected,
  });

  final String category;
  final String label;
  final List<dynamic> options;
  final bool isColor;
  final dynamic selected;
  final ValueChanged<dynamic> onSelected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: AppFont.sm,
              fontWeight: AppFont.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final option in options)
                isColor
                    ? _ColorSwatch(
                        hex: option as String?,
                        isSelected: option == selected,
                        onTap: () => onSelected(option),
                      )
                    : _OptionChip(
                        label: option == null
                            ? 'None'
                            : humanizeAvatarValue(category, option as String),
                        isSelected: option == selected,
                        onTap: () => onSelected(option),
                      ),
            ],
          ),
        ],
      ),
    );
  }
}

class _OptionChip extends StatelessWidget {
  const _OptionChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => onTap(),
      selectedColor: AppColors.primary,
      labelStyle: TextStyle(
        fontSize: AppFont.sm,
        fontWeight: AppFont.semibold,
        color: isSelected ? AppColors.textInverse : AppColors.textSecondary,
      ),
      backgroundColor: AppColors.surface,
      side: BorderSide(
        color: isSelected ? AppColors.primary : AppColors.border,
      ),
    );
  }
}

class _ColorSwatch extends StatelessWidget {
  const _ColorSwatch({
    required this.hex,
    required this.isSelected,
    required this.onTap,
  });

  final String? hex;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = hex == null
        ? AppColors.surface
        : Color(int.parse('FF$hex', radix: 16));

    return InkWell(
      onTap: onTap,
      customBorder: const CircleBorder(),
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 3 : 1.5,
          ),
        ),
      ),
    );
  }
}
