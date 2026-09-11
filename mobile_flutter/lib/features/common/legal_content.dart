import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

/// The shape a legal document's bundled JSON asset is parsed into — a flat
/// list of typed blocks in document order (`h2`/`h3` headings, `p`
/// paragraphs, `ul`/`ol` lists), generated once from the live web pages at
/// uniscope.in/{terms,privacy,...} and re-generated whenever their content
/// changes (see `scripts/extract_legal_content.py`). Deliberately flat, not
/// nested — the renderer just switches on `type` per block, no markdown
/// parsing needed on this side.
enum LegalBlockType { h2, h3, p, ul, ol }

class LegalBlock {
  const LegalBlock._({required this.type, this.text, this.items});

  factory LegalBlock.fromJson(Map<String, dynamic> json) {
    final type = LegalBlockType.values.byName(json['type'] as String);
    return LegalBlock._(
      type: type,
      text: json['text'] as String?,
      items: (json['items'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
    );
  }

  final LegalBlockType type;
  final String? text;
  final List<String>? items;
}

class LegalDocument {
  const LegalDocument({required this.title, required this.blocks});

  factory LegalDocument.fromJson(Map<String, dynamic> json) => LegalDocument(
    title: json['title'] as String,
    blocks: (json['blocks'] as List<dynamic>)
        .map((e) => LegalBlock.fromJson(e as Map<String, dynamic>))
        .toList(),
  );

  final String title;
  final List<LegalBlock> blocks;
}

/// Loads and parses a legal document from its bundled asset — e.g.
/// `assets/legal/terms.json`. Never hits the network, so it works offline
/// and on every platform (including Flutter web, unlike the webview it
/// replaced).
Future<LegalDocument> loadLegalDocument(String assetPath) async {
  final raw = await rootBundle.loadString(assetPath);
  return LegalDocument.fromJson(jsonDecode(raw) as Map<String, dynamic>);
}
