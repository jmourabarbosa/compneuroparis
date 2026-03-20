import test from 'node:test';
import assert from 'node:assert/strict';

import { filterVisibleJobs, getCombinedJobKeywords } from '../js/job-filter-utils.mjs';

test('filterVisibleJobs returns all jobs when there is no search text', () => {
  const jobs = [{ id: 'job-1' }, { id: 'job-2' }];
  assert.deepEqual(filterVisibleJobs({ jobs }), jobs);
});

test('filterVisibleJobs searches across job fields and PI keywords', () => {
  const jobs = [
    { id: 'job-1', piId: 'pi-1', piName: 'Alice Example', title: 'Postdoc', positionType: 'Postdoc', keywords: ['vision'] },
    { id: 'job-2', piId: 'pi-2', piName: 'Bob Example', title: 'PhD Student', positionType: 'PhD', keywords: ['imaging'] }
  ];
  const groups = [
    { id: 'pi-1', keywords: ['dynamics'] },
    { id: 'pi-2', keywords: ['memory'] }
  ];

  assert.deepEqual(filterVisibleJobs({ jobs, groups, searchText: 'dynamics' }).map(job => job.id), ['job-1']);
  assert.deepEqual(filterVisibleJobs({ jobs, groups, searchText: 'phd' }).map(job => job.id), ['job-2']);
});

test('getCombinedJobKeywords deduplicates keywords case-insensitively while keeping PI keywords first', () => {
  const job = {
    piId: 'pi-1',
    keywords: ['Vision', 'electrophysiology']
  };
  const groups = [{
    id: 'pi-1',
    keywords: ['vision', 'systems']
  }];

  assert.deepEqual(getCombinedJobKeywords(job, groups), ['vision', 'systems', 'electrophysiology']);
});
