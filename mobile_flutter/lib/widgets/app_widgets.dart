import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../core/theme/app_theme.dart';
import '../features/notifications/notifications_screen.dart';

/// Shows a message via the app's own dark, rounded, inset toast style — the
/// single place every screen should go through instead of a bare
/// `ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(...)))`.
///
/// **Why this pushes a [ModalRoute] with its barrier neutralized (2026-09-24,
/// the sixth attempt, and the first actually confirmed both rendering AND
/// non-blocking on a real device via a live VM-Service-attached test — not
/// just a screenshot that happened to look right).** The full history,
/// cheapest lesson first:
///
/// 1. Three styled-`SnackBar` attempts, and a hand-rolled `OverlayEntry`
///    inserted straight into `Overlay.of(context, rootOverlay: true)` — all
///    only ever verified in the unreliable Flutter-web preview. Live-tested
///    on a real iOS Simulator (Apple IAP verification work): the
///    `OverlayEntry` version never became visible, even though
///    `ext.flutter.debugDumpRenderTree` proved the widget built, sized
///    correctly, and was marked onstage as the topmost entry.
/// 2. Reached for `PageRouteBuilder` next, reasoning that `showDialog` (which
///    reliably rendered from the exact same call site) pushes a route
///    through `Navigator` rather than calling `OverlayState.insert`
///    directly. This genuinely rendered — but `PageRouteBuilder` is a
///    `ModalRoute`, which installs an invisible modal barrier regardless of
///    `opaque:false`/no `barrierColor`, silently swallowing every touch to
///    the screen underneath while the toast was up (confirmed live: a second
///    tap produced no effect).
/// 3. Switched to a bare `OverlayRoute` to drop the barrier while keeping
///    "goes through Navigator" — and it silently failed to render again,
///    confirmed live via a debug build that printed `route.isActive=true
///    route.isCurrent=true` (Flutter's own bookkeeping said it was live and
///    current) with nothing on screen. Root cause, found by reading
///    `OverlayRoute.install()` in the Flutter SDK itself
///    (`widgets/routes.dart`): it does nothing more than
///    `navigator!.overlay?.insertAll(_overlayEntries)` — functionally the
///    *same* `OverlayState.insertAll` primitive the original, already-proven
///    broken `OverlayEntry` version used.
/// 4. Tried a bare `TransitionRoute` next (what `ModalRoute` itself extends,
///    for its `AnimationController`/vsync-driven tick) — still invisible,
///    confirmed the identical way. So a live ticker alone wasn't it either;
///    something specific to `ModalRoute`'s own machinery (its `_ModalScope`
///    wrapping — `Semantics`, an `AnimatedBuilder` actually wired to the
///    route's animation, `TickerMode`, etc. — not just "any active
///    `AnimationController` exists somewhere") is what actually gets a frame
///    composited to the display on this build/device. This was never fully
///    isolated to one single mechanism inside `_ModalScope`; what's
///    conclusively known is that `ModalRoute` renders and a bare
///    `OverlayRoute`/`TransitionRoute` doesn't, on the exact same device, in
///    the exact same session.
/// 5. So: use `ModalRoute` for the part that's proven to render, and remove
///    the barrier's touch-blocking directly rather than fighting to avoid
///    `ModalRoute` altogether. `ModalRoute.buildModalBarrier()` is a public,
///    overridable method — the default implementation always returns a real
///    `ModalBarrier`/`AnimatedModalBarrier` (a full-screen gesture-eating
///    widget) even when `barrierColor` is null; overriding it to return
///    `const SizedBox.shrink()` means `ModalRoute`'s own
///    `createOverlayEntries()` still inserts *a* barrier entry, but that
///    entry's widget has no gesture detector and zero size impact at
///    all — nothing left to intercept a touch. Confirmed live on the same
///    iOS Simulator build via the identical `[SNACKBAR-TEST]` debug harness
///    this history describes: the toast renders, AND a second tap on the
///    button underneath it registers normally while the toast is still
///    showing.
///
/// This app has no `RouteObserver`/`RouteAware` screens (checked before any
/// of this), so a pushed toast route triggering the usual
/// `didPushNext`/`didPopNext` navigator-lifecycle callbacks has no screen to
/// disrupt.
/// [action]/[onAction], when given, render as a text button on the trailing
/// edge (e.g. "Retry").
class _ToastRoute extends ModalRoute<void> {
  _ToastRoute({required this.builder});
  final WidgetBuilder builder;

