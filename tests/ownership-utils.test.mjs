import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApprovedGroupData } from '../js/ownership-utils.mjs';

test('buildApprovedGroupData auto-claims approved user submissions', () => {
  const submission = {
    name: 'Alice Example',
    keywords: ['vision'],
    summary: 'Studies perception.',
    links: [{ label: 'Website', url: 'https://example.com' }],
    photoURL: 'https://example.com/photo.jpg',
    subfield: 'human',
    instituteIds: ['inst-1'],
    institute: 'ICM',
    submitterEmail: 'alice@example.edu',
    creatorUid: 'user-123'
  };

  assert.deepEqual(buildApprovedGroupData(submission), {
    name: 'Alice Example',
    keywords: ['vision'],
    summary: 'Studies perception.',
    links: [{ label: 'Website', url: 'https://example.com' }],
    photoURL: 'https://example.com/photo.jpg',
    subfields: ['human'],
    instituteIds: ['inst-1'],
    subfield: 'human',
    creatorUid: 'user-123',
    claimedBy: 'user-123',
    claimedByEmail: 'alice@example.edu',
    claimedByName: ''
  });
});

test('buildApprovedGroupData preserves override fields but keeps ownership from submission creator', () => {
  const submission = {
    name: 'Alice Example',
    subfields: ['systems'],
    instituteIds: ['inst-original'],
    institutes: ['Original Institute'],
    submitterEmail: 'alice@example.edu',
    creatorUid: 'user-123'
  };

  const override = {
    name: 'Alice Example, PhD',
    summary: 'Updated by admin review.',
    subfields: ['computational', 'systems'],
    instituteIds: ['inst-reviewed'],
    institutes: ['Reviewed Institute']
  };

  assert.deepEqual(buildApprovedGroupData(submission, override), {
    name: 'Alice Example, PhD',
    keywords: [],
    summary: 'Updated by admin review.',
    links: [],
    photoURL: '',
    subfields: ['computational', 'systems'],
    instituteIds: ['inst-reviewed'],
    subfield: 'computational',
    creatorUid: 'user-123',
    claimedBy: 'user-123',
    claimedByEmail: 'alice@example.edu',
    claimedByName: ''
  });
});

test('buildApprovedGroupData leaves admin-created pages unclaimed when there is no creatorUid', () => {
  const submission = {
    name: 'Admin Added PI',
    subfields: ['clinical'],
    instituteIds: ['inst-hospital'],
    institutes: ['Hospital']
  };

  assert.deepEqual(buildApprovedGroupData(submission), {
    name: 'Admin Added PI',
    keywords: [],
    summary: '',
    links: [],
    photoURL: '',
    subfields: ['clinical'],
    instituteIds: ['inst-hospital'],
    subfield: 'clinical',
  });
});
