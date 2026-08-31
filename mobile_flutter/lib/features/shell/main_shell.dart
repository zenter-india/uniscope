import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../sessions/active_session_dock.dart';

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
      // Pinned above the tab bar on every tab so a call request never gets
      // lost — previously the only way to reach /call/:id was remembering
      // to open Messages and tap Join Call, which is why real calls were
      // never actually connecting.
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const ActiveSessionDock(),
          // White bar (not a navy block, unlike the Home header) — the
          // client's preferred variant: keep the bottom nav's background
          // as-is, only recolor the active tab's icon/label from emerald to
          // navy, so the navy half of the brand duo shows up here too
          // without turning the whole bar into another dark block.
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
    // Active state is navy now, not emerald — both icon and label, on a
    // white bar this is a plain dark-on-light combo so there's no contrast
    // concern to check (unlike the navy-bar variant this replaced). The
    // pill background moves to a pale navy wash to match, instead of the
    // pale mint it used with the emerald icon.
    final color = focused ? AppColors.textPrimary : AppColors.textMuted;
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
              color: focused
                  ? AppColors.textPrimary.withValues(alpha: 0.08)
                  : Colors.transparent,
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
