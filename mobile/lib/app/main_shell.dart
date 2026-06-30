import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../features/home/presentation/home_screen.dart';
import '../shared/widgets/placeholder_screen.dart';

/// The authenticated tab shell (ported from the RN `MainTabNavigator`):
/// Home · Colleges · Mentors · Chats · Profile.
///
/// Colleges/Mentors/Chats/Profile are placeholders until each feature is
/// rebuilt; Colleges is wired to the universities API in the data-layer pass.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  static const _tabs = <Widget>[
    HomeScreen(),
    PlaceholderScreen(title: 'Colleges'),
    PlaceholderScreen(title: 'Mentors'),
    PlaceholderScreen(title: 'Chats'),
    PlaceholderScreen(title: 'Profile'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        indicatorColor: AppColors.primaryLight,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
          NavigationDestination(
            icon: Icon(Icons.school_outlined),
            label: 'Colleges',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            label: 'Mentors',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            label: 'Chats',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
