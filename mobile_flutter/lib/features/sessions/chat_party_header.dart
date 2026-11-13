import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';

/// The name block in a chat screen's app bar: avatar, name and — when they
/// have one — the public `@uniqueId` (their registration number, never the
/// internal DB id).
///
/// [onTap] makes the whole block open that person's profile. It is passed
/// only where that is wanted: an aspirant opening the mentor's profile
/// (UNI-37). Everywhere else it is null and the header stays a plain,
/// non-tappable label, as before.
class ChatPartyHeader extends StatelessWidget {
  const ChatPartyHeader({
    super.key,
    required this.name,
    this.avatarUrl,
    this.uniqueId,
    this.onTap,
  });

  final String name;
  final String? avatarUrl;
  final String? uniqueId;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        AppAvatar(name: name, avatarUrl: avatarUrl, size: 32),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, overflow: TextOverflow.ellipsis),
              if (uniqueId != null)
                Text(
                  '@$uniqueId',
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: AppFont.xs,
                    fontWeight: AppFont.regular,
                    color: AppColors.textSecondary,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
    if (onTap == null) return content;
    return Semantics(
      button: true,
      label: 'View profile',
      child: InkWell(onTap: onTap, child: content),
    );
  }
}
