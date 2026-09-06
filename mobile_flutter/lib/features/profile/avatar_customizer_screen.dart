import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import 'avatar_picker_panel.dart';

/// Standalone avatar editor reached from Profile's pencil badge. Wraps the
/// shared [StickyPreviewAvatarPicker] in a Scaffold with its own Save
/// action — the onboarding wizards embed the same picker inline instead,
/// with their own Continue/Skip buttons.
class AvatarCustomizerScreen extends ConsumerStatefulWidget {
  const AvatarCustomizerScreen({super.key});

  @override
  ConsumerState<AvatarCustomizerScreen> createState() =>
      _AvatarCustomizerScreenState();
}

class _AvatarCustomizerScreenState
    extends ConsumerState<AvatarCustomizerScreen> {
  final _panelKey = GlobalKey<AvatarPickerPanelState>();
  bool _saving = false;

  Future<void> _save() async {
    final config = _panelKey.currentState?.currentConfig;
    if (config == null) return;
    setState(() => _saving = true);
    try {
      await ref.read(usersApiProvider).updateAvatarConfig(config);
      ref.invalidate(myProfileProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Avatar updated')));
      context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not save avatar: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Customize Avatar'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: SafeArea(
        bottom: false,
        // Preview pinned above the scroll, options scroll underneath — the
        // exact same widget the onboarding avatar step uses now.
        child: StickyPreviewAvatarPicker(panelKey: _panelKey),
      ),
    );
  }
}
