import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKER, buildComment, buildNotionPage, buildSlack, countFindings, parseVerdict, sanitize, shouldPostSlack } from './publish.mjs';

const facts = {
  pr: { number: 50, title: 'One account <per> phone & more', author: 'anu', base: 'staging', head: 'fix/x', url: 'https://github.com/o/r/pull/50', additions: 250, deletions: 2, changedFiles: 8, headSha: 'abcdef1234567' },
  risk: { tier: 'HIGH', approval: 'Named human approval before merge, with test evidence.', reasons: [{ tier: 'HIGH', reason: 'Database schema / migration', files: ['backend/prisma/schema.prisma'] }] },
  areas: { backend: 6, database: 2 },
  migrations: ['backend/prisma/migrations/2026_x/migration.sql'],
  configFiles: [], envVarsAdded: [], dependencies: [], secrets: [],
  merge: { clean: true, conflicts: [] },
  tests: { productFiles: 6, testFiles: 1, testFileNames: [] },
  checks: { a: 'SUCCESS', b: 'SUCCESS', c: 'IN_PROGRESS' },
};
const review = `## Verdict: CHANGES REQUESTED

### Summary
Looks fine overall. cc @someone

### Findings
| # | Severity | Where | Finding | Suggested fix |
|---|---|---|---|---|
| 1 | High | a.ts:10 | leak | fix |
| 2 | Medium | b.ts:3 | slow | fix |
`;

test('sanitize breaks @mentions', () => {
  assert.ok(!/@someone/.test(sanitize('ping @someone and @team-x')));
  assert.ok(sanitize('mail a@b.com').includes('a@')); // not followed by name start? still safe either way
});

test('verdict and findings are parsed', () => {
  assert.equal(parseVerdict(review), 'CHANGES REQUESTED');
  assert.equal(parseVerdict('## Verdict: approve with notes'), 'APPROVE');
  assert.equal(parseVerdict('nothing here'), 'UNKNOWN');
  assert.deepEqual(countFindings(review), { critical: 0, high: 1, medium: 1, low: 0 });
});

test('comment has marker, tier, no mention pings and a read-only note', () => {
  const c = buildComment(facts, review);
  assert.ok(c.startsWith(MARKER));
  assert.ok(c.includes('risk **HIGH**'));
  assert.ok(c.includes('| Merge into `staging` | ✅ clean |'));
  assert.ok(c.includes('never approves, merges or pushes'));
  assert.ok(!/@someone/.test(c));
});

test('comment footer shows the AI review cost when known, and not otherwise', () => {
  const withCost = buildComment(facts, review, { usageLine: 'AI review: $0.18, 11 turns, 82.7k in (61.0k cached) / 3.9k out' });
  assert.ok(withCost.includes('· AI review: $0.18, 11 turns'));
  assert.ok(!buildComment(facts, review).includes('AI review: $'));
});

test('comment without a review explains why', () => {
  const c = buildComment(facts, '', { skipReason: 'release PR' });
  assert.ok(c.includes('AI review was not run: release PR'));
});

test('conflicts and secrets are shown loudly', () => {
  const f = { ...facts, merge: { clean: false, conflicts: ['x.ts'] }, secrets: [{ kind: 'JWT', file: 'y.ts' }] };
  const c = buildComment(f, review);
  assert.ok(c.includes('❌ conflicts in `x.ts`'));
  assert.ok(c.includes('❌ JWT in `y.ts`'));
});

test('slack message escapes markup and carries the essentials', () => {
  const s = buildSlack(facts, 'CHANGES REQUESTED', countFindings(review), 'https://c');
  assert.ok(s.text.includes('PR #50'));
  assert.ok(s.text.includes('&lt;per&gt;') && s.text.includes('&amp;'));
  assert.ok(s.text.includes('1 high, 1 medium'));
  assert.ok(s.text.includes('Full report'));
});

test('slack gating: new PRs always, pushes only for HIGH and CRITICAL', () => {
  assert.equal(shouldPostSlack('opened', 'LOW'), true);
  assert.equal(shouldPostSlack('synchronize', 'MEDIUM'), false);
  assert.equal(shouldPostSlack('synchronize', 'HIGH'), true);
  assert.equal(shouldPostSlack('synchronize', 'CRITICAL'), true);
});

test('notion page matches the PR Reports database schema', () => {
  const p = buildNotionPage(facts, 'CHANGES REQUESTED', review, 'DB123', new Date('2026-11-15T00:00:00Z'));
  assert.equal(p.parent.database_id, 'DB123');
  assert.deepEqual(Object.keys(p.properties).sort(), ['Author', 'Branch', 'Name', 'PR', 'Risk', 'URL', 'Updated', 'Verdict'].sort());
  assert.equal(p.properties.Risk.select.name, 'HIGH');
  assert.equal(p.properties.PR.number, 50);
  assert.ok(p.children.every((b) => b.object === 'block'));
});
