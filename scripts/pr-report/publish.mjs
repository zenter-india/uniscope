#!/usr/bin/env node
// Publishes a PR report: a sticky PR comment, an optional Slack message and an
// optional Notion page. Plain code, no AI. It never approves, merges or pushes.
//
// Each destination is used only if its credential is present:
//   PR comment : GH_TOKEN (the workflow's GITHUB_TOKEN) + GITHUB_REPOSITORY
//   Slack      : SLACK_PR_WEBHOOK
//   Notion     : NOTION_TOKEN + NOTION_PR_REPORTS_DB (database id)
//
// Usage: node publish.mjs [--dir pr-report] [--dry-run]
//   Reads <dir>/facts.json (required) and <dir>/review.md (optional).
//   Env: EVENT_ACTION (opened|synchronize|...), SKIP_REASON (why no AI review).
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { formatUsage } from './usage.mjs';

export const MARKER = '<!-- uniscope-pr-report -->';
const EMOJI = { LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴' };
const VERDICTS = ['APPROVE', 'CHANGES REQUESTED', 'NEEDS HUMAN DECISION'];

// ---- pure builders (unit-tested) -------------------------------------------

/** Stop a model-written report from pinging people: break every @mention. */
export function sanitize(text, max = 20000) {
  return String(text || '').replace(/@(?=[A-Za-z0-9_-])/g, '@​').slice(0, max);
}

export function parseVerdict(review) {
  const m = /^#{1,3}\s*Verdict:\s*([A-Za-z ]+)/im.exec(review || '');
  const v = m ? m[1].trim().toUpperCase() : '';
  return VERDICTS.find((x) => v.startsWith(x)) || 'UNKNOWN';
}

export function countFindings(review) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const l of String(review || '').split('\n')) {
    const m = /^\|\s*\d+\s*\|\s*(critical|high|medium|low)\b/i.exec(l);
    if (m) counts[m[1].toLowerCase()]++;
  }
  return counts;
}

const checkSummary = (checks) => {
  const v = Object.values(checks || {});
  const ok = v.filter((s) => s === 'SUCCESS').length;
  const bad = v.filter((s) => ['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED'].includes(s)).length;
  const other = v.length - ok - bad;
  return { ok, bad, other, total: v.length };
};

export function buildComment(facts, review, { skipReason = '', now = new Date(), usageLine = '' } = {}) {
  const { pr, risk } = facts;
  const tier = risk.tier;
  const cs = checkSummary(facts.checks);
  const conflicts = facts.merge.clean === null ? '⚪ could not be simulated'
    : facts.merge.clean ? '✅ clean'
    : `❌ conflicts in ${facts.merge.conflicts.map((c) => `\`${c}\``).join(', ')}`;
  const migr = facts.migrations.length ? `⚠️ ${facts.migrations.length} (${facts.migrations.map((m) => `\`${m.split('/').slice(-2, -1)[0]}\``).join(', ')})` : '✅ none';
  const deps = facts.dependencies.length
    ? facts.dependencies.map((d) => `${d.name} ${d.from || 'new'} → ${d.to}${d.major ? ' **major**' : ''}${d.sdk ? ' **SDK**' : ''}`).join('; ')
    : '✅ none';
  const secrets = facts.secrets.length ? `❌ ${facts.secrets.map((s) => `${s.kind} in \`${s.file}\``).join('; ')}` : '✅ none found';
  const tests = facts.tests.productFiles === 0 ? '— (no product code changed)'
    : facts.tests.testFiles > 0 ? `✅ ${facts.tests.testFiles} test file(s) with ${facts.tests.productFiles} product file(s)`
    : `⚠️ no test files changed (${facts.tests.productFiles} product file(s))`;
  const ci = cs.total === 0 ? '⚪ none reported yet' : `${cs.bad ? '❌' : cs.other ? '⏳' : '✅'} ${cs.ok} passed, ${cs.bad} failing, ${cs.other} pending/skipped`;
  const why = risk.reasons.filter((r) => r.tier !== 'LOW').slice(0, 10)
    .map((r) => `- **${r.tier}** — ${r.reason}: ${r.files.slice(0, 3).map((f) => `\`${f}\``).join(', ')}${r.files.length > 3 ? ', …' : ''}`).join('\n') || '- Only docs / tests / content changed.';
  const areas = Object.entries(facts.areas).map(([k, v]) => `${k} ${v}`).join(', ') || '—';

  // The review opens with "## Verdict: X"; inside the comment that is just a bold line.
  const reviewBlock = review
    ? sanitize(review).replace(/^#{1,3}\s*Verdict:\s*/im, '**Verdict:** ')
    : `_AI review was not run${skipReason ? `: ${sanitize(skipReason, 300)}` : ''}. The checks above are mechanical and still apply._`;

  return `${MARKER}
