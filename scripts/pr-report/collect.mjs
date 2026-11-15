#!/usr/bin/env node
// Collects the mechanical facts about a pull request (no AI, no secrets):
// risk tier, files by area, migrations, dependency changes, env/config changes,
// secret-looking values in added lines (names only, never values), merge
// conflicts against the base, test evidence and CI status.
//
// Usage (in CI the env vars come from the pull_request event):
//   PR_NUMBER=50 BASE_SHA=<sha> HEAD_SHA=<sha> GH_TOKEN=... node collect.mjs [--out pr-report]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { APPROVAL, classifyPr } from './risk-rules.mjs';

const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
const shSafe = (cmd, args) => {
  try { return sh(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
};

const { PR_NUMBER, BASE_SHA, HEAD_SHA } = process.env;
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx > -1 ? process.argv[outIdx + 1] : 'pr-report';
if (!PR_NUMBER || !BASE_SHA || !HEAD_SHA) {
  console.error('PR_NUMBER, BASE_SHA and HEAD_SHA are required.');
  process.exit(2);
}

// ---- PR metadata -----------------------------------------------------------
const meta = JSON.parse(
  sh('gh', ['pr', 'view', PR_NUMBER, '--json',
    'title,author,baseRefName,headRefName,url,additions,deletions,changedFiles,isDraft,labels,number']),
);
// CI status is best-effort: a token without checks/statuses read access must not break the report.
try {
  meta.statusCheckRollup = JSON.parse(sh('gh', ['pr', 'view', PR_NUMBER, '--json', 'statusCheckRollup'],
    { stdio: ['ignore', 'pipe', 'ignore'] })).statusCheckRollup;
} catch { meta.statusCheckRollup = []; }

// ---- Diff ------------------------------------------------------------------
const range = `${BASE_SHA}...${HEAD_SHA}`;
const nameStatus = sh('git', ['diff', '--name-status', '-M', range]).trim().split('\n').filter(Boolean);
const files = [];
const status = {};
for (const line of nameStatus) {
  const parts = line.split('\t');
  const file = parts[parts.length - 1];
  files.push(file);
  status[file] = parts[0][0];
}

const addedByFile = {};
const removedByFile = {};
{
  const patch = sh('git', ['diff', '-U0', '--no-color', range]);
  let cur = null;
  for (const l of patch.split('\n')) {
    if (l.startsWith('+++ b/')) { cur = l.slice(6); continue; }
    if (l.startsWith('--- a/')) { cur = l.slice(6); continue; }
    if (l.startsWith('+++') || l.startsWith('---') || !cur) continue;
    if (l.startsWith('+')) (addedByFile[cur] ||= []).push(l.slice(1));
    else if (l.startsWith('-')) (removedByFile[cur] ||= []).push(l.slice(1));
  }
}

// ---- Risk ------------------------------------------------------------------
const risk = classifyPr(files, addedByFile, removedByFile);

// ---- Areas -----------------------------------------------------------------
const areaOf = (f) => {
  if (/^admin\//.test(f)) return 'admin';
  if (/^web\//.test(f)) return 'web';
  if (/^mobile_flutter\//.test(f)) return 'mobile';
  if (/^backend\/prisma\//.test(f)) return 'database';
  if (/^backend\//.test(f)) return 'backend';
  if (/^(docs|ai)\/|\.md$/.test(f)) return 'docs';
  if (/^\.github\/|^scripts\/|^\.claude\//.test(f)) return 'tooling';
  return 'other';
};
const areas = {};
for (const f of files) areas[areaOf(f)] = (areas[areaOf(f)] || 0) + 1;

// ---- Migrations, config, deps ----------------------------------------------
const migrations = files.filter((f) => /^backend\/prisma\/migrations\/.+\.sql$/.test(f));
const schemaChanged = files.includes('backend/prisma/schema.prisma');
const configFiles = files.filter((f) =>
  /(^|\/)\.env\.example$|validation\.schema\.ts$|(railway|nixpacks)\.toml$|vercel\.json$|^\.github\/workflows\//.test(f));
const envVarsAdded = [];
for (const f of files.filter((x) => /\.env\.example$|validation\.schema\.ts$/.test(x))) {
  for (const l of addedByFile[f] || []) {
    const m = /^\s*#?\s*([A-Z][A-Z0-9_]{2,})\s*[=:]/.exec(l);
    if (m) envVarsAdded.push(m[1]);
  }
}

// ---- Secret scan on added lines (names only, never values) -----------------
const SECRET_PATTERNS = [
  ['Razorpay key', /rzp_(live|test)_[A-Za-z0-9]{8,}/],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{30,}/],
  ['Slack token', /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ['live Stripe-style key', /sk_(live|test)_[A-Za-z0-9]{16,}/],
  ['JWT', /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ['DB URL with password', /postgres(ql)?:\/\/[^:@/\s]+:(?!\[|<|password|your|xxx|\*)[^@\s<\[]{6,}@/i],
  ['Sentry DSN', /https:\/\/[0-9a-f]{20,}@[a-z0-9.]*sentry\.io/],
];
const secretHits = [];
for (const [file, lines] of Object.entries(addedByFile)) {
  if (/\.lock$|package-lock\.json$/.test(file)) continue;
  for (const l of lines) {
    for (const [name, re] of SECRET_PATTERNS) {
      if (re.test(l)) secretHits.push({ file, kind: name });
    }
  }
}
const secretSummary = [...new Map(secretHits.map((h) => [`${h.file}|${h.kind}`, h])).values()];

// ---- Merge simulation against the base --------------------------------------
let merge = { clean: null, conflicts: [] };
{
  try {
    sh('git', ['merge-tree', '--write-tree', '--name-only', BASE_SHA, HEAD_SHA], { stdio: ['ignore', 'pipe', 'ignore'] });
    merge = { clean: true, conflicts: [] };
  } catch (e) {
    if (e.status === 1) {
      const out = String(e.stdout || '').split('\n');
      const conflicts = [];
      for (const l of out.slice(1)) { if (!l.trim()) break; conflicts.push(l.trim()); }
      merge = { clean: false, conflicts };
    }
  }
}

// ---- Test evidence ----------------------------------------------------------
const isTest = (f) => /(\.spec\.ts|\.test\.[cm]?[jt]sx?|_test\.dart)$/.test(f) || /^mobile_flutter\/test\//.test(f);
const productFiles = files.filter((f) => /^(backend|admin|mobile_flutter|web)\//.test(f) && !isTest(f) && !/\.md$/.test(f) && !/\.sql$/.test(f));
const testFiles = files.filter(isTest);

// ---- CI status (at the time of this report) --------------------------------
const checks = {};
for (const c of meta.statusCheckRollup || []) {
  const name = c.name || c.context;
  if (!name || /pr report/i.test(name)) continue;
  checks[name] = (c.conclusion || c.status || c.state || 'UNKNOWN').toUpperCase();
}

const facts = {
  pr: {
    number: meta.number,
    title: meta.title,
    author: meta.author?.login,
    base: meta.baseRefName,
    head: meta.headRefName,
    url: meta.url,
    draft: meta.isDraft,
    labels: (meta.labels || []).map((l) => l.name),
    additions: meta.additions,
    deletions: meta.deletions,
    changedFiles: meta.changedFiles,
    headSha: HEAD_SHA,
  },
  risk: { tier: risk.tier, approval: APPROVAL[risk.tier], reasons: risk.reasons.map((r) => ({ ...r, files: r.files.slice(0, 12) })) },
  areas,
  migrations,
  schemaChanged,
  configFiles,
  envVarsAdded: [...new Set(envVarsAdded)],
  dependencies: risk.dependencies,
  secrets: secretSummary,
  merge,
  tests: { productFiles: productFiles.length, testFiles: testFiles.length, testFileNames: testFiles.slice(0, 15) },
  checks,
  files: files.slice(0, 200).map((f) => `${status[f]} ${f}`),
  filesTruncated: files.length > 200,
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/facts.json`, JSON.stringify(facts, null, 2));

// Human/AI-readable version.
const L = [];
L.push(`# PR #${facts.pr.number}: ${facts.pr.title}`);
L.push(`Author: ${facts.pr.author} | ${facts.pr.head} -> ${facts.pr.base} | +${facts.pr.additions}/-${facts.pr.deletions} in ${facts.pr.changedFiles} files`);
L.push('');
L.push(`## Risk tier (per ai/RISK_RULES.md): ${facts.risk.tier}`);
L.push(`Approval needed: ${facts.risk.approval}`);
for (const r of facts.risk.reasons.filter((x) => x.tier !== 'LOW').slice(0, 12))
  L.push(`- ${r.tier}: ${r.reason} (${r.files.slice(0, 4).join(', ')}${r.files.length > 4 ? ', ...' : ''})`);
L.push('');
L.push(`## Areas touched: ${Object.entries(areas).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
L.push(`## Migrations: ${migrations.length ? migrations.join(', ') : 'none'}${schemaChanged ? ' (schema.prisma changed)' : ''}`);
L.push(`## Env / config files changed: ${configFiles.join(', ') || 'none'}${facts.envVarsAdded.length ? ` | variable names added: ${facts.envVarsAdded.join(', ')}` : ''}`);
L.push(`## Dependency changes: ${facts.dependencies.length ? facts.dependencies.map((d) => `${d.name} ${d.from || '(new)'} -> ${d.to}${d.major ? ' MAJOR' : ''}${d.sdk ? ' SDK' : ''}`).join('; ') : 'none'}`);
L.push(`## Secret-looking values in added lines: ${secretSummary.length ? secretSummary.map((s) => `${s.kind} in ${s.file}`).join('; ') : 'none'}`);
L.push(`## Merge against ${facts.pr.base}: ${merge.clean === null ? 'could not simulate' : merge.clean ? 'clean' : `CONFLICTS in ${merge.conflicts.join(', ')}`}`);
L.push(`## Test evidence: ${testFiles.length} test file(s) changed alongside ${productFiles.length} product file(s)`);
L.push(`## CI checks right now: ${Object.entries(checks).map(([k, v]) => `${k}=${v}`).join('; ') || 'none reported yet'}`);
L.push('');
L.push('## Changed files');
L.push(...facts.files);
if (facts.filesTruncated) L.push('(list truncated to 200 files)');
writeFileSync(`${OUT}/facts.md`, L.join('\n'));
console.log(`facts written to ${OUT}/ (risk ${facts.risk.tier}, ${files.length} files)`);
