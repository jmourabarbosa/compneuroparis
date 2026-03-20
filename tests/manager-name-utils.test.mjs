import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveManagerNameFromEmail,
  getClaimManagerName,
  getPreferredUserName
} from '../js/manager-name-utils.mjs';

test('deriveManagerNameFromEmail formats email local parts into readable names', () => {
  assert.equal(deriveManagerNameFromEmail('joao.barbosa@example.org'), 'Joao Barbosa');
  assert.equal(deriveManagerNameFromEmail('marie_curie-lab@example.org'), 'Marie Curie Lab');
});

test('getClaimManagerName prefers stored name and falls back to email-derived names', () => {
  assert.equal(getClaimManagerName({ claimedByName: 'Philippe Domenech', claimedByEmail: 'ignored@example.org' }), 'Philippe Domenech');
  assert.equal(getClaimManagerName({ claimedByEmail: 'alice.smith@example.org' }), 'Alice Smith');
  assert.equal(getClaimManagerName({}, 'PI'), 'PI');
});

test('getPreferredUserName uses display name before deriving from email', () => {
  assert.equal(getPreferredUserName({ displayName: 'Ada Lovelace', email: 'ada@example.org' }), 'Ada Lovelace');
  assert.equal(getPreferredUserName({ displayName: '', email: 'grace.hopper@example.org' }), 'Grace Hopper');
});
