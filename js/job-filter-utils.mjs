export function filterVisibleJobs({ jobs = [], groups = [], searchText = '' }) {
  if (!searchText) return jobs;

  return jobs.filter(job => {
    const piGroup = groups.find(group => group.id === job.piId);
    const piKeywords = piGroup ? (piGroup.keywords || []) : [];
    const haystack = [
      job.piName || '',
      job.title || '',
      job.positionType || '',
      ...(job.keywords || []),
      ...piKeywords
    ].join(' ').toLowerCase();

    return haystack.includes(searchText);
  });
}

export function getCombinedJobKeywords(job = {}, groups = []) {
  const piGroup = groups.find(group => group.id === job.piId);
  const piKeywords = piGroup ? (piGroup.keywords || []) : [];
  const piKeywordSet = new Set(piKeywords.map(keyword => keyword.toLowerCase()));

  return [
    ...piKeywords,
    ...(job.keywords || []).filter(keyword => !piKeywordSet.has(keyword.toLowerCase()))
  ];
}

export function filterVisibleJobApplicants({ applicants = [], institutes = [], searchText = '' }) {
  if (!searchText) return applicants;

  return applicants.filter(applicant => {
    const instituteNames = (applicant.instituteIds || [])
      .map(id => institutes.find(inst => inst.id === id)?.name || '')
      .filter(Boolean);
    const haystack = [
      applicant.name || '',
      applicant.email || '',
      applicant.summary || '',
      applicant.notes || '',
      applicant.link || '',
      ...(applicant.lookingFor || []),
      ...(applicant.subfields || []),
      ...(applicant.targetSubfields || []),
      ...instituteNames
    ].join(' ').toLowerCase();

    return haystack.includes(searchText);
  });
}
