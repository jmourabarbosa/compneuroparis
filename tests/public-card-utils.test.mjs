import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_VISIBLE_KEYWORDS,
  buildInstituteCardMarkup,
  buildJobApplicantCardMarkup,
  buildJobCardMarkup,
  buildPiCardMarkup,
  escapeHTML
} from '../js/public-card-utils.mjs';

test('escapeHTML escapes basic HTML characters', () => {
  assert.equal(escapeHTML('<script>"x"&\'y\''), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;');
});

test('buildPiCardMarkup includes hiring badge, validated state, and keyword overflow', () => {
  const { html, overflowCount } = buildPiCardMarkup({
    name: 'Alice Example',
    keywords: ['a', 'b', 'c', 'd', 'e', 'f'],
    claimedBy: 'user-1',
    subfields: ['systems']
  }, {
    subfieldLabel: 'Systems',
    instituteRefs: [{ id: 'inst-1', name: 'ICM' }],
    isHiring: true
  });

  assert.equal(overflowCount, 1);
  assert.match(html, /Validated/);
  assert.match(html, /Hiring/);
  assert.match(html, /card-name-stack/);
  assert.match(html, /card-meta-row/);
  assert.match(html, /ICM/);
  assert.match(html, /card-institute-link/);
  assert.match(html, /data-institute-key="inst-1"/);
  assert.match(html, /\+1/);
});

test('buildInstituteCardMarkup truncates summaries and shows website links', () => {
  const html = buildInstituteCardMarkup({
    name: 'Institute',
    summary: 'x'.repeat(130),
    website: 'https://example.org',
    keywords: ['systems'],
    claimedBy: 'user-2',
    claimedByEmail: 'marie.curie@example.org'
  }, { piCount: 12 });

  assert.match(html, /Website/);
  assert.match(html, /systems/);
  assert.match(html, /12 PIs linked/);
  assert.match(html, /Claimed/);
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

test('buildJobApplicantCardMarkup includes public applicant fields', () => {
  const html = buildJobApplicantCardMarkup({
    name: 'Alice Applicant',
    email: 'alice@example.org',
    lookingFor: ['Postdoc'],
    subfields: ['systems'],
    targetSubfields: ['human'],
    summary: 'Interested in circuit neuroscience',
    createdAt: {
      toDate() {
        return new Date('2026-03-20T00:00:00Z');
      }
    }
  }, {
    subfieldLabels: { systems: 'Systems' },
    instituteRefs: [{ id: 'inst-1', name: 'ICM' }]
  });

  assert.match(html, /Alice Applicant/);
  assert.match(html, /alice@example.org/);
  assert.match(html, /Postdoc/);
  assert.match(html, /Systems/);
  assert.match(html, /Looking in fields: Human/);
  assert.match(html, /20 Mar 2026/);
});
