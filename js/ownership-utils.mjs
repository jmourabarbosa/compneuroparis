import { toArray } from './institute-links.mjs';

export function shouldLinkSubmitterToApprovedProfile(submissionData = {}) {
  const data = submissionData || {};
  return Boolean(data.creatorUid) && data.submitterIsPi !== false;
}

export function buildApprovedGroupData(submissionData = {}, overrideData = null) {
  const data = submissionData || {};
  const src = overrideData || data;

  const subfields = toArray(src.subfields || src.subfield || data.subfields || data.subfield || ['computational']);
  const instituteIds = toArray(src.instituteIds || data.instituteIds);
  const shouldLinkSubmitter = shouldLinkSubmitterToApprovedProfile(data);

  return {
    name: src.name,
    keywords: src.keywords || [],
    summary: src.summary || '',
    links: src.links || [],
    photoURL: src.photoURL || '',
    subfields,
    instituteIds,
    subfield: subfields[0] || 'computational',
    ...(shouldLinkSubmitter ? {
      creatorUid: data.creatorUid,
      claimedBy: data.creatorUid,
      claimedByEmail: data.submitterEmail || '',
      claimedByName: data.submitterName || ''
    } : {})
  };
}