## ${EMOJI[tier]} PR report — risk **${tier}**
> **Approval needed:** ${risk.approval}

| Check | Result |
|---|---|
| Merge into \`${pr.base}\` | ${conflicts} |
| Migrations | ${migr} |
| Env / config files | ${facts.configFiles.length ? `⚠️ ${facts.configFiles.map((f) => `\`${f}\``).join(', ')}${facts.envVarsAdded.length ? ` (adds ${facts.envVarsAdded.map((v) => `\`${v}\``).join(', ')})` : ''}` : '✅ none'} |
| Dependencies | ${deps} |
| Secret-looking values in the diff | ${secrets} |
| Tests | ${tests} |
| CI checks so far | ${ci} |
| Size | +${pr.additions}/-${pr.deletions} in ${pr.changedFiles} files (${areas}) |

<details><summary>Why this tier</summary>

${why}

</details>

### Review
${reviewBlock}

<sub>Automated, read-only report for \`${pr.headSha.slice(0, 7)}\`, updated ${now.toISOString().replace('T', ' ').slice(0, 16)} UTC${usageLine ? ` · ${sanitize(usageLine, 200)}` : ''}. It never approves, merges or pushes; a human decides.</sub>
`;
}

const slackEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildSlack(facts, verdict, counts, commentUrl) {
  const { pr, risk } = facts;
  const found = ['critical', 'high', 'medium', 'low'].filter((k) => counts[k]).map((k) => `${counts[k]} ${k}`).join(', ') || 'no findings listed';
  const lines = [
    `${EMOJI[risk.tier]} *${risk.tier}* · PR #${pr.number} <${pr.url}|${slackEscape(pr.title).slice(0, 120)}> by ${slackEscape(pr.author)} (${slackEscape(pr.head)} → ${slackEscape(pr.base)})`,
    `Verdict: *${verdict}* · ${found} · merge: ${facts.merge.clean === false ? 'CONFLICTS' : facts.merge.clean ? 'clean' : '?'} · migrations: ${facts.migrations.length}${facts.secrets.length ? ' · :warning: secret-looking value in diff' : ''}`,
    `Needs: ${risk.approval}`,
  ];
  if (commentUrl) lines.push(`<${commentUrl}|Full report on the PR>`);
  return { text: lines.join('\n') };
}

const chunk = (s, n = 1900) => { const out = []; for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n)); return out; };
const para = (text) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: text } }] } });
const heading = (text) => ({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: text } }] } });

export function buildNotionPage(facts, verdict, review, dbId, now = new Date()) {
  const { pr, risk } = facts;
  const facts1 = [
    `Risk ${risk.tier}. Approval needed: ${risk.approval}`,
    `Merge into ${pr.base}: ${facts.merge.clean === null ? 'not simulated' : facts.merge.clean ? 'clean' : 'conflicts: ' + facts.merge.conflicts.join(', ')}`,
    `Migrations: ${facts.migrations.length || 'none'}. Dependencies changed: ${facts.dependencies.length || 'none'}. Secret-looking values: ${facts.secrets.length || 'none'}.`,
    `Tests: ${facts.tests.testFiles} test file(s) with ${facts.tests.productFiles} product file(s). Size: +${pr.additions}/-${pr.deletions} in ${pr.changedFiles} files.`,
  ];
  const children = [heading('Facts'), ...facts1.map(para), heading('Review'),
    ...chunk(sanitize(review || 'AI review was not run for this PR.', 15000)).slice(0, 80).map(para)];
  return {
    parent: { database_id: dbId },
    properties: {
      Name: { title: [{ text: { content: `PR #${pr.number} — ${pr.title}`.slice(0, 180) } }] },
      PR: { number: pr.number },
      Risk: { select: { name: risk.tier } },
      Verdict: { select: { name: verdict } },
      Author: { rich_text: [{ text: { content: String(pr.author || '') } }] },
      Branch: { rich_text: [{ text: { content: `${pr.head} → ${pr.base}` } }] },
      URL: { url: pr.url },
      Updated: { date: { start: now.toISOString() } },
    },
    children,
  };
}

