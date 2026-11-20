#!/usr/bin/env node
// Turns the Claude Code execution log (the claude-code-action `execution_file`
// output) into a tiny usage summary, so every report can show what its AI review
// cost. Tolerant on purpose: if the log has an unexpected shape it writes nothing
// and the report simply omits the cost line.
//
// Usage: EXECUTION_FILE=/path/to/log.json node usage.mjs [--out pr-report/usage.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** @param {string} text  JSON array or JSON-lines log. @returns {object|null} */
export function parseUsage(text) {
  let entries = [];
  try {
    const parsed = JSON.parse(text);
    entries = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    entries = String(text).split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  }
  // The final "result" entry carries the totals; fall back to the last entry with a cost.
  const result = [...entries].reverse().find((e) => e && (e.type === 'result' || typeof e.total_cost_usd === 'number'));
  if (!result) return null;
  if (result.is_error === true) {
    // The run failed (bad key, no credit, no model access...). Keep a short, masked reason.
    const code = entries.map((e) => e && typeof e.error === 'string' ? e.error : '').filter(Boolean).pop() || '';
    const text = typeof result.result === 'string' ? result.result : '';
    return { failed: true, message: maskSecrets([code, text].filter(Boolean).join(': ')).slice(0, 240) || 'unknown error' };
  }
  const u = result.usage || {};
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const out = {
    costUsd: typeof result.total_cost_usd === 'number' ? result.total_cost_usd : null,
    turns: num(result.num_turns) || null,
    inputTokens: num(u.input_tokens),
    outputTokens: num(u.output_tokens),
    cacheReadTokens: num(u.cache_read_input_tokens),
    cacheWriteTokens: num(u.cache_creation_input_tokens),
  };
  return out.costUsd === null && !out.outputTokens ? null : out;
}

const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** Never let a key or token end up in a log or a PR comment, even by accident. */
export function maskSecrets(s) {
  return String(s)
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, 'sk-ant-(masked)')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1(masked)')
    .replace(/gh[pousr]_[A-Za-z0-9]{20,}/g, '(masked)')
    .replace(/https:\/\/hooks\.slack\.com\/services\/\S+/g, '(masked webhook)');
}

/** One short line for the report footer. */
export function formatUsage(u) {
  if (!u || u.failed) return '';
  const parts = [];
  if (u.costUsd !== null) parts.push(`$${u.costUsd.toFixed(2)}`);
  if (u.turns) parts.push(`${u.turns} turns`);
  const inTok = u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens;
  parts.push(`${k(inTok)} in (${k(u.cacheReadTokens)} cached) / ${k(u.outputTokens)} out`);
  return `AI review: ${parts.join(', ')}`;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const file = process.env.EXECUTION_FILE;
  const outIdx = process.argv.indexOf('--out');
  const out = outIdx > -1 ? process.argv[outIdx + 1] : 'pr-report/usage.json';
  try {
    const usage = parseUsage(readFileSync(file, 'utf8'));
    if (usage) {
      writeFileSync(out, JSON.stringify(usage, null, 2));
      console.log(usage.failed ? `AI review FAILED: ${usage.message}` : formatUsage(usage));
    } else console.log('No usage found in the execution log; skipping cost line.');
  } catch (e) { console.log(`Could not read usage (${String(e.message).split('\n')[0]}); skipping.`); }
}
