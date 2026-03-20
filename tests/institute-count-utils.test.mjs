import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInstitutePiCountMap, getInstitutePiCount } from '../js/institute-count-utils.mjs';

test('buildInstitutePiCountMap counts PI links by institute id and deduplicates within a PI', () => {
  const institutes = [
    { id: 'inst-1', name: 'NeuroSpin (CEA)' },
    { id: 'inst-2', name: 'ICM' }
  ];
  const groups = [
    { instituteIds: ['inst-1', 'inst-1'], institutes: ['NeuroSpin (CEA)'] },
    { instituteIds: ['inst-2'], institutes: ['ICM'] },
    { instituteIds: ['inst-1', 'inst-2'], institutes: ['NeuroSpin (CEA)', 'ICM'] }
  ];

  const countMap = buildInstitutePiCountMap(groups, institutes);

  assert.equal(getInstitutePiCount(institutes[0], countMap), 2);
  assert.equal(getInstitutePiCount(institutes[1], countMap), 2);
});

test('buildInstitutePiCountMap falls back through legacy-compatible institute names', () => {
  const institutes = [{ id: 'inst-1', name: 'NeuroSpin (CEA)' }];
  const groups = [
    { institutes: ['NeuroSpin'] },
    { institutes: ['NeuroSpin (CEA)'] }
  ];

  const countMap = buildInstitutePiCountMap(groups, institutes);

  assert.equal(getInstitutePiCount(institutes[0], countMap), 2);
});
