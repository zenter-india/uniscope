import test from 'node:test';
import assert from 'node:assert/strict';
import { formatUsage, parseUsage } from './usage.mjs';

const result = {
  type: 'result', subtype: 'success', total_cost_usd: 0.1834, num_turns: 11,
  usage: { input_tokens: 4200, output_tokens: 3900, cache_read_input_tokens: 61000, cache_creation_input_tokens: 17500 },
};

test('reads the result entry from a JSON array log', () => {
  const u = parseUsage(JSON.stringify([{ type: 'system' }, { type: 'assistant' }, result]));
  assert.equal(u.costUsd, 0.1834);
  assert.equal(u.turns, 11);
  assert.equal(u.outputTokens, 3900);
  assert.equal(u.cacheReadTokens, 61000);
});

test('reads a JSON-lines log', () => {
  const u = parseUsage([JSON.stringify({ type: 'system' }), JSON.stringify(result)].join('\n'));
  assert.equal(u.costUsd, 0.1834);
});

test('unexpected or empty logs give null, never throw', () => {
  assert.equal(parseUsage('not json at all'), null);
  assert.equal(parseUsage(JSON.stringify([{ type: 'system' }])), null);
  assert.equal(parseUsage(''), null);
});

test('formats one short footer line', () => {
  const line = formatUsage(parseUsage(JSON.stringify([result])));
  assert.equal(line, 'AI review: $0.18, 11 turns, 82.7k in (61.0k cached) / 3.9k out');
  assert.equal(formatUsage(null), '');
});
