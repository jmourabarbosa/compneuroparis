import { getInstituteDisplayNames, instituteNamesMatch, toArray } from './institute-links.mjs';

export function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

export function fuzzyMatch(haystack, query) {
  const haystackLower = haystack.toLowerCase();
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return true;

  const haystackWords = haystackLower.split(/\s+/).filter(Boolean);

  return queryWords.every(qw => {
    if (haystackLower.includes(qw)) return true;
    if (qw.length < 4) return false;

    return haystackWords.some(hw => {
      if (Math.abs(hw.length - qw.length) > 2) return false;
      return editDistance(qw, hw) <= 2;
    });
  });
}

export function filterVisibleGroups({
  groups = [],
  institutes = [],
  jobs = [],
  activeKeywords = new Set(),
  searchText = '',
  activeInstituteId = null,
  activeInstituteName = '',
  filterHiring = false,
  filterValidated = false
}) {
  return groups.filter(group => {
    if (activeInstituteId || activeInstituteName) {
      const instituteIds = toArray(group.instituteIds);
      const instituteNames = getInstituteDisplayNames(group, institutes);
      const matchesId = activeInstituteId && instituteIds.includes(activeInstituteId);
      const matchesName = activeInstituteName && instituteNames.some(name => instituteNamesMatch(name, activeInstituteName));
      if (!matchesId && !matchesName) return false;
    }

    if (activeKeywords.size > 0) {
      const keywords = (group.keywords || []).map(keyword => keyword.trim().toLowerCase());
      for (const activeKeyword of activeKeywords) {
        if (!keywords.includes(activeKeyword)) return false;
      }
    }

    if (searchText) {
      const haystack = [
        group.name,
        group.summary,
        ...(group.keywords || []),
        ...getInstituteDisplayNames(group, institutes)
      ].join(' ');

      if (!fuzzyMatch(haystack, searchText)) return false;
    }

    if (filterHiring) {
      const isHiring = group.hiring || jobs.some(job => job.piId === group.id);
      if (!isHiring) return false;
    }

    if (filterValidated && !group.claimedBy) {
      return false;
    }

    return true;
  });
}

export function sortGroupsForDisplay(groups = []) {
  return [...groups].sort((a, b) => {
    const aClaimed = a.claimedBy ? 0 : 1;
    const bClaimed = b.claimedBy ? 0 : 1;
    if (aClaimed !== bClaimed) return aClaimed - bClaimed;
    return (a.name || '').localeCompare(b.name || '');
  });
}

export function partitionGroupsBySubfield(groups = [], subfields = []) {
  const primaryBySubfield = Object.fromEntries(subfields.map(subfield => [subfield, []]));
  const secondaryBySubfield = Object.fromEntries(subfields.map(subfield => [subfield, []]));

  groups.forEach(group => {
    const groupSubfields = toArray(group.subfields || group.subfield);
    const validSubfields = groupSubfields.filter(subfield => primaryBySubfield[subfield]);
    if (validSubfields.length === 0 && primaryBySubfield.computational) {
      validSubfields.push('computational');
    }

    validSubfields.forEach((subfield, index) => {
      if (index === 0 || subfield === groupSubfields[0]) {
        primaryBySubfield[subfield].push(group);
      } else {
        secondaryBySubfield[subfield].push(group);
      }
    });
  });

  for (const subfield of subfields) {
    primaryBySubfield[subfield] = sortGroupsForDisplay(primaryBySubfield[subfield]);
    secondaryBySubfield[subfield] = sortGroupsForDisplay(secondaryBySubfield[subfield]);
  }

  return { primaryBySubfield, secondaryBySubfield };
}
