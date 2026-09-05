import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import 'avatar_picker_panel.dart';

/// Standalone avatar editor reached from Profile's pencil badge. Wraps the
/// shared [AvatarPickerPanel] in a Scaffold with its own Save action — the
/// onboarding wizards embed the same panel inline instead, with their own
/// Continue/Skip buttons.
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

  // Mirrors the panel's live preview so it can be pinned above the scroll
  // while the option chips scroll underneath it.
  String? _previewSvg;
  String? _previewUrl;

  Future<void> _save() async {
    final config = _panelKey.currentState?.currentConfig;
    if (config == null) return;
    setState(() => _saving = true);
    try {
      await ref.read(usersApiProvider).updateAvatarConfig(config);
      ref.invalidate(myProfileProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Avatar updated')));
      context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Could not save avatar: $e')));
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
        child: Column(
          children: [
            // Pinned preview — a compact band that stays put while the
            // options scroll, so you can see each change without scrolling
            // back up. Kept tight to the avatar so it doesn't eat the
            // options list's room on shorter screens.
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(
                  bottom: BorderSide(color: AppColors.border),
                ),
              ),
              child: Center(
                child: _previewSvg != null
                    ? ClipOval(
                        child: SvgPicture.string(
                          _previewSvg!,
                          width: 80,
                          height: 80,
                          fit: BoxFit.cover,
                        ),
                      )
                    : AppAvatar(name: '?', size: 80, avatarUrl: _previewUrl),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: AvatarPickerPanel(
                  key: _panelKey,
                  showInlinePreview: false,
                  onPreviewChanged: (svg, url) {
                    if (!mounted) return;
                    setState(() {
                      _previewSvg = svg;
                      _previewUrl = url;
                    });
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