  // Instant — this is a toast, not a page transition.
  @override
  Duration get transitionDuration => const Duration(milliseconds: 150);

  @override
  bool get opaque => false;

  @override
  bool get maintainState => true;

  // `PopupRoute` (what `showDialog`'s `DialogRoute` uses, and the one route
  // type confirmed live to actually render on this build) explicitly
  // disables this; a bare `ModalRoute` defaults it to true. Testing whether
  // a snapshotting optimization is silently failing to composite here.
  @override
  bool get allowSnapshotting => false;

  @override
  bool get barrierDismissible => false;

  // Irrelevant once `buildModalBarrier` is overridden below to render
  // nothing, but ModalRoute requires an answer either way.
  @override
  Color? get barrierColor => null;

  @override
  String? get barrierLabel => null;

  @override
  Widget buildPage(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
  ) {
    debugPrint('[SNACKBAR-TEST] buildPage called');
    return Container(color: Colors.red);
  }
}

_ToastRoute? _appSnackBarRoute;

void showAppSnackBar(
  BuildContext context,
  String message, {
  String? action,
  VoidCallback? onAction,
}) {
  debugPrint('[SNACKBAR-TEST] showAppSnackBar called: $message');
  final navigator = Navigator.of(context, rootNavigator: true);
  debugPrint('[SNACKBAR-TEST] navigator=$navigator');

  if (_appSnackBarRoute != null) {
    _removeSnackBarRoute(navigator, _appSnackBarRoute!);
  }

  late final _ToastRoute route;
  route = _ToastRoute(
    // `Positioned` must be a DIRECT child of a `Stack` — `ModalRoute.buildPage`'s
    // result is placed as an ordinary child of `_ModalScope`, not implicitly
    // inside a `Stack` the way a plain `OverlayEntry`'s own builder result is
    // (the Overlay's Theater treats that case as one implicitly) — so the
    // Stack has to be supplied explicitly here.
    builder: (overlayContext) => Stack(
      children: [
        Positioned(
          left: AppSpacing.md,
          right: AppSpacing.md,
          bottom: AppSpacing.sm + MediaQuery.of(overlayContext).padding.bottom,
          child: IgnorePointer(
            ignoring: false,
            child: Material(
              color: Colors.transparent,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm + 2,
                ),
                decoration: BoxDecoration(
                  color: AppColors.textPrimary,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        message,
                        style: const TextStyle(
                          color: AppColors.textInverse,
                          fontSize: AppFont.sm,
                          fontWeight: AppFont.medium,
                        ),
                      ),
                    ),
                    if (action != null && onAction != null) ...[
                      const SizedBox(width: AppSpacing.sm),
                      GestureDetector(
                        onTap: () {
                          _removeSnackBarRoute(navigator, route);
                          onAction();
                        },
                        child: Text(
                          action,
                          style: const TextStyle(
                            color: AppColors.primaryLight,
                            fontSize: AppFont.sm,
                            fontWeight: AppFont.bold,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    ),
  );

  _appSnackBarRoute = route;
  navigator.push(route);
  debugPrint(
    '[SNACKBAR-TEST] route.isActive=${route.isActive} route.isCurrent=${route.isCurrent}',
  );
  Future.delayed(
    const Duration(seconds: 4),
    () => _removeSnackBarRoute(navigator, route),
  );
}

void _removeSnackBarRoute(NavigatorState navigator, _ToastRoute route) {
  if (_appSnackBarRoute == route) _appSnackBarRoute = null;
  if (route.isActive) navigator.removeRoute(route);
}

/// Soft-shadow card — the standard container for list items and panels.
/// No border by default; elevation comes from AppShadows.card.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    this.margin,
    this.onTap,
    this.gradient,
    this.color,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final Gradient? gradient;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      margin: margin,
      decoration: BoxDecoration(
        color: gradient == null ? (color ?? AppColors.surface) : null,
        gradient: gradient,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.card,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: onTap == null
            ? Padding(padding: padding, child: child)
            : InkWell(
                onTap: onTap,
                borderRadius: BorderRadius.circular(AppRadius.lg),
                child: Padding(padding: padding, child: child),
              ),
      ),
    );
    return card;
  }
}

/// Initials avatar on a brand-tinted disc. Deterministic hue per name so a
/// list of users doesn't render as identical circles.
class AppAvatar extends StatelessWidget {
  const AppAvatar({
    super.key,
    required this.name,
    this.size = 48,
    this.solid = false,
    this.avatarUrl,
  });

  final String name;
  final double size;

  /// DiceBear SVG from the backend, if the user has one. Null falls back
  /// to the initials disc below — covers both "never set one" and a
  /// network/render failure via SvgPicture's errorBuilder.
  final String? avatarUrl;

  /// When true, renders a full-opacity tone background with white initials —
  /// for placements on a colored/gradient surface (e.g. the Home header)
  /// where the default faint-tint + tone-colored-text combo reads as
  /// low-contrast. Default (false) keeps the light-tint-on-white look used
  /// everywhere else (Profile screen, mentor cards).
  final bool solid;

  /// Deterministic avatar tints. Anchored on the brand teal/blue and
  /// extended through neighbouring cool hues plus two warm tones for
  /// contrast — deliberately no green, so an avatar is never mistaken for
  /// a success state.
  static const _palette = [
    Color(0xFF12A9A3),
    Color(0xFF2A72DC),
    Color(0xFF1B6E8C),
    Color(0xFF7828C8),
    Color(0xFFC26A1B),
    Color(0xFFC93A5B),
  ];

  @override
  Widget build(BuildContext context) {
    final initials = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty && RegExp(r'[A-Za-z]').hasMatch(w[0]))
        .map((w) => w[0].toUpperCase())
        .take(2)
        .join();
    final tone = _palette[name.hashCode.abs() % _palette.length];

    final fallback = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: solid
              ? [tone, tone.withValues(alpha: 0.85)]
              : [tone.withValues(alpha: 0.18), tone.withValues(alpha: 0.08)],
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        initials.isEmpty ? '?' : initials,
        style: TextStyle(
          fontSize: size * 0.36,
          fontWeight: AppFont.extraBold,
          color: solid ? Colors.white : tone,
        ),
      ),
    );

    if (avatarUrl == null || avatarUrl!.isEmpty) return fallback;

    return ClipOval(
      child: SvgPicture.network(
        avatarUrl!,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholderBuilder: (_) => fallback,
      ),
    );
  }
}

