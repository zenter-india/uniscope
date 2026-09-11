#!/usr/bin/env python3
"""Regenerates assets/legal/*.json — the source the app's native
LegalPageScreen renders (Settings/Help/Login/wallet "Terms",
"Privacy Policy", "Community Guidelines", "Refund & Cancellation Policy").

The canonical source of truth for policy wording is still the marketing
site's Next.js pages (web/app/{terms,privacy,community-guidelines,refund}/
page.tsx on the prod/web-enrollment-site branch) — this script mechanically
extracts their text into a flat, typed JSON block list, not the other way
around. Re-run it whenever legal/policy copy changes on that site:

    git show origin/prod/web-enrollment-site:web/app/terms/page.tsx > /tmp/terms.tsx
    python3 scripts/extract_legal_content.py /tmp/terms.tsx --json > assets/legal/terms.json
    # ...same for privacy / community-guidelines (-> community_guidelines.json) / refund

No summarization — only JSX/template-literal syntax is stripped, wording is
preserved verbatim. Expected page structure:
  <h1>...Title...</h1>
  <Section title="...">
    <p>{`...`}</p> | <ul><li>{`...`}</li>...</ul> | <ol><li>...</li>...</ol>
    <SubSection title="..."> (privacy only) ... </SubSection>
  </Section>
Run without --json to print a Markdown rendering instead (handy for a
visual diff against the live page before committing the JSON).
"""
import re
import sys
import html

def unescape_js_string(s: str) -> str:
    s = s.replace('\\`', '`').replace('\\$', '$').replace("\\'", "'").replace('\\"', '"')
    s = s.replace('\\n', '\n')
    return s

def strip_inline_jsx(s: str, contact_email: str = '') -> str:
    # Collapse the original multi-line, indented JSX children into single-line
    # prose FIRST, so a `<p>\n  Email:{" "}\n  <a ...>x</a>\n</p>` block reads
    # naturally instead of preserving the source's indentation as whitespace.
    s = re.sub(r'\s+', ' ', s).strip()
    # `{" "}` is a JSX expression for a literal space between two elements
    # written on separate source lines (e.g. `Email:{" "}<a>...</a>`).
    s = s.replace('{" "}', ' ')
    # `${CONTACT_EMAIL}` template-literal interpolation (e.g. inside
    # `href={`mailto:${CONTACT_EMAIL}`}`) and the bare JSX expression
    # `{CONTACT_EMAIL}` used as visible link text.
    if contact_email:
        s = s.replace('${CONTACT_EMAIL}', contact_email)
        s = s.replace('{CONTACT_EMAIL}', contact_email)
    # <a href="mailto:x">text</a> or <a href={`mailto:x`}>text</a> -> text
    # (mailto/tel), or [text](href) for a real link.
    def a_sub(m):
        href = m.group('href1') or m.group('href2')
        text = re.sub(r'<[^>]+>', '', m.group('text')).strip()
        if href.startswith('mailto:') or href.startswith('tel:'):
            return text
        return f'[{text}]({href})'
    s = re.sub(
        r'<a[^>]*href=(?:"(?P<href1>[^"]*)"|\{`(?P<href2>[^`]*)`\})[^>]*>\s*(?P<text>.*?)\s*</a>',
        a_sub,
        s,
        flags=re.S,
    )
    # <span className="font-semibold ...">text</span> -> **text** (emphasis)
    s = re.sub(r'<span[^>]*>\s*(.*?)\s*</span>', r'**\1**', s, flags=re.S)
    # A paragraph/list-item split across several JSX children (plain text +
    # an <a>/<span> in the middle) leaves its non-tag text as bare
    # `{`...`}` template-literal fragments once the tags above are gone —
    # unescape each one back to plain text.
    s = re.sub(
        r'\{`([^`]*)`\}',
        lambda m: unescape_js_string(m.group(1)),
        s,
        flags=re.S,
    )
    # drop any other stray tags
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    # A trailing JSX fragment starting with punctuation (e.g. `{`. We will
    # review...`}` right after a closed <a>) leaves a stray space before it.
    s = re.sub(r' ([.,;:!?])', r'\1', s)
    s = html.unescape(s)
    return s.strip()

def extract_text_nodes(body: str, contact_email: str = ''):
    """Yield ('p', text) | ('ul', [items]) | ('ol', [items]) for direct children,
    in document order, within a Section/SubSection body."""
    out = []
    # iterate top-level <p>...</p>, <ul>...</ul>, <ol>...</ol>
    pattern = re.compile(r'<(p|ul|ol)\b[^>]*>(.*?)</\1>', re.S)
    for m in pattern.finditer(body):
        tag, inner = m.group(1), m.group(2)
        if tag == 'p':
            # content is either {`...`} or plain jsx children
            tm = re.fullmatch(r'\s*\{`([^`]*)`\}\s*', inner, re.S)
            if tm:
                text = unescape_js_string(tm.group(1))
            else:
                text = inner
            text = strip_inline_jsx(text, contact_email)
            if text:
                out.append(('p', text))
        else:
            items = []
            for lm in re.finditer(r'<li\b[^>]*>(.*?)</li>', inner, re.S):
                litext = lm.group(1)
                tm = re.fullmatch(r'\s*\{`([^`]*)`\}\s*', litext, re.S)
                if tm:
                    t = unescape_js_string(tm.group(1))
                else:
                    t = litext
                t = strip_inline_jsx(t, contact_email)
                if t:
                    items.append(t)
            out.append((tag, items))
    return out

