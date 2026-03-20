import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildClaimedByUpdate,
  getClaimTargetCollection,
  getClaimTargetId,
  getClaimTargetName
} from '../js/claim-record-utils.mjs';

test('claim record helpers support legacy and current claim fields', () => {
  assert.equal(getClaimTargetId({ targetId: 'pi-1' }), 'pi-1');
  assert.equal(getClaimTargetId({ piId: 'legacy-pi' }), 'legacy-pi');
  assert.equal(getClaimTargetName({ targetName: 'Alice' }), 'Alice');
  assert.equal(getClaimTargetName({ piName: 'Legacy Alice' }), 'Legacy Alice');
});

test('getClaimTargetCollection maps institutes separately from PI groups', () => {
  assert.equal(getClaimTargetCollection('pi'), 'groups');
  assert.equal(getClaimTargetCollection('institute'), 'institutes');
});

test('buildClaimedByUpdate normalizes claimant email presence', () => {
  assert.deepEqual(buildClaimedByUpdate({ claimantUid: 'user-1', claimantEmail: 'alice@example.org' }), {
    claimedBy: 'user-1',
    claimedByEmail: 'alice@example.org'
  });
  assert.deepEqual(buildClaimedByUpdate({ claimantUid: 'user-2' }), {
    claimedBy: 'user-2',
    claimedByEmail: ''
  });
});
