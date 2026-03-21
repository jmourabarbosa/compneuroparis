import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { filterVisibleGroups } from '../js/group-filter-utils.mjs';
import { buildApprovedGroupData } from '../js/ownership-utils.mjs';

const require = createRequire(import.meta.url);
const { planClaimReconciliation } = require('../functions/ownership-logic.js');
const { planGroupClaimChange } = require('../functions/group-claim-logic.js');

test('submission approval workflow creates a claimed PI that is immediately visible in validated institute filters', () => {
  const approvedGroup = {
    id: 'pi-1',
    ...buildApprovedGroupData({
      name: 'German Sumbre',
      summary: 'Studies cortical dynamics.',
      keywords: ['systems'],
      instituteIds: ['inst-neurospin'],
      institutes: ['NeuroSpin (CEA)'],
      submitterEmail: 'german@example.org',
      submitterIsPi: true,
      creatorUid: 'user-german'
    })
  };

  const institutes = [{ id: 'inst-neurospin', name: 'NeuroSpin (CEA)' }];

  assert.deepEqual(
    filterVisibleGroups({
      groups: [approvedGroup],
      institutes,
      activeInstituteId: 'inst-neurospin',
      filterValidated: true
    }).map(group => group.id),
    ['pi-1']
  );
});

test('third-party submission approval leaves the PI unclaimed and out of validated filters', () => {
  const approvedGroup = {
    id: 'pi-1',
    ...buildApprovedGroupData({
      name: 'German Sumbre',
      summary: 'Studies cortical dynamics.',
      keywords: ['systems'],
      instituteIds: ['inst-neurospin'],
      institutes: ['NeuroSpin (CEA)'],
      submitterEmail: 'colleague@example.org',
      submitterIsPi: false,
      creatorUid: 'user-colleague'
    })
  };

  const institutes = [{ id: 'inst-neurospin', name: 'NeuroSpin (CEA)' }];

  assert.deepEqual(
    filterVisibleGroups({
      groups: [approvedGroup],
      institutes,
      activeInstituteId: 'inst-neurospin',
      filterValidated: true
    }).map(group => group.id),
    []
  );
  assert.equal(approvedGroup.claimedBy, undefined);
});

test('admin reassignment workflow promotes matching pending claim and suppresses duplicate ownership email', () => {
  const reconciliation = planClaimReconciliation([
    { id: 'approved-old', status: 'approved', claimantUid: 'user-old' },
    { id: 'pending-new', status: 'pending', claimantUid: 'user-new' },
    { id: 'pending-other', status: 'pending', claimantUid: 'user-other' }
  ], 'user-new');

  const claimPlan = planGroupClaimChange(
    { name: 'German Sumbre', claimedBy: 'user-old' },
    { uid: 'user-new', email: 'new@example.org' },
    reconciliation.promotedPendingClaim
  );

  assert.equal(reconciliation.promotedPendingClaim, true);
  assert.deepEqual(reconciliation.updates, [
    { id: 'approved-old', status: 'revoked', timestampField: 'revokedAt' },
    { id: 'pending-new', status: 'approved', timestampField: 'reviewedAt' },
    { id: 'pending-other', status: 'rejected', timestampField: 'reviewedAt' }
  ]);
  assert.equal(claimPlan.mode, 'assign');
  assert.equal(claimPlan.nextClaimedBy, 'user-new');
  assert.equal(claimPlan.shouldNotifyClaimant, false);
});

test('admin clearing workflow revokes approved claims, rejects pending claims, and leaves the page unclaimed', () => {
  const reconciliation = planClaimReconciliation([
    { id: 'approved-old', status: 'approved', claimantUid: 'user-old' },
    { id: 'pending-other', status: 'pending', claimantUid: 'user-other' }
  ], null);

  const claimPlan = planGroupClaimChange(
    { name: 'German Sumbre', claimedBy: 'user-old' },
    null,
    reconciliation.promotedPendingClaim
  );

  assert.equal(reconciliation.promotedPendingClaim, false);
  assert.deepEqual(reconciliation.updates, [
    { id: 'approved-old', status: 'revoked', timestampField: 'revokedAt' },
    { id: 'pending-other', status: 'rejected', timestampField: 'reviewedAt' }
  ]);
  assert.equal(claimPlan.mode, 'clear');
  assert.equal(claimPlan.nextClaimedBy, null);
  assert.equal(claimPlan.shouldNotifyClaimant, false);
});
