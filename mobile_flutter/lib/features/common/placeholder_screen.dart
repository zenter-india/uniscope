import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// Port of RN `common/PlaceholderScreen.tsx`.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({super.key, required this.title, this.showAppBar = true});

  final String title;
  final bool showAppBar;

  @override
  Widget build(BuildContext context) {
    final body = Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Text(
          '$title — coming in future sprints',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 16, color: AppColors.textSecondary),
        ),
      ),
    );

    if (!showAppBar) return SafeArea(child: body);
    return Scaffold(appBar: AppBar(title: Text(title)), body: body);
  }
}
