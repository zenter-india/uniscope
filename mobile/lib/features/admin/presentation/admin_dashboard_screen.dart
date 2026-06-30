import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_spacing.dart';
import '../../auth/application/auth_controller.dart';

/// Admin landing (ported from RN `AdminDashboardScreen`). Shown when the
/// authenticated user's role is ADMIN. Queues are rebuilt later.
class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
            onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
          ),
        ],
      ),
      body: const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Text('Verification, moderation, and user queues coming soon.'),
      ),
    );
  }
}
