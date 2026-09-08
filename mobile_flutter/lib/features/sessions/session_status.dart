import 'package:flutter/material.dart';

import '../../core/network/sessions_api.dart';
import '../../core/theme/app_theme.dart';
import 'call_time_windows.dart';

/// How a session-status label should read for the surface it sits on.
enum SessionStatusStyle {
  /// List-row subtitle — short, but still `endReason`-correct.
  compact,

  /// Card status chip — a short phrase, with the which-side nuance.
  standard,

  /// Active-session dock — an imperative prompt ("join now"), not a status
  /// noun. Only meaningful for PENDING/ACCEPTED/RINGING/IN_PROGRESS; every
  /// terminal state falls back to the [standard] wording.
  prompt,
}

/// A rendered session status: the text to show and the colour to show it in.
///
/// The single source of truth for how a session's state reads to a user.
/// Every Sessions surface renders through this — the list rows, the
/// per-session card chip, the active-call dock, the call-ended screen and
/// the mentor dashboard — so a dot and a chip on the same session can never
/// drift apart again, and adding a new `SessionStatus` or `endReason` is a
/// one-place change.
///
/// Deliberately carries no "you were charged / paid / credited" wording:
/// money movement is surfaced by the wallet, the ledger and notifications,
/// not by a status label.
class SessionStatusView {
  const SessionStatusView(this.label, this.color);
  final String label;
  final Color color;
}

/// The status view for a full [Session].
SessionStatusView sessionStatusView(
  Session s, {
  required bool isMentor,
  SessionStatusStyle style = SessionStatusStyle.standard,
}) =>
    _view(
      status: s.status,
      endReason: s.endReason,
      isCall: s.type == 'AUDIO_CALL',
      requestedFor: s.requestedFor,
      requestedForAlt: s.requestedForAlt,
      confirmedFor: s.confirmedFor,
      isMentor: isMentor,
      style: style,
    );

/// The status view from loose fields — for the mentor dashboard's
/// `MentorDashboardRecentSession`, which isn't a full [Session] (and is
/// always COMPLETED, so it needs no request-time phrasing).
SessionStatusView sessionStatusViewOf({
  required String statusWire,
  String? endReason,
  required bool isCall,
  required bool isMentor,
  SessionStatusStyle style = SessionStatusStyle.compact,
}) =>
    _view(
      status: SessionStatus.fromWire(statusWire),
      endReason: endReason,
      isCall: isCall,
      requestedFor: null,
      requestedForAlt: null,
      confirmedFor: null,
      isMentor: isMentor,
      style: style,
    );

SessionStatusView _view({
  required SessionStatus status,
  required String? endReason,
  required bool isCall,
  required DateTime? requestedFor,
  required DateTime? requestedForAlt,
  required DateTime? confirmedFor,
  required bool isMentor,
  required SessionStatusStyle style,
}) {
  final compact = style == SessionStatusStyle.compact;
  final prompt = style == SessionStatusStyle.prompt;

  switch (status) {
    case SessionStatus.pending:
      if (!isCall) {
        if (prompt) {
          return SessionStatusView(
            isMentor ? 'New chat' : 'Waiting for a reply',
            AppColors.warning,
          );
        }
        return SessionStatusView(
          compact ? 'Chat started' : 'Awaiting reply',
          AppColors.warning,
        );
      }
      // AUDIO_CALL request — always say *what kind* and *when*.
      if (prompt && !isMentor) {
        return const SessionStatusView(
          'Waiting for mentor to accept',
          AppColors.warning,
        );
      }
      final String label;
      if (requestedFor == null) {
        label = prompt
            ? 'Instant call request · connect now'
            : compact
                ? 'Instant call'
                : 'Instant call requested';
      } else if (requestedForAlt != null) {
        final times =
            '${clockLabel(requestedFor)} or ${clockLabel(requestedForAlt)}';
        label = compact
            ? 'Call · ${clockLabel(requestedFor)} / ${clockLabel(requestedForAlt)}'
            : prompt
                ? 'Call request · $times'
                : 'Requested · $times';
      } else {
        label = compact
            ? 'Call · ${clockLabel(requestedFor)}'
            : prompt
                ? 'Call request · ${friendlyCallTime(requestedFor)}'
                : 'Requested for ${friendlyCallTime(requestedFor)}';
      }
      return SessionStatusView(label, AppColors.warning);

    case SessionStatus.accepted:
      // A confirmed 30-min slot replaces the vague "Ready" / "join now" — the
      // call isn't happening this second, it's happening at that slot.
      if (confirmedFor != null) {
        final when = friendlyCallTime(confirmedFor);
        if (prompt) {
          return SessionStatusView(
            isMentor
                ? 'Confirmed · $when'
                : 'Mentor confirmed $when — join then',
            AppColors.primary,
          );
        }
        return SessionStatusView(
          compact ? 'Confirmed · $when' : 'Confirmed for $when',
          AppColors.primary,
        );
      }
      if (prompt) {
        return SessionStatusView(
          isMentor ? 'Accepted — ready to call' : 'Mentor is ready — join now',
          AppColors.primary,
        );
      }
      return SessionStatusView(compact ? 'Ready' : 'Accepted', AppColors.primary);

    case SessionStatus.ringing:
      return SessionStatusView(
        prompt
            ? 'Call connecting…'
            : compact
                ? 'Connecting…'
                : 'Connecting',
        AppColors.accent,
      );

    case SessionStatus.inProgress:
      if (!isCall) return const SessionStatusView('Chatting', AppColors.primary);
      return SessionStatusView(
        prompt
            ? 'Call in progress'
            : compact
                ? 'In call'
                : 'In progress',
        AppColors.primary,
      );

    case SessionStatus.completed:
      if (isCall && endReason == 'SLOT_EXPIRED') {
        return SessionStatusView(
          compact ? 'Slot ended' : 'Booked time ended',
          AppColors.textMuted,
        );
      }
      return SessionStatusView(
        isCall
            ? (compact ? 'Call ended' : 'Completed')
            : (compact ? 'Chat' : 'Completed'),
        AppColors.textMuted,
      );

    case SessionStatus.rejected:
      return const SessionStatusView('Declined', AppColors.error);

    case SessionStatus.cancelled:
      return const SessionStatusView('Cancelled', AppColors.textMuted);

    case SessionStatus.expired:
      return const SessionStatusView('Expired', AppColors.textMuted);

    case SessionStatus.failed:
      switch (endReason) {
        case 'NO_ANSWER':
          return SessionStatusView(
            compact ? 'No answer' : 'Nobody joined in time',
            AppColors.textMuted,
          );
        case 'ASPIRANT_NO_SHOW':
          return isMentor
              ? SessionStatusView(
                  compact ? 'Aspirant no-show' : "Aspirant didn't join",
                  AppColors.textMuted,
                )
              : SessionStatusView(
                  compact ? 'Missed' : "You didn't join in time",
                  AppColors.warning,
                );
        case 'MENTOR_NO_SHOW':
          return isMentor
              ? SessionStatusView(
                  compact ? 'Missed' : "You didn't join in time",
                  AppColors.warning,
                )
              : SessionStatusView(
                  compact ? 'Mentor no-show' : "Mentor didn't join in time",
                  AppColors.textMuted,
                );
        case 'ADMIN_CLOSED':
          return SessionStatusView(
            compact ? 'Closed' : 'Closed by support',
            AppColors.textMuted,
          );
        default:
          return SessionStatusView(
            compact ? 'Ended' : 'Call ended',
            AppColors.error,
          );
      }
  }
}
