import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../core/theme/app_theme.dart';
import '../features/notifications/notifications_screen.dart';

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
      opacity: Tween(begin: 0.45, end: 1.0).animate(
        CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
      ),
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
              FilledButton(
                onPressed: onAction,
                child: Text(actionLabel!),
              ),
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
        Text(
          title,
          style: const TextStyle(
            fontSize: AppFont.lg,
            fontWeight: AppFont.extraBold,
            color: AppColors.textPrimary,
          ),
        ),
        if (onSeeAll != null)
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
