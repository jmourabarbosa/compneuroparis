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

test('resolveInstituteRefsFromRecord matches legacy institute names when a canonical institute exists', () => {
  const record = {
    institutes: ['ISIR - Sorbonne Universite']
  };
  const institutes = [{ id: 'inst-1', name: 'ISIR - Sorbonne Université' }];

  assert.deepEqual(resolveInstituteRefsFromRecord(record, institutes), [
    { id: 'inst-1', name: 'ISIR - Sorbonne Université' }
  ]);
});

test('resolveInstituteRefsFromRecord ignores unmatched legacy institute names', () => {
  const record = {
    institutes: ['NeuroSpin']
  };
  const institutes = [{ id: 'inst-1', name: 'NeuroSpin (CEA)' }];

  assert.deepEqual(resolveInstituteRefsFromRecord(record, institutes), []);
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

test('getInstituteDisplayNames resolves legacy single institute field', () => {
  const record = {
    institute: 'Institut du Cerveau'
  };
  const institutes = [{ id: 'inst-1', name: 'Institut du Cerveau' }];

  assert.deepEqual(getInstituteDisplayNames(record, institutes), ['Institut du Cerveau']);
});
