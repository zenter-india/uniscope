import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/universities_api.dart';
import '../../core/theme/app_theme.dart';
import 'onboarding_widgets.dart';

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
    this.initialUniversityId,
    this.stream,
    this.curatedDegree,
    this.level,
  });

  final String initialText;

  /// The college id already picked when this field is (re)built, if any. A
  /// non-empty [initialText] with no id means the user had typed their own
  /// name via "Not listed here", so the field reopens in that mode.
  final String? initialUniversityId;

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
  /// (id non-null); `(null, '', const [])` while the user is only searching
  /// (nothing chosen yet, so the caller treats the field as empty); and
  /// `(null, rawText, const [])` on every keystroke once "Not listed here"
  /// is chosen, so the caller keeps that typed answer in sync. `specializations` is the
  /// picked college's own list for this stream+degree (curated mode only —
  /// empty in the general search) so the caller can scope its Specialization
  /// field to that college, matching the web enrollment form.
  final void Function(
    String? universityId,
    String text,
    List<String> specializations,
  )
  onPick;

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
  // Whether the once-per-focus "results arrived, scroll them into view"
  // pass has run — see _scrollIntoView / _fetch.
  bool _scrolledForResults = false;
  // "Not listed here" chosen: the field becomes a plain text box and what the
  // user types is their college name (resolved via findOrCreate on submit).
  // Otherwise typing only searches and nothing counts until a pick.
  late bool _manual =
      widget.initialText.trim().isNotEmpty &&
      widget.initialUniversityId == null;

  /// Scrolls this field (and the results list under it) up near the top of
  /// the visible area — not just "barely on screen", which is all the
  /// default alignment would do.
  void _scrollIntoView() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Scrollable.ensureVisible(
        context,
        alignment: 0.1,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() {
      if (_manual) return;
      if (_focusNode.hasFocus) {
        setState(() => _open = true);
        _scrolledForResults = false;
        _fetch(_controller.text);
        // Device report: when this field sits low on the form, the results
        // list below it renders right under the keyboard — invisible, so a
        // user assumed typing was the only option and free-typed a college
        // that already existed in the list, creating a duplicate entry.
        // This first scroll runs immediately on focus, but at that moment
        // the list is only a spinner and the keyboard hasn't shrunk the
        // viewport yet, so the scroll view may not yet have enough
        // scrollable distance to bring the field near the top (real report:
        // fine on the aspirant wizard, which has more content below the
        // field, but not on the mentor wizard's College step, where this
        // field sits lower with little below it). _fetch scrolls again once
        // the results have actually rendered.
        _scrollIntoView();
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
    if (_manual) {
      widget.onPick(null, query, const []);
      return;
    }
    // Search only - the typed text is not an answer until a college is picked
    // or "Not listed here" is chosen.
    widget.onPick(null, '', const []);
    setState(() => _open = true);
    _fetch(query);
  }

  void _enterManual() {
    _controller.clear();
    widget.onPick(null, '', const []);
    setState(() {
      _manual = true;
      _open = false;
    });
    _focusNode.requestFocus();
  }

  void _backToSearch() {
    _controller.clear();
    widget.onPick(null, '', const []);
    setState(() => _manual = false);
    _focusNode.requestFocus();
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
          final data = await ref
              .read(universitiesApiProvider)
              .curated(
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
          final data = await ref
              .read(universitiesApiProvider)
              .search(query, stream: widget.stream, level: widget.level);
          options = [
            for (final u in data)
              _Option(
                // Was built from `u.city` only — for a lot of colleges
                // (especially generic-named DNB/Diploma hospital-training
                // sites like "District Hospital", repeated across dozens of
                // districts) the real location only ever lands on `district`
                // (derived server-side from a program's description), never
                // `city`, so this list showed a wall of identical,
                // unlabelled "District Hospital" rows (real device report).
                // `locationLabel` already falls through district → city and
                // drops a duplicate/blank candidate — reuse it instead of
                // re-deriving a weaker version of the same thing here.
                id: u.id,
                label: '${u.name}, ${u.locationLabel}',
              ),
          ];
        }
        if (!mounted || thisRequest != _requestId) return;
        setState(() {
          _results = options;
          _loading = false;
        });
        // Now that the list is rendered (and the keyboard, which takes a
        // few hundred ms, is normally fully up after the debounce + network
        // round trip), the scroll extent includes the list — scroll once
        // more so the field and its results end up above the keyboard.
        // Once per focus so it never fights a user who scrolls by hand
        // while typing.
        if (_focusNode.hasFocus && !_scrolledForResults && options.isNotEmpty) {
          _scrolledForResults = true;
          _scrollIntoView();
        }
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
    final showList = _open && !_manual;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextFormField(
          controller: _controller,
          focusNode: _focusNode,
          onChanged: _onChanged,
          decoration: InputDecoration(
            hintText: _manual
                ? 'Enter your college name'
                : 'Select or type to search…',
          ),
        ),
        if (_manual)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: _backToSearch,
              child: const Text('Back to search'),
            ),
          ),
        if (showList)
          // A press inside the list must not count as a "tap outside" the
          // text field: on web/desktop that unfocuses the field on pointer
          // DOWN, and the 150ms close timer then removes the list before a
          // slower click finishes, so "Not listed here" (or a college row)
          // never received the click.
          TextFieldTapRegion(
            child: Container(
              margin: const EdgeInsets.only(top: AppSpacing.xs),
              constraints: const BoxConstraints(maxHeight: 320),
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Flexible(
                    child: _loading && _results.isEmpty
                        ? const Padding(
                            padding: EdgeInsets.all(AppSpacing.md),
                            // Row, not Center: Center expands to the full 320px
                            // max height while loading, which pushed the
                            // "Not listed here" options off screen.
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : _results.isEmpty
                        ? const Padding(
                            padding: EdgeInsets.all(AppSpacing.md),
                            child: Text(
                              'No matches',
                              style: TextStyle(color: AppColors.textMuted),
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
                  OnboardingBypassOptions(
                    example:
                        'e.g. search "Jawaharlal Nehru Postgraduate Institute" instead of "JIPMER"',
                    onNotListed: _enterManual,
                  ),
                ],
              ),
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
