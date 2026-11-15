import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/universities_api.dart';
import '../../core/theme/app_theme.dart';

/// Debounced live-search college picker — same UX as the web enrollment
/// form's CollegeSearch: type a few letters, pick a match from a list below,
/// or keep the typed text as-is if the college isn't in the list yet (the
/// caller resolves that via UniversitiesApi.findOrCreate at submit time, the
/// same fallback the mentor wizard already used for non-Medical streams).
class CollegeSearchField extends ConsumerStatefulWidget {
  const CollegeSearchField({
    super.key,
    required this.initialText,
    required this.onPick,
  });

  final String initialText;

  /// Called on every keystroke (university null, raw text) and on a pick
  /// from the suggestion list (university non-null, its name).
  final void Function(University? university, String text) onPick;

  @override
  ConsumerState<CollegeSearchField> createState() => _CollegeSearchFieldState();
}

class _CollegeSearchFieldState extends ConsumerState<CollegeSearchField> {
  late final _controller = TextEditingController(text: widget.initialText);
  final _focusNode = FocusNode();
  Timer? _debounce;
  List<University> _results = [];
  bool _open = false;
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() {
      if (!_focusNode.hasFocus) {
        // Small delay so a tap on a suggestion registers before the list
        // closes out from under it.
        Future.delayed(const Duration(milliseconds: 150), () {
          if (mounted) setState(() => _open = false);
        });
      }
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onChanged(String query) {
    widget.onPick(null, query);
    setState(() => _open = true);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () async {
      final thisRequest = ++_requestId;
      try {
        final results = await ref.read(universitiesApiProvider).search(query);
        if (!mounted || thisRequest != _requestId) return;
        setState(() => _results = results);
      } catch (_) {
        if (!mounted || thisRequest != _requestId) return;
        setState(() => _results = []);
      }
    });
  }

  void _select(University u) {
    _controller.text = u.name;
    widget.onPick(u, u.name);
    setState(() => _open = false);
    _focusNode.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextFormField(
          controller: _controller,
          focusNode: _focusNode,
          onChanged: _onChanged,
          onTap: () => setState(() => _open = true),
          decoration: const InputDecoration(hintText: 'Start typing to search…'),
        ),
        if (_open && _controller.text.trim().length >= 2 && _results.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: AppSpacing.xs),
            constraints: const BoxConstraints(maxHeight: 220),
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: ListView.builder(
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              itemCount: _results.length,
              itemBuilder: (context, i) {
                final u = _results[i];
                final subtitle = [
                  if (u.city != null && u.city!.isNotEmpty) u.city,
                  u.state,
                ].whereType<String>().join(', ');
                return InkWell(
                  onTap: () => _select(u),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          u.name,
                          style: const TextStyle(
                              fontSize: AppFont.sm, fontWeight: AppFont.semibold),
                        ),
                        if (subtitle.isNotEmpty)
                          Text(
                            subtitle,
                            style: const TextStyle(
                                fontSize: AppFont.xs, color: AppColors.textMuted),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}
