function toArray(value) {
  return Array.isArray(value) ? value : (value ? [value] : []);
}

export function buildApprovedGroupData(submissionData = {}, overrideData = null) {
  const data = submissionData || {};
  const src = overrideData || data;

  const subfields = toArray(src.subfields || src.subfield || data.subfields || data.subfield || ['computational']);
  const institutes = toArray(src.institutes || src.institute || data.institutes || data.institute);

  return {
    name: src.name,
    keywords: src.keywords || [],
    summary: src.summary || '',
    links: src.links || [],
    photoURL: src.photoURL || '',
    subfields,
    institutes,
    subfield: subfields[0] || 'computational',
    institute: institutes[0] || '',
    ...(data.creatorUid ? {
      creatorUid: data.creatorUid,
      claimedBy: data.creatorUid,
      claimedByEmail: data.submitterEmail || ''
    } : {})
  };
}
