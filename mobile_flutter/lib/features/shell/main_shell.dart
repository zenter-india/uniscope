import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../sessions/active_session_dock.dart';
import '../sessions/call_request_watcher.dart';

/// Bottom navigation shell — tab set is role-dependent (see app_router.dart),
/// active tab gets a soft pill highlight.
class MainShell extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      // Pinned above the tab bar on every tab so a mentor never loses track
      // of an incoming request — previously the only way to reach
      // /call/:id was remembering to open Messages and tap Join Call,
      // which is why real calls were never actually connecting. Mentor
      // accounts only: an aspirant's own pending-call status now shows
      // inline inside that specific mentor's chat screen instead (see
      // ActiveSessionDock's doc comment) — a mentor manages many
      // different students at once and still needs this global view, but
      // a student's one relationship per mentor doesn't.
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Polls for an outstanding call and (aspirant side) jumps into
          // /call/:id when the mentor accepts — the stand-in for a real
          // incoming-call push. Renders nothing.
          const CallRequestWatcher(),
          Consumer(
            builder: (context, ref, _) {
              final isMentor =
                  ref.watch(authControllerProvider).user?.role ==
                  UserRole.mentor;
              return isMentor
                  ? const ActiveSessionDock()
                  : const SizedBox.shrink();
            },
          ),
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
  });

  final TabItem item;
  final bool focused;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = focused ? AppColors.primary : AppColors.textMuted;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 5),
            decoration: BoxDecoration(
              color: focused ? AppColors.primaryLight : Colors.transparent,
              borderRadius: BorderRadius.circular(AppRadius.full),
            ),
            child: Icon(
              focused ? item.activeIcon : item.icon,
              size: 24,
              color: color,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            item.label,
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
