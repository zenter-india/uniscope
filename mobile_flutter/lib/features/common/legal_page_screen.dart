import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';
import 'legal_content.dart';

/// Renders a legal/policy document (Terms, Privacy, Community Guidelines,
/// Refund & Cancellation) natively from its bundled JSON asset — see
/// `legal_content.dart`. Replaces the old webview-into-uniscope.in
/// (`WebPageScreen`): no network round-trip, works offline, and reads with
/// the app's own typography instead of the marketing site's.
class LegalPageScreen extends StatelessWidget {
  const LegalPageScreen({
    super.key,
    required this.title,
    required this.assetPath,
  });

  final String title;
  final String assetPath;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(title)),
      body: FutureBuilder<LegalDocument>(
        future: loadLegalDocument(assetPath),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            );
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return const EmptyState(
              icon: Icons.error_outline_rounded,
              title: 'Could not load this document',
              message: 'Please try again in a moment.',
            );
          }
          final doc = snapshot.data!;
          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.xxl,
            ),
            itemCount: doc.blocks.length,
            itemBuilder: (context, index) => _LegalBlockView(
              block: doc.blocks[index],
              isFirst: index == 0,
            ),
          );
        },
      ),
    );
  }
}

class _LegalBlockView extends StatelessWidget {
  const _LegalBlockView({required this.block, required this.isFirst});

  final LegalBlock block;
  final bool isFirst;

  @override
  Widget build(BuildContext context) {
    switch (block.type) {
      case LegalBlockType.h2:
        return Padding(
          padding: EdgeInsets.only(
            top: isFirst ? 0 : AppSpacing.lg,
            bottom: AppSpacing.sm,
          ),
          child: Text(
            block.text ?? '',
            style: const TextStyle(
              fontSize: AppFont.lg,
              fontWeight: AppFont.bold,
              color: AppColors.textPrimary,
            ),
          ),
        );
      case LegalBlockType.h3:
        return Padding(
          padding: const EdgeInsets.only(
            top: AppSpacing.md,
            bottom: AppSpacing.xs,
          ),
          child: Text(
            block.text ?? '',
            style: const TextStyle(
              fontSize: AppFont.md,
              fontWeight: AppFont.semibold,
              color: AppColors.textPrimary,
            ),
          ),
        );
      case LegalBlockType.p:
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: Text(
            block.text ?? '',
            style: const TextStyle(
              fontSize: AppFont.sm,
              height: 1.55,
              color: AppColors.textSecondary,
            ),
          ),
        );
      case LegalBlockType.ul:
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final item in block.items ?? const <String>[])
                _ListRow(marker: '•', text: item),
            ],
          ),
        );
      case LegalBlockType.ol:
        final items = block.items ?? const <String>[];
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < items.length; i++)
                _ListRow(marker: '${i + 1}.', text: items[i]),
            ],
          ),
        );
    }
  }
}

class _ListRow extends StatelessWidget {
  const _ListRow({required this.marker, required this.text});

  final String marker;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 22,
            child: Text(
              marker,
              style: const TextStyle(
                fontSize: AppFont.sm,
                height: 1.55,
                color: AppColors.textSecondary,
                fontWeight: AppFont.medium,
              ),
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: AppFont.sm,
                height: 1.55,
                color: AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
