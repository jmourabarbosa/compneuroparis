import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPublicDetailHash,
  buildPublicJobPageUrl,
  parsePublicDetailHash,
  parsePublicJobPageId
} from '../js/public-detail-hash-utils.mjs';

test('buildPublicDetailHash builds deep-link hashes for public detail modals', () => {
  assert.equal(buildPublicDetailHash('pi', 'abc123'), '#pi-abc123');
  assert.equal(buildPublicDetailHash('inst', 'inst-1'), '#inst-inst-1');
  assert.equal(buildPublicDetailHash('job', 'job-9'), '#job-job-9');
});

test('parsePublicDetailHash parses PI, institute, and job deep links', () => {
  assert.deepEqual(parsePublicDetailHash('#pi-abc123'), { type: 'pi', id: 'abc123' });
  assert.deepEqual(parsePublicDetailHash('#inst-inst-1'), { type: 'inst', id: 'inst-1' });
  assert.deepEqual(parsePublicDetailHash('#job-job-9'), { type: 'job', id: 'job-9' });
});

test('parsePublicDetailHash ignores unsupported hashes', () => {
  assert.equal(parsePublicDetailHash(''), null);
  assert.equal(parsePublicDetailHash('#admin'), null);
  assert.equal(parsePublicDetailHash('#job-'), null);
  assert.equal(parsePublicDetailHash('#jobs'), null);
  assert.equal(parsePublicDetailHash('#foo-123'), null);
});

test('buildPublicJobPageUrl and parsePublicJobPageId round-trip standalone job page URLs', () => {
  assert.equal(buildPublicJobPageUrl('job-9'), 'job.html?id=job-9');
  assert.equal(buildPublicJobPageUrl('job with spaces'), 'job.html?id=job%20with%20spaces');
  assert.equal(parsePublicJobPageId('?id=job-9'), 'job-9');
  assert.equal(parsePublicJobPageId('?id=job%20with%20spaces'), 'job with spaces');
  assert.equal(parsePublicJobPageId(''), '');
});
