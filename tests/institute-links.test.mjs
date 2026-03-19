import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInstituteFieldData,
  getInstituteDisplayNames,
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

test('resolveInstituteRefsFromRecord maps legacy institute names to matching IDs', () => {
  const record = {
    institutes: ['NeuroSpin']
  };
  const institutes = [{ id: 'inst-1', name: 'NeuroSpin (CEA)' }];

  assert.deepEqual(resolveInstituteRefsFromRecord(record, institutes), [
    { id: 'inst-1', name: 'NeuroSpin (CEA)' }
  ]);
});

test('buildInstituteFieldData keeps names for display while storing stable IDs', () => {
  assert.deepEqual(buildInstituteFieldData([
    { id: 'inst-1', name: 'ICM' },
    { id: 'inst-2', name: 'ENS' }
  ]), {
    instituteIds: ['inst-1', 'inst-2'],
    institutes: ['ICM', 'ENS'],
    institute: 'ICM'
  });
});

test('getInstituteDisplayNames falls back to stored names when an ID cannot be resolved', () => {
  const record = {
    instituteIds: ['missing-id'],
    institutes: ['Legacy Name']
  };

  assert.deepEqual(getInstituteDisplayNames(record, []), ['Legacy Name']);
});