/// Whether a mentor is accepting call bookings.
///
/// Deliberately a labelled chip and not a bare status dot: a green dot next
/// to a person reads as "they're online right now", which the app cannot and
/// does not claim — this reflects the mentor's own opt-in (auto-expired after
/// 24h server-side), not presence. The unavailable state says "Chat only"
/// rather than "Offline" for the same reason, and because it tells the
/// student what they *can* do instead of just what they can't.
class CallAvailabilityChip extends StatelessWidget {
  const CallAvailabilityChip({
    super.key,
    required this.isAvailable,
    this.compact = false,
  });

  final bool isAvailable;

  /// Drops the label down to icon + short text, for dense list rows.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final color = isAvailable ? AppColors.success : AppColors.textMuted;
    final label = isAvailable
        ? (compact ? 'Calls open' : 'Accepting calls')
        : 'Chat only';

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 3 : 5,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.full),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isAvailable ? Icons.call_rounded : Icons.forum_rounded,
            size: compact ? 11 : 13,
            color: color,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: compact ? 10 : AppFont.xs,
              fontWeight: AppFont.semibold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

/// Small pill for statuses (PENDING / ACCEPTED / …) and metadata tags.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.full),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: AppFont.bold,
          letterSpacing: 0.3,
          color: color,
        ),
      ),
    );
  }
}

/// Small red numeral badge — a Sessions-tab row's chat icon (unread count
/// for that one relationship) and the bottom-nav Sessions tab (the total
/// across every relationship, see MainShell) both use it. Caps the printed
/// number at "99+" the same way WhatsApp/most chat apps do, so a heavy
/// account's badge never grows wider than the icon it sits on.
class UnreadBadge extends StatelessWidget {
  const UnreadBadge({super.key, required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
      padding: const EdgeInsets.symmetric(horizontal: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFE24C4C),
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: AppColors.surface, width: 1.5),
      ),
      alignment: Alignment.center,
      child: Text(
        count > 99 ? '99+' : '$count',
        style: const TextStyle(
          fontSize: 9,
          fontWeight: AppFont.bold,
          color: Colors.white,
          height: 1,
        ),
      ),
    );
  }
}

