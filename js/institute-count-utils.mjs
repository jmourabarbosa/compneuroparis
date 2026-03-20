import { resolveInstituteRefsFromRecord } from './institute-links.mjs';

export function buildInstitutePiCountMap(groups = [], institutes = []) {
  const counts = new Map();

  groups.forEach(group => {
    const refs = resolveInstituteRefsFromRecord(group, institutes);
    const seenKeys = new Set();

    refs.forEach(ref => {
      const key = ref.id || '';
      if (!key || seenKeys.has(key)) return;
      seenKeys.add(key);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });

  return counts;
}

export function getInstitutePiCount(institute = {}, countMap = new Map()) {
  return institute.id ? (countMap.get(institute.id) || 0) : 0;
}
