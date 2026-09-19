import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import '../sessions/call_request_watcher.dart';
import '../sessions/session_list_screen.dart' show sessionsListProvider;

/// Bottom navigation shell — tab set is role-dependent (see app_router.dart),
/// active tab gets a soft pill highlight.
class MainShell extends ConsumerWidget {
  const MainShell({
    super.key,
    required this.navigationShell,
    required this.tabs,
  });

  final StatefulNavigationShell navigationShell;
  final List<TabItem> tabs;

  void _onTap(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Total unread messages across every relationship (both roles — the
    // same sessionsListProvider both Sessions-tab row types already read,
    // so this rides free of any extra request), badged on the Sessions
    // tab's icon. Watching this here means the badge stays live even while
    // the user is on a completely different tab.
    final sessions = ref.watch(sessionsListProvider).asData?.value ?? const [];
    final totalUnread = sessions.fold<int>(
      0,
      (sum, s) => sum + s.unreadCount,
    );

    return Scaffold(
      body: navigationShell,
      // A pending/live call's status no longer floats globally over every
      // tab for either role (2026-09-11 product decision — previously
      // mentors got a global ActiveSessionDock here while aspirants already
      // saw it scoped inline inside the relevant chat; now both roles work
      // the same way: SessionChatScreen renders its own scoped
      // ActiveSessionDock for whichever counterpart that chat is with). A
      // mentor still sees every pending request at a glance on the Sessions
      // tab itself (_MentorStudentRow's inline Accept/Reject) — this just
      // removes the redundant cross-app banner.
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Polls for an outstanding call and (aspirant side) jumps into
          // /call/:id when the mentor accepts — the stand-in for a real
          // incoming-call push. Renders nothing.
          const CallRequestWatcher(),
          Container(
            decoration: const BoxDecoration(
              color: AppColors.surface,
              boxShadow: [
                BoxShadow(
                  color: Color(0x0D0F1D17),
                  blurRadius: 20,
                  offset: Offset(0, -4),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.sm,
                ),
                child: Row(
                  children: [
                    for (var i = 0; i < tabs.length; i++)
                      Expanded(
                        child: _TabButton(
                          item: tabs[i],
                          focused: i == navigationShell.currentIndex,
                          onTap: () => _onTap(i),
                          badgeCount: tabs[i].label == 'Sessions'
                              ? totalUnread
                              : 0,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class TabItem {
  const TabItem(this.label, this.icon, this.activeIcon);
  final String label;
  final IconData icon;
  final IconData activeIcon;
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.item,
    required this.focused,
    required this.onTap,
    this.badgeCount = 0,
  });

  final TabItem item;
  final bool focused;
  final VoidCallback onTap;

  /// Total unread count for this tab (Sessions only, today) — 0 shows no
  /// badge. See MainShell.
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    final color = focused ? AppColors.primary : AppColors.textMuted;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOut,
                // Narrower horizontal padding so six tabs (aspirant: +
                // Wallet) still breathe on a small phone.
                padding: const EdgeInsets.symmetric(
                  horizontal: 13,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: focused
                      ? AppColors.primaryLight
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppRadius.full),
                ),
                child: Icon(
                  focused ? item.activeIcon : item.icon,
                  size: 24,
                  color: color,
                ),
              ),
              if (badgeCount > 0)
                Positioned(
                  top: -2,
                  right: 4,
                  child: UnreadBadge(count: badgeCount),
                ),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            item.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              color: color,
              fontWeight: focused ? AppFont.bold : AppFont.medium,
            ),
          ),
        ],
      ),
    );
  }
}
