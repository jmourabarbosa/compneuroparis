import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_VISIBLE_KEYWORDS,
  buildInstituteCardMarkup,
  buildJobCardMarkup,
  buildPiCardMarkup,
  escapeHTML
} from '../js/public-card-utils.mjs';

test('escapeHTML escapes basic HTML characters', () => {
  assert.equal(escapeHTML('<script>"x"&\'y\''), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;');
});

test('buildPiCardMarkup includes hiring badge, managed state, and keyword overflow', () => {
  const { html, overflowCount } = buildPiCardMarkup({
    name: 'Alice Example',
    keywords: ['a', 'b', 'c', 'd', 'e', 'f'],
    claimedBy: 'user-1',
    subfields: ['systems']
  }, {
    subfieldLabel: 'Systems',
    instituteNames: ['ICM'],
    isHiring: true
  });

  assert.equal(overflowCount, 1);
  assert.match(html, /Managed by PI/);
  assert.match(html, /Hiring/);
  assert.match(html, /ICM/);
  assert.match(html, /\+1/);
});

test('buildInstituteCardMarkup truncates summaries and shows website links', () => {
  const html = buildInstituteCardMarkup({
    name: 'Institute',
    summary: 'x'.repeat(130),
    website: 'https://example.org',
    keywords: ['systems']
  });

  assert.match(html, /Website/);
  assert.match(html, /systems/);
  assert.match(html, /\.\.\./);
});

test('buildJobCardMarkup includes job metadata and keywords', () => {
  const html = buildJobCardMarkup({
    title: 'Postdoc',
    piName: 'Alice Example',
    description: 'Study brains',
    positionType: 'Postdoc',
    createdAt: {
      toDate() {
        return new Date('2026-03-19T00:00:00Z');
      }
    }
  }, ['vision', 'systems']);

  assert.match(html, /Postdoc/);
  assert.match(html, /Alice Example/);
  assert.match(html, /vision/);
  assert.match(html, /19 Mar 2026/);
});
