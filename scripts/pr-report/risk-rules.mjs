// Risk classification for a pull request, mirroring ai/RISK_RULES.md.
// Pure functions: no network, no git — everything comes in as arguments so it
// can be unit-tested. The highest tier any part of the change touches wins.

export const TIERS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const rank = (tier) => TIERS.indexOf(tier);
export const maxTier = (a, b) => (rank(a) >= rank(b) ? a : b);

/** What ai/RISK_RULES.md says each tier needs before merging. */
export const APPROVAL = {
  LOW: 'No approval needed (description is enough).',
  MEDIUM: 'A reviewer, with evidence that tests ran (or a statement that none exist).',
  HIGH: 'Named human approval before merge, with test evidence.',
  CRITICAL: 'Explicit written authorization from a named human for this specific action.',
};

const isTestFile = (f) =>
  /(\.spec\.ts|\.test\.[cm]?[jt]sx?|_test\.dart)$/.test(f) || /^mobile_flutter\/test\//.test(f);

// First match wins, so tests and docs are checked before the sensitive paths.
const PATH_RULES = [
  [isTestFile, 'LOW', 'Tests only'],
  [(f) => /^(docs|ai)\//.test(f) || /\.md$/.test(f) || /^\.claude\//.test(f), 'LOW', 'Docs / tooling notes'],
  [(f) => /^backend\/prisma\/(migrations\/|schema\.prisma)/.test(f), 'HIGH', 'Database schema / migration'],
  [(f) => /^backend\/src\/auth\//.test(f), 'HIGH', 'Authentication'],
  [(f) => /(^|\/)(guards?|decorators)\/[^/]*(roles|jwt|auth)/i.test(f), 'HIGH', 'Authorization (guards / roles)'],
  [(f) => /^backend\/src\/modules\/(wallet|sessions|agora|payouts?)\//.test(f), 'HIGH', 'Wallet / billing / calling backend'],
  [(f) => /^backend\/src\/modules\/(notifications?|push)\//.test(f), 'HIGH', 'Notifications'],
  [(f) => /^mobile_flutter\/lib\/core\/push\//.test(f), 'HIGH', 'Notifications (push service)'],
  [(f) => /^mobile_flutter\/lib\/features\/(calls|wallet|auth)\//.test(f), 'HIGH', 'Call / wallet / auth screens'],
  [(f) => /^mobile_flutter\/(android|ios|macos)\//.test(f), 'HIGH', 'Native Android / iOS'],
  [(f) => /(^|\/)\.env\.example$|validation\.schema\.ts$|^backend\/src\/config\//.test(f), 'HIGH', 'Environment / production configuration'],
  [(f) => /(railway|nixpacks)\.toml$|(^|\/)vercel\.json$|^\.github\/workflows\//.test(f), 'HIGH', 'Deploy config / CI'],
  [(f) => /^scripts\//.test(f), 'MEDIUM', 'Repo scripts / tooling'],
  [(f) => /^web\/(lib|next\.config)/.test(f), 'MEDIUM', 'Website logic'],
  [(f) => /^web\//.test(f), 'LOW', 'Marketing site content'],
  [(f) => /^(backend|admin|mobile_flutter)\//.test(f), 'MEDIUM', 'Product code'],
];

export function classifyFile(file) {
  for (const [test, tier, reason] of PATH_RULES) if (test(file)) return { tier, reason };
  return { tier: 'MEDIUM', reason: 'Unclassified file (escalated one tier)' };
}

const SDK_NAMES = /(agora|firebase|stream|razorpay|iris[-_]rtc)/i;
const CONTENT_SCANNED = /^(backend|admin|mobile_flutter|web)\/|^\.github\//;

/** Parse changed dependency lines in package.json / pubspec.yaml diffs. */
export function dependencyChanges(addedByFile, removedByFile) {
  const out = [];
  for (const file of Object.keys({ ...addedByFile, ...removedByFile })) {
    if (!/(^|\/)(package\.json|pubspec\.yaml)$/.test(file)) continue;
    const parse = (lines) => {
      const m = new Map();
      for (const l of lines || []) {
        const j = /^\s*"([@\w./-]+)":\s*"([\^~>=<]*)(\d+)\.(\d+)\.(\d+)[^"]*"/.exec(l);
        const y = /^\s{2}([\w_]+):\s*[\^~>=<]*(\d+)\.(\d+)\.(\d+)/.exec(l);
        if (j) m.set(j[1], { major: Number(j[3]), v: `${j[3]}.${j[4]}.${j[5]}` });
        else if (y) m.set(y[1], { major: Number(y[2]), v: `${y[2]}.${y[3]}.${y[4]}` });
      }
      return m;
    };
    const before = parse(removedByFile[file]);
    const after = parse(addedByFile[file]);
    for (const [name, a] of after) {
      const b = before.get(name);
      out.push({
        file,
        name,
        from: b ? b.v : null,
        to: a.v,
        major: b ? a.major > b.major : false,
        sdk: SDK_NAMES.test(name),
      });
    }
  }
  return out;
}

/** Content-based triggers on added/removed lines (test files are skipped). */
export function contentSignals(addedByFile, removedByFile) {
  const signals = [];
  const add = (tier, reason, file) => signals.push({ tier, reason, file });
  const files = new Set([...Object.keys(addedByFile), ...Object.keys(removedByFile)]);
  for (const f of files) {
    if (isTestFile(f) || /\.md$/.test(f)) continue;
    // Only product code and deploy config can carry these risks. Tooling, docs and
    // this scanner's own source mention the same words as plain text.
    if (!CONTENT_SCANNED.test(f)) continue;
    const added = addedByFile[f] || [];
    const removed = removedByFile[f] || [];
    const any = [...added, ...removed];
    if (any.some((l) => /@Throttle\(|ThrottlerModule|ThrottlerGuard/.test(l)))
      add('HIGH', 'Rate limiting / throttling change', f);
    if (any.some((l) => /idempotencyKey/.test(l))) add('HIGH', 'Idempotency key logic', f);
    if (removed.some((l) => /@UseGuards\(|JwtAuthGuard|RolesGuard|ValidationPipe|createHmac|timingSafeEqual/.test(l)))
      add('CRITICAL', 'Possible removal of a security control (guard, validation, HMAC)', f);
    if (added.some((l) => /OTP_PROVIDER_TYPE\s*[:=]\s*["']?mock/i.test(l)))
      add('CRITICAL', 'OTP_PROVIDER_TYPE=mock added (fixed login code for every number)', f);
    if (/^backend\/prisma\/migrations\/.*\.sql$/.test(f) &&
        added.some((l) => /\bDROP\s+(TABLE|COLUMN)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i.test(l)))
      add('CRITICAL', 'Destructive migration (drops, truncates or deletes data)', f);
    if (/(key\.properties|\.jks|\.keystore|\.p8|\.p12|\.mobileprovision)$/.test(f))
      add('CRITICAL', 'Signing / release credential file', f);
    if (/AndroidManifest\.xml|Info\.plist/.test(f) &&
        any.some((l) => /uses-permission|NS\w+UsageDescription/.test(l)))
      add('HIGH', 'Runtime permission or usage description changed', f);
  }
  return signals;
}

/**
 * @param {string[]} files          changed paths
 * @param {Record<string,string[]>} addedByFile
 * @param {Record<string,string[]>} removedByFile
 */
export function classifyPr(files, addedByFile = {}, removedByFile = {}) {
  const reasons = new Map(); // key tier|reason -> {tier, reason, files:Set}
  const push = (tier, reason, file) => {
    const k = `${tier}|${reason}`;
    if (!reasons.has(k)) reasons.set(k, { tier, reason, files: new Set() });
    if (file) reasons.get(k).files.add(file);
  };
  let tier = 'LOW';
  for (const f of files) {
    const c = classifyFile(f);
    tier = maxTier(tier, c.tier);
    push(c.tier, c.reason, f);
  }
  const deps = dependencyChanges(addedByFile, removedByFile);
  for (const d of deps) {
    if (d.major || d.sdk) {
      const t = 'HIGH';
      tier = maxTier(tier, t);
      push(t, d.sdk ? 'Change to a payments / calling / push SDK dependency' : 'Dependency major upgrade', d.file);
    } else {
      tier = maxTier(tier, 'MEDIUM');
      push('MEDIUM', 'Dependency change', d.file);
    }
  }
  for (const s of contentSignals(addedByFile, removedByFile)) {
    tier = maxTier(tier, s.tier);
    push(s.tier, s.reason, s.file);
  }
  const list = [...reasons.values()]
    .map((r) => ({ tier: r.tier, reason: r.reason, files: [...r.files] }))
    .sort((a, b) => rank(b.tier) - rank(a.tier) || b.files.length - a.files.length);
  return { tier, reasons: list, dependencies: deps };
}
