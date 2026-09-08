import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/universities_api.dart';
import '../../core/theme/app_theme.dart';

/// Browsable + type-to-search College/University picker — the same UX as the
/// web enrollment forms' college fields (CollegeSearch / CuratedCollegeSearch
/// in web/components): focusing the field shows a scrollable list right away
/// (not "search only after 2 characters"), typing narrows it, and a typed
/// value that matches nothing is still accepted as free text — the caller
/// resolves that via `UniversitiesApi.findOrCreate` at submit time.
///
/// Two backends, picked by whether [curatedDegree] is set:
///  * **curated** ([curatedDegree] non-null, from
///    `curatedDegreeKey(stream, degree)`): `GET /universities/curated`, whose
///    option labels are the full `"name, district, state"` string the
///    website shows — this is what puts the district back in the option.
///  * **general** ([curatedDegree] null): `GET /universities?browse=true`,
///    scoped to [stream] (and [level] when given) so an empty query returns a
///    bounded list rather than the whole ~10k catalogue.
class CollegeSearchField extends ConsumerStatefulWidget {
  const CollegeSearchField({
    super.key,
    required this.initialText,
    required this.onPick,
    this.stream,
    this.curatedDegree,
    this.level,
  });

  final String initialText;

  /// The user's field of study — bounds the general search and is required
  /// for the curated one. Null only in a not-yet-usable state (no stream
  /// picked); the field renders but returns nothing.
  final String? stream;

  /// Backend curated key (e.g. "MD/MS", "B.Tech") — when set, the curated
  /// endpoint is used and labels carry the district. Null → general search.
  final String? curatedDegree;

  /// e.g. "UG" — narrows the general search to colleges offering that level.
  final String? level;

  /// `(universityId, displayText, specializations)` on a pick from the list
  /// (id non-null), or `(null, rawText, const [])` on every keystroke so the
  /// caller keeps the free-text answer in sync. `specializations` is the
  /// picked college's own list for this stream+degree (curated mode only —
  /// empty in the general search) so the caller can scope its Specialization
  /// field to that college, matching the web enrollment form.
  final void Function(
    String? universityId,
    String text,
    List<String> specializations,
  ) onPick;

  @override
  ConsumerState<CollegeSearchField> createState() => _CollegeSearchFieldState();
}

class _CollegeSearchFieldState extends ConsumerState<CollegeSearchField> {
  late final _controller = TextEditingController(text: widget.initialText);
  final _focusNode = FocusNode();
  Timer? _debounce;
  List<_Option> _results = [];
  bool _open = false;
  bool _loading = false;
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() {
      if (_focusNode.hasFocus) {
        setState(() => _open = true);
        _fetch(_controller.text);
      } else {
        // Small delay so a tap on a suggestion registers before the list
        // closes out from under it.
        Future.delayed(const Duration(milliseconds: 150), () {
          if (mounted) setState(() => _open = false);
        });
      }
    });
  }

  @override
  void didUpdateWidget(CollegeSearchField old) {
    super.didUpdateWidget(old);
    // Stream/degree changed under us (the parent resets the college on those
    // — different data set now), so any loaded list is stale.
    if (old.stream != widget.stream ||
        old.curatedDegree != widget.curatedDegree ||
        old.level != widget.level) {
      _results = [];
      if (_focusNode.hasFocus) _fetch(_controller.text);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onChanged(String query) {
    widget.onPick(null, query, const []);
    setState(() => _open = true);
    _fetch(query);
  }

  void _fetch(String query) {
    if (widget.stream == null) return;
    _debounce?.cancel();
    setState(() => _loading = true);
    _debounce = Timer(const Duration(milliseconds: 250), () async {
      final thisRequest = ++_requestId;
      try {
        final List<_Option> options;
        if (widget.curatedDegree != null) {
          final data = await ref.read(universitiesApiProvider).curated(
                stream: widget.stream!,
                degree: widget.curatedDegree!,
                search: query.trim().isEmpty ? null : query.trim(),
              );
          options = [
            for (final c in data)
              _Option(
                id: c.id,
                label: c.label,
                specializations: c.specializations,
              ),
          ];
        } else {
          final data = await ref.read(universitiesApiProvider).search(
                query,
                stream: widget.stream,
                level: widget.level,
              );
          options = [
            for (final u in data)
              _Option(
                id: u.id,
                label: [
                  u.name,
                  if (u.city != null && u.city!.isNotEmpty) u.city!,
                  u.state,
                ].join(', '),
              ),
          ];
        }
        if (!mounted || thisRequest != _requestId) return;
        setState(() {
          _results = options;
          _loading = false;
        });
      } catch (_) {
        if (!mounted || thisRequest != _requestId) return;
        setState(() {
          _results = [];
          _loading = false;
        });
      }
    });
  }

  void _select(_Option o) {
    _controller.text = o.label;
    widget.onPick(o.id, o.label, o.specializations);
    setState(() => _open = false);
    _focusNode.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    final showList = _open && (_results.isNotEmpty || _loading);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextFormField(
          controller: _controller,
          focusNode: _focusNode,
          onChanged: _onChanged,
          decoration: const InputDecoration(
            hintText: 'Select or type to search…',
          ),
        ),
        if (showList)
          Container(
            margin: const EdgeInsets.only(top: AppSpacing.xs),
            constraints: const BoxConstraints(maxHeight: 320),
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: _loading && _results.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(AppSpacing.md),
                    child: Center(
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                  )
                : ListView.builder(
                    shrinkWrap: true,
                    padding: EdgeInsets.zero,
                    itemCount: _results.length,
                    itemBuilder: (context, i) {
                      final o = _results[i];
                      return InkWell(
                        onTap: () => _select(o),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: AppSpacing.sm,
                          ),
                          child: Text(
                            o.label,
                            style: const TextStyle(
                              fontSize: AppFont.sm,
                              fontWeight: AppFont.medium,
                            ),
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

class _Option {
  const _Option({
    required this.id,
    required this.label,
    this.specializations = const [],
  });
  final String id;
  final String label;
  final List<String> specializations;
}