def find_blocks(src: str, tag: str):
    """Find top-level <TAG title="...">...</TAG> blocks, balancing nested
    occurrences of the same tag (SubSection nests inside Section)."""
    blocks = []
    pos = 0
    open_re = re.compile(rf'<{tag}\s+title="((?:[^"\\]|\\.)*)"\s*>')
    while True:
        m = open_re.search(src, pos)
        if not m:
            break
        title = html.unescape(m.group(1))
        start = m.end()
        depth = 1
        j = start
        tag_re = re.compile(rf'<{tag}\b|</{tag}>')
        while depth > 0:
            tm = tag_re.search(src, j)
            if not tm:
                raise ValueError(f'Unbalanced <{tag}> starting at {start}')
            if tm.group(0) == f'</{tag}>':
                depth -= 1
            else:
                depth += 1
            j = tm.end()
        body = src[start:tm.start()]
        blocks.append((title, body))
        pos = j
    return blocks

def render_markdown(title, sections, contact_email):
    lines = [f'# {title}', '']
    for sec_title, sec_body, subsections in sections:
        lines.append(f'## {sec_title}')
        lines.append('')
        # strip out subsection sub-blocks from sec_body before extracting plain nodes
        clean_body = re.sub(r'<SubSection\s+title="(?:[^"\\]|\\.)*"\s*>.*?</SubSection>', '', sec_body, flags=re.S)
        for kind, payload in extract_text_nodes(clean_body, contact_email):
            if kind == 'p':
                lines.append(payload)
                lines.append('')
            elif kind == 'ul':
                for item in payload:
                    lines.append(f'- {item}')
                lines.append('')
            elif kind == 'ol':
                for idx, item in enumerate(payload, 1):
                    lines.append(f'{idx}. {item}')
                lines.append('')
        for sub_title, sub_body in subsections:
            lines.append(f'### {sub_title}')
            lines.append('')
            for kind, payload in extract_text_nodes(sub_body, contact_email):
                if kind == 'p':
                    lines.append(payload)
                    lines.append('')
                elif kind == 'ul':
                    for item in payload:
                        lines.append(f'- {item}')
                    lines.append('')
                elif kind == 'ol':
                    for idx, item in enumerate(payload, 1):
                        lines.append(f'{idx}. {item}')
                    lines.append('')
    return '\n'.join(lines).rstrip() + '\n'

def render_json(title, sections, contact_email):
    """Flat block list — {type: h2|h3|p|ul|ol, text|items} in document
    order — so the Flutter renderer needs no markdown parsing at all, just
    a switch on `type`."""
    blocks = []

    def add_nodes(body):
        for kind, payload in extract_text_nodes(body, contact_email):
            if kind == 'p':
                blocks.append({'type': 'p', 'text': payload})
            else:
                blocks.append({'type': kind, 'items': payload})

    for sec_title, sec_body, subsections in sections:
        blocks.append({'type': 'h2', 'text': sec_title})
        clean_body = re.sub(
            r'<SubSection\s+title="(?:[^"\\]|\\.)*"\s*>.*?</SubSection>',
            '',
            sec_body,
            flags=re.S,
        )
        add_nodes(clean_body)
        for sub_title, sub_body in subsections:
            blocks.append({'type': 'h3', 'text': sub_title})
            add_nodes(sub_body)

    return {'title': title, 'blocks': blocks}

def parse(path):
    src = open(path, encoding='utf-8').read()
    h1m = re.search(r'<h1[^>]*>\s*(.*?)\s*</h1>', src, re.S)
    page_title = html.unescape(re.sub(r'<[^>]+>', '', h1m.group(1)).strip()) if h1m else 'Untitled'

    cem = re.search(r'const CONTACT_EMAIL\s*=\s*"([^"]+)"', src)
    contact_email = cem.group(1) if cem else ''

    sections = []
    for sec_title, sec_body in find_blocks(src, 'Section'):
        subsections = find_blocks(sec_body, 'SubSection')
        sections.append((sec_title, sec_body, subsections))

    return page_title, sections, contact_email

def main(path):
    page_title, sections, contact_email = parse(path)
    return render_markdown(page_title, sections, contact_email)

if __name__ == '__main__':
    import json
    if len(sys.argv) > 2 and sys.argv[2] == '--json':
        page_title, sections, contact_email = parse(sys.argv[1])
        print(json.dumps(render_json(page_title, sections, contact_email), ensure_ascii=False, indent=2))
    else:
        print(main(sys.argv[1]))