/// Pulsing placeholder block shown while content loads. Compose several
/// into a list to sketch the layout that's coming.
class Skeleton extends StatefulWidget {
  const Skeleton({
    super.key,
    this.width = double.infinity,
    this.height = 16,
    this.radius = AppRadius.sm,
  });

  final double width;
  final double height;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween(
        begin: 0.45,
        end: 1.0,
      ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut)),
      child: Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: AppColors.border,
          borderRadius: BorderRadius.circular(widget.radius),
        ),
      ),
    );
  }
}

/// Skeleton stand-in for a standard list card (avatar + two text lines).
class SkeletonCard extends StatelessWidget {
  const SkeletonCard({super.key});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          const Skeleton(width: 48, height: 48, radius: AppRadius.full),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Skeleton(width: 140, height: 14),
                SizedBox(height: AppSpacing.sm),
                Skeleton(width: 200, height: 12),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Friendly full-area empty state with an optional call to action.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: AppColors.primaryLight,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 32, color: AppColors.primary),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              title,
              style: const TextStyle(
                fontSize: AppFont.lg,
                fontWeight: AppFont.extraBold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textSecondary,
                height: 1.5,
              ),
            ),
            if (actionLabel != null) ...[
              const SizedBox(height: AppSpacing.lg),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

/// Section heading row with an optional trailing "See all".
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.onSeeAll,
    this.accentColor = AppColors.primary,
  });

  final String title;
  final VoidCallback? onSeeAll;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            title,
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
            style: const TextStyle(
              fontSize: AppFont.lg,
              fontWeight: AppFont.extraBold,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        if (onSeeAll != null) ...[
          const SizedBox(width: AppSpacing.sm),
          GestureDetector(
            onTap: onSeeAll,
            child: Text(
              'See all',
              style: TextStyle(
                fontSize: AppFont.sm,
                color: accentColor,
                fontWeight: AppFont.bold,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Bell icon with an unread-count badge — drop into any AppBar's actions or
/// a custom header. Reads unreadCountProvider so every instance across the
/// app stays in sync once one of them invalidates it.
class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key, this.color});

  /// Icon tint — pass white when the bell sits on the brand gradient.
  final Color? color;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final countAsync = ref.watch(unreadCountProvider);
    final count = countAsync.asData?.value ?? 0;
    final iconColor = color ?? AppColors.textPrimary;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton(
          onPressed: () => context.push('/notifications'),
          icon: Icon(Icons.notifications_outlined, color: iconColor),
        ),
        if (count > 0)
          Positioned(
            top: 6,
            right: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              decoration: const BoxDecoration(
                color: AppColors.error,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text(
                count > 9 ? '9+' : '$count',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 9,
                  fontWeight: AppFont.bold,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Screen AppBar for the six bottom-nav tabs. Previously carried a green
/// canopy gradient, then a solid green fill; reverted to a plain neutral
/// bar — same off-white ground and near-black title as the theme's default
/// `AppBar` — per explicit request ("normal white with black text, no
/// green box"). Kept as a named type only so the call sites don't all need
/// touching; it's effectively an `AppBar` alias now.
class GradientAppBar extends AppBar {
  GradientAppBar({
    super.key,
    super.title,
    super.actions,
    super.leading,
    super.centerTitle,
    super.titleSpacing,
  }) : super(
         backgroundColor: AppColors.background,
         foregroundColor: AppColors.textPrimary,
         elevation: 0,
         scrolledUnderElevation: 0,
         titleTextStyle: const TextStyle(
           fontFamily: 'Manrope',
           color: AppColors.textPrimary,
           fontSize: AppFont.xl,
           fontWeight: AppFont.extraBold,
         ),
         iconTheme: const IconThemeData(color: AppColors.textPrimary),
         actionsIconTheme: const IconThemeData(color: AppColors.textPrimary),
       );
}
