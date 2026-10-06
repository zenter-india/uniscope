import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/reviews_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';

/// Star rating + optional comment for a completed session, posted to
/// `POST /reviews`. Returns `true` if a review was submitted. Used from the
/// Sessions tab's review prompt and the call-ended screen.
Future<bool?> showRateMentorSheet(
  BuildContext context, {
  required String sessionId,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    backgroundColor: AppColors.surface,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (_) => RateMentorSheet(sessionId: sessionId),
  );
}

class RateMentorSheet extends ConsumerStatefulWidget {
  const RateMentorSheet({super.key, required this.sessionId});
  final String sessionId;

  @override
  ConsumerState<RateMentorSheet> createState() => _RateMentorSheetState();
}

class _RateMentorSheetState extends ConsumerState<RateMentorSheet> {
  int _rating = 5;
  final _commentController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await ref
          .read(reviewsApiProvider)
          .create(
            sessionId: widget.sessionId,
            rating: _rating,
            comment: _commentController.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on AlreadyReviewedException {
      // A review for this session already exists — most likely a duplicate
      // submit (double-tap, or a retry after a slow/lost response whose
      // first attempt actually landed). The caller's review IS posted
      // either way, so this reads as success, not an error.
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ReviewSessionNotCompletedException {
      // The backend's own record of this session hasn't caught up with
      // "it just ended" yet (real device report, 2026-10-06 — tapping
      // "Rate this call" right after a call ended threw a raw 403). This is
      // a timing race, not a genuine rejection, so say so plainly instead
      // of the backend's own confusing sentence.
      if (!mounted) return;
      showAppSnackBar(
        context,
        "This call hasn't finished processing yet — give it a moment and try again.",
      );
      setState(() => _submitting = false);
    } catch (e) {
      if (!mounted) return;
      var message = e.toString();
      if (message.startsWith('Exception: ')) {
        message = message.substring('Exception: '.length);
      }
      showAppSnackBar(context, 'Could not submit review: $message');
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Rate your mentor',
            style: TextStyle(
              fontSize: AppFont.lg,
              fontWeight: AppFont.extraBold,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (i) {
              final starIndex = i + 1;
              return IconButton(
                onPressed: () => setState(() => _rating = starIndex),
                icon: Icon(
                  starIndex <= _rating
                      ? Icons.star_rounded
                      : Icons.star_outline_rounded,
                  color: AppColors.warning,
                  size: 34,
                ),
              );
            }),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _commentController,
            maxLines: 3,
            maxLength: 500,
            decoration: const InputDecoration(
              hintText: 'Share how the session went (optional)',
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Submit Review'),
            ),
          ),
        ],
      ),
    );
  }
}
