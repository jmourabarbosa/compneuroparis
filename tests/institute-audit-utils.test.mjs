import test from 'node:test';
import assert from 'node:assert/strict';

import { auditInstituteLinks, summarizeInstituteLinkAudit } from '../js/institute-audit-utils.mjs';

test('auditInstituteLinks detects clean records, updates, and unresolved mappings', () => {
  const institutes = [{ id: 'inst-1', name: 'NeuroSpin (CEA)' }];

  assert.equal(
    auditInstituteLinks({ instituteIds: ['inst-1'], institutes: ['NeuroSpin (CEA)'], institute: 'NeuroSpin (CEA)' }, institutes).needsUpdate,
    false
  );

  assert.equal(
    auditInstituteLinks({ institutes: ['NeuroSpin'], institute: 'NeuroSpin' }, institutes).needsUpdate,
    true
  );

  assert.equal(
    auditInstituteLinks({ institutes: ['Unknown Institute'] }, institutes).unresolved.length,
    1
  );
});

test('summarizeInstituteLinkAudit classifies record sets', () => {
  const institutes = [{ id: 'inst-1', name: 'NeuroSpin (CEA)' }];
  const summary = summarizeInstituteLinkAudit([
    { instituteIds: ['inst-1'], institutes: ['NeuroSpin (CEA)'], institute: 'NeuroSpin (CEA)' },
    { institutes: ['NeuroSpin'] },
    { institutes: ['Unknown Institute'] },
    {}
  ], institutes);

  assert.deepEqual(summary, {
    total: 4,
    noLinks: 1,
    clean: 1,
    needsUpdate: 1,
    unresolved: 1
  });
});
