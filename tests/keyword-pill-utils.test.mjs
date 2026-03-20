import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildKeywordCounts,
  getMatchingKeywords,
  getNormalizedGroupKeywords
} from '../js/keyword-pill-utils.mjs';

test('getNormalizedGroupKeywords caches normalized keywords per group object', () => {
  const cache = new WeakMap();
  const group = { keywords: [' Vision ', 'fMRI', ''] };

  const first = getNormalizedGroupKeywords(group, cache);
  const second = getNormalizedGroupKeywords(group, cache);

  assert.deepEqual(first, ['vision', 'fmri']);
  assert.equal(first, second);
});

test('buildKeywordCounts aggregates normalized keyword frequencies across groups', () => {
  const groups = [
    { keywords: [' Vision ', 'fMRI'] },
    { keywords: ['vision', 'Systems'] }
  ];

  const counts = buildKeywordCounts(groups, new WeakMap());

  assert.equal(counts.get('vision'), 2);
  assert.equal(counts.get('fmri'), 1);
  assert.equal(counts.get('systems'), 1);
});

test('getMatchingKeywords caches fuzzy-match results while preserving count sort order', () => {
  const keywordCounts = new Map([
    ['vision', 3],
    ['visual', 1],
    ['systems', 2]
  ]);
  const cache = new Map();
  const calls = [];
  const fuzzyMatcher = (keyword, query) => {
    calls.push(`${query}:${keyword}`);
    return keyword.startsWith('vis');
  };

  const first = getMatchingKeywords(keywordCounts, 'vis', fuzzyMatcher, cache);
  const second = getMatchingKeywords(keywordCounts, 'vis', fuzzyMatcher, cache);

  assert.deepEqual(first, ['vision', 'visual']);
  assert.deepEqual(second, ['vision', 'visual']);
  assert.deepEqual(calls, ['vis:vision', 'vis:visual', 'vis:systems']);
});
