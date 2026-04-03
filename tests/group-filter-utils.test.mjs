import test from 'node:test';
import assert from 'node:assert/strict';

import {
  editDistance,
  filterVisibleGroups,
  fuzzyMatch,
  partitionGroupsBySubfield,
  sortGroupsForDisplay
} from '../js/group-filter-utils.mjs';

test('editDistance and fuzzyMatch tolerate small typos but not short unrelated terms', () => {
  assert.equal(editDistance('neurospin', 'neurospn'), 1);
  assert.equal(fuzzyMatch('German Sumbre NeuroSpin', 'neurospn'), true);
  assert.equal(fuzzyMatch('German Sumbre NeuroSpin', 'ens'), false);
});

test('filterVisibleGroups matches institutes only by stable ID', () => {
  const groups = [
    { id: 'pi-1', name: 'German Sumbre', instituteIds: ['inst-1'], institutes: ['NeuroSpin'] },
    { id: 'pi-2', name: 'Other PI', instituteIds: ['inst-2'], institutes: ['ICM'] }
  ];
  const institutes = [
    { id: 'inst-1', name: 'NeuroSpin (CEA)' },
    { id: 'inst-2', name: 'ICM' }
  ];

  assert.deepEqual(
    filterVisibleGroups({ groups, institutes, activeInstituteId: 'inst-1' }).map(group => group.id),
    ['pi-1']
  );
});

test('filterVisibleGroups matches legacy name-only institute records through canonical IDs', () => {
  const groups = [
    { id: 'pi-1', name: 'Legacy PI', institutes: ['ISIR - Sorbonne Universite'] }
  ];
  const institutes = [
    { id: 'inst-1', name: 'ISIR - Sorbonne Université' }
  ];

  assert.deepEqual(
    filterVisibleGroups({ groups, institutes, activeInstituteId: 'inst-1' }).map(group => group.id),
    ['pi-1']
  );
});

test('filterVisibleGroups requires all active keywords and respects hiring and validation filters', () => {
  const groups = [
    {
      id: 'pi-1',
      name: 'Claimed Hiring PI',
      keywords: ['vision', 'fMRI'],
      claimedBy: 'user-1'
    },
    {
      id: 'pi-2',
      name: 'Unclaimed PI',
      keywords: ['vision']
    }
  ];
  const jobs = [{ piId: 'pi-1' }];

  assert.deepEqual(
    filterVisibleGroups({
      groups,
      jobs,
      activeKeywords: new Set(['vision', 'fmri']),
      filterHiring: true,
      filterValidated: true
    }).map(group => group.id),
    ['pi-1']
  );
});

test('filterVisibleGroups searches across summary, keywords, and institute names', () => {
  const groups = [
    {
      id: 'pi-1',
      name: 'Alice Example',
      summary: 'Studies large-scale cortical dynamics',
      keywords: ['vision'],
      instituteIds: ['inst-1']
    }
  ];
  const institutes = [{ id: 'inst-1', name: 'ICM' }];

  assert.deepEqual(
    filterVisibleGroups({ groups, institutes, searchText: 'corticl ICM' }).map(group => group.id),
    ['pi-1']
  );
});

test('partitionGroupsBySubfield keeps claimed groups first and defaults missing subfields to computational', () => {
  const groups = [
    { id: 'pi-2', name: 'Beta Lab', subfields: ['systems'] },
    { id: 'pi-1', name: 'Alpha Lab', subfields: ['systems', 'human'], claimedBy: 'user-1' },
    { id: 'pi-3', name: 'Gamma Lab' }
  ];

  const { primaryBySubfield, secondaryBySubfield } = partitionGroupsBySubfield(groups, [
    'computational',
    'systems',
    'human'
  ]);

  assert.deepEqual(primaryBySubfield.systems.map(group => group.id), ['pi-1', 'pi-2']);
  assert.deepEqual(secondaryBySubfield.human.map(group => group.id), ['pi-1']);
  assert.deepEqual(primaryBySubfield.computational.map(group => group.id), ['pi-3']);
});

test('sortGroupsForDisplay prioritizes claimed groups before alphabetical ordering', () => {
  const groups = [
    { id: 'pi-2', name: 'Beta Lab' },
    { id: 'pi-3', name: 'Gamma Lab', claimedBy: 'user-2' },
    { id: 'pi-1', name: 'Alpha Lab', claimedBy: 'user-1' }
  ];

  assert.deepEqual(sortGroupsForDisplay(groups).map(group => group.id), ['pi-1', 'pi-3', 'pi-2']);
});
