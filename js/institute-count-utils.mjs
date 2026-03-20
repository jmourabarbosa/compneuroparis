import { normalizeInstituteName, resolveInstituteRefsFromRecord } from './institute-links.mjs';

function getInstituteCountKey(ref = {}) {
  if (ref.id) return `id:${ref.id}`;
  if (ref.name) return `name:${normalizeInstituteName(ref.name)}`;
  return '';
}

export function buildInstitutePiCountMap(groups = [], institutes = []) {
  const counts = new Map();

  groups.forEach(group => {
    const refs = resolveInstituteRefsFromRecord(group, institutes);
    const seenKeys = new Set();

    refs.forEach(ref => {
      const key = getInstituteCountKey(ref);
      if (!key || seenKeys.has(key)) return;
      seenKeys.add(key);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });

  return counts;
}

export function getInstitutePiCount(institute = {}, countMap = new Map()) {
  const idKey = institute.id ? `id:${institute.id}` : '';
  if (idKey && countMap.has(idKey)) {
    return countMap.get(idKey);
  }

  const nameKey = institute.name ? `name:${normalizeInstituteName(institute.name)}` : '';
  if (nameKey && countMap.has(nameKey)) {
    return countMap.get(nameKey);
  }

  return 0;
}
