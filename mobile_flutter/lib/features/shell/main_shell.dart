import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';

/// Port of RN `MainTabNavigator`: 5 bottom tabs with tinted PNG icons.
class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _tabs = <_TabItem>[
    _TabItem('Home', 'assets/icons/home.png'),
    _TabItem('Colleges', 'assets/icons/hospital-alt.png'),
    _TabItem('Mentors', 'assets/icons/man.png'),
    _TabItem('Chats', 'assets/icons/chat.png'),
    _TabItem('Profile', 'assets/icons/profile.png'),
  ];

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
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 66,
            child: Row(
              children: [
                for (var i = 0; i < _tabs.length; i++)
                  Expanded(
                    child: _TabButton(
                      item: _tabs[i],
                      focused: i == navigationShell.currentIndex,
                      onTap: () => _onTap(i),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TabItem {
  const _TabItem(this.label, this.icon);
  final String label;
  final String icon;
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.item,
    required this.focused,
    required this.onTap,
  });

  final _TabItem item;
  final bool focused;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = focused ? AppColors.primary : AppColors.textMuted;
    return InkWell(
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Opacity(
            opacity: focused ? 1 : 0.6,
            child: Image.asset(
              item.icon,
              width: 24,
              height: 24,
              color: color,
              colorBlendMode: BlendMode.srcIn,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            item.label,
            style: TextStyle(
              fontSize: AppFont.xs,
              color: color,
              fontWeight: focused ? AppFont.semibold : AppFont.regular,
            ),
          ),
        ],
      ),
    );
  }
}