/** Slack on every new/reopened/ready PR; on pushes only for HIGH and CRITICAL. */
export function shouldPostSlack(action, tier) {
  if (action && action !== 'synchronize') return true;
  return tier === 'HIGH' || tier === 'CRITICAL';
}

// ---- I/O (not unit-tested; every call is guarded by its credential) --------

const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 });

async function upsertComment(repo, number, body, dry) {
  if (dry) { console.log(`[dry-run] would upsert sticky comment on ${repo}#${number} (${body.length} chars)`); return null; }
  const ids = gh(['api', `repos/${repo}/issues/${number}/comments`, '--paginate', '--jq',
    `.[] | select(.body | contains("${MARKER}")) | .id`]).trim().split('\n').filter(Boolean);
  const payload = JSON.stringify({ body });
  if (ids.length) {
    const out = gh(['api', '-X', 'PATCH', `repos/${repo}/issues/comments/${ids[ids.length - 1]}`, '--input', '-', '--jq', '.html_url'], payload);
    return out.trim();
  }
  const out = gh(['api', '-X', 'POST', `repos/${repo}/issues/${number}/comments`, '--input', '-', '--jq', '.html_url'], payload);
  return out.trim();
}

async function postSlack(webhook, payload, dry) {
  if (dry) { console.log('[dry-run] Slack message:\n' + payload.text); return; }
  const res = await fetch(webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) console.warn(`Slack post failed: HTTP ${res.status}`);
}

async function upsertNotion(token, dbId, facts, verdict, review, dry) {
  const page = buildNotionPage(facts, verdict, review, dbId);
  if (dry) { console.log(`[dry-run] Notion page "${page.properties.Name.title[0].text.content}" with ${page.children.length} blocks`); return; }
  const headers = { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'content-type': 'application/json' };
  const q = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST', headers, body: JSON.stringify({ filter: { property: 'PR', number: { equals: facts.pr.number } } }),
  });
  if (q.ok) {
    for (const old of (await q.json()).results || [])
      await fetch(`https://api.notion.com/v1/pages/${old.id}`, { method: 'PATCH', headers, body: JSON.stringify({ archived: true }) });
  } else console.warn(`Notion query failed: HTTP ${q.status}`);
  const res = await fetch('https://api.notion.com/v1/pages', { method: 'POST', headers, body: JSON.stringify(page) });
  if (!res.ok) console.warn(`Notion create failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry-run');
  const dir = argv.includes('--dir') ? argv[argv.indexOf('--dir') + 1] : 'pr-report';
  const facts = JSON.parse(readFileSync(`${dir}/facts.json`, 'utf8'));
  const review = existsSync(`${dir}/review.md`) ? readFileSync(`${dir}/review.md`, 'utf8').trim() : '';
  const verdict = review ? parseVerdict(review) : 'NOT REVIEWED';
  const counts = countFindings(review);
  let usageLine = '';
  if (existsSync(`${dir}/usage.json`)) {
    try { usageLine = formatUsage(JSON.parse(readFileSync(`${dir}/usage.json`, 'utf8'))); } catch { /* cost line is optional */ }
  }
  const body = buildComment(facts, review, { skipReason: process.env.SKIP_REASON || '', usageLine });
  const repo = process.env.GITHUB_REPOSITORY;

  let commentUrl = null;
  try {
    if (dry || (repo && process.env.GH_TOKEN)) commentUrl = await upsertComment(repo || 'owner/repo', facts.pr.number, body, dry);
    else console.log('No GH_TOKEN/GITHUB_REPOSITORY: skipping PR comment.');
  } catch (e) { console.warn('PR comment failed:', String(e.message).split('\n')[0]); }

  if (process.env.SLACK_PR_WEBHOOK || dry) {
    if (shouldPostSlack(process.env.EVENT_ACTION, facts.risk.tier))
      await postSlack(process.env.SLACK_PR_WEBHOOK, buildSlack(facts, verdict, counts, commentUrl), dry);
    else console.log('Slack: skipped (push to an existing non-HIGH PR).');
  }
  if ((process.env.NOTION_TOKEN && process.env.NOTION_PR_REPORTS_DB) || dry)
    await upsertNotion(process.env.NOTION_TOKEN, process.env.NOTION_PR_REPORTS_DB || 'DB_ID', facts, verdict, review, dry);

  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, body);
  if (dry) console.log('\n----- comment preview -----\n' + body);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((e) => { console.error('publish failed:', e.message); process.exit(0); }); // never fail the PR over a report
}
