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
          // Navy, matching the Home header — the same "Option B" duotone
          // brand block, not just a one-off on the Home screen. Shared
          // across every tab since MainShell is the app-wide bottom nav.
          Container(
            decoration: const BoxDecoration(
              color: AppColors.textPrimary,
              boxShadow: [
                BoxShadow(
                  color: Color(0x33001A46),
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
    // The active icon sits inside its own primaryLight pill, so `primary`
    // still reads fine there (it's contrasting against that pale chip, not
    // navy). The active *label*, though, sits directly on the navy bar with
    // nothing behind it — plain `primary` there measures only 3.67:1 on
    // navy (fails AA); `mintAccent` clears 9.56:1 (checked, not guessed).
    // Inactive state keeps textMuted for both — 6.63:1 on navy, still fine.
    final iconColor = focused ? AppColors.primary : AppColors.textMuted;
    final labelColor = focused ? AppColors.mintAccent : AppColors.textMuted;
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
              color: iconColor,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            item.label,
            style: TextStyle(
              fontSize: 11,
              color: labelColor,
              fontWeight: focused ? AppFont.bold : AppFont.medium,
            ),
          ),
        ],
      ),
    );
  }
}
