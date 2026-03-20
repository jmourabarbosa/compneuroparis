import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildClaimantOptionData,
  buildInstitutePillsMarkup,
  buildManageGroupItemMarkup,
  buildUserAdminItemMarkup,
  filterManageGroups,
  filterUsers,
  getClaimSectionSummary
} from '../js/admin-utils.mjs';

test('filterManageGroups searches name, keywords, subfields, and claimant email', () => {
  const groups = [
    { name: 'Alice Example', keywords: ['vision'], subfields: ['systems'], claimedByEmail: 'alice@example.org' },
    { name: 'Bob Example', keywords: ['memory'], subfield: 'human' }
  ];

  assert.equal(filterManageGroups(groups, 'systems').length, 1);
  assert.equal(filterManageGroups(groups, 'alice@example').length, 1);
  assert.equal(filterManageGroups(groups, 'missing').length, 0);
});

test('claimant helpers summarize state and include missing users', () => {
  assert.equal(getClaimSectionSummary({}), 'Currently unclaimed.');
  assert.equal(getClaimSectionSummary({ claimedBy: 'u1', claimedByEmail: 'a@example.org' }), 'Currently claimed by a@example.org.');

  assert.deepEqual(
    buildClaimantOptionData([{ uid: 'u1', email: 'a@example.org', displayName: '', emailVerified: true }], { claimedBy: 'u2', claimedByEmail: 'missing@example.org' }),
    [
      { value: '', label: 'Unclaimed' },
      { value: 'u1', label: 'a@example.org' },
      { value: 'u2', label: 'missing@example.org (account not found)' }
    ]
  );
});

test('admin item markup builders include expected labels', () => {
  assert.match(buildManageGroupItemMarkup({ name: 'Alice', keywords: ['vision'], subfields: ['systems'], claimedBy: 'u1' }), /Alice/);
  assert.match(buildInstitutePillsMarkup([{ id: 'inst-1', name: 'ICM' }]), /ICM/);
  assert.match(buildUserAdminItemMarkup({ uid: 'u1', email: 'a@example.org', displayName: 'Alice', createdAt: '', disabled: false, emailVerified: false }), /Verify/);
});

test('filterUsers searches email, display name, and uid', () => {
  const users = [
    { uid: 'u1', email: 'a@example.org', displayName: 'Alice' },
    { uid: 'u2', email: 'b@example.org', displayName: 'Bob' }
  ];
  assert.equal(filterUsers(users, 'alice').length, 1);
  assert.equal(filterUsers(users, 'u2').length, 1);
});
