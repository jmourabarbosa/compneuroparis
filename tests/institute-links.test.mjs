import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInstituteFieldData,
  getInstituteDisplayNames,
  resolveLegacyInstituteRefsFromRecord,
  resolveInstituteRefsFromRecord
} from '../js/institute-links.mjs';

test('resolveInstituteRefsFromRecord preserves ID links and refreshes names from institute docs', () => {
  const record = {
    instituteIds: ['inst-1'],
    institutes: ['Old Name']
  };
  const institutes = [{ id: 'inst-1', name: 'NeuroSpin (CEA)' }];

  assert.deepEqual(resolveInstituteRefsFromRecord(record, institutes), [
    { id: 'inst-1', name: 'NeuroSpin (CEA)' }
  ]);
});

test('resolveInstituteRefsFromRecord ignores legacy institute names without IDs', () => {
  const record = {
    institutes: ['NeuroSpin']
  };
  const institutes = [{ id: 'inst-1', name: 'NeuroSpin (CEA)' }];

  assert.deepEqual(resolveInstituteRefsFromRecord(record, institutes), []);
});

test('resolveLegacyInstituteRefsFromRecord maps legacy institute names to matching IDs for migration', () => {
  const record = {
    institutes: ['NeuroSpin']
  };
  const institutes = [{ id: 'inst-1', name: 'NeuroSpin (CEA)' }];

  assert.deepEqual(resolveLegacyInstituteRefsFromRecord(record, institutes), [
    { id: 'inst-1', name: 'NeuroSpin (CEA)' }
  ]);
});

test('buildInstituteFieldData stores only stable IDs', () => {
  assert.deepEqual(buildInstituteFieldData([
    { id: 'inst-1', name: 'ICM' },
    { id: 'inst-2', name: 'ENS' }
  ]), {
    instituteIds: ['inst-1', 'inst-2']
  });
});

test('getInstituteDisplayNames omits missing institute IDs', () => {
  const record = {
    instituteIds: ['missing-id'],
    institutes: ['Legacy Name']
  };

  assert.deepEqual(getInstituteDisplayNames(record, []), []);
});
