import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInstituteRenameUpdate, getRecordInstituteNames } from '../js/institute-record-utils.mjs';

test('getRecordInstituteNames prefers array values and falls back to legacy single institute', () => {
  assert.deepEqual(getRecordInstituteNames({ institutes: ['ICM', 'ENS'], institute: 'Ignored' }), ['ICM', 'ENS']);
  assert.deepEqual(getRecordInstituteNames({ institute: 'NeuroSpin' }), ['NeuroSpin']);
});

test('buildInstituteRenameUpdate refreshes both single and multiple institute fields', () => {
  assert.deepEqual(
    buildInstituteRenameUpdate(
      { institute: 'NeuroSpin', institutes: ['NeuroSpin', 'ICM'] },
      'NeuroSpin',
      'NeuroSpin (CEA)'
    ),
    {
      institute: 'NeuroSpin (CEA)',
      institutes: ['NeuroSpin (CEA)', 'ICM']
    }
  );
});

test('buildInstituteRenameUpdate upgrades legacy single-institute records consistently', () => {
  assert.deepEqual(
    buildInstituteRenameUpdate(
      { institute: 'NeuroSpin' },
      'NeuroSpin',
      'NeuroSpin (CEA)'
    ),
    {
      institute: 'NeuroSpin (CEA)',
      institutes: ['NeuroSpin (CEA)']
    }
  );
});

test('buildInstituteRenameUpdate returns null when the record is unrelated or unchanged', () => {
  assert.equal(buildInstituteRenameUpdate({ institute: 'ICM' }, 'NeuroSpin', 'NeuroSpin (CEA)'), null);
  assert.equal(buildInstituteRenameUpdate({ institute: 'NeuroSpin' }, 'NeuroSpin', 'NeuroSpin'), null);
});
