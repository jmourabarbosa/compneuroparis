export function getNormalizedGroupKeywords(group = {}, cache = new WeakMap()) {
  const cached = cache.get(group);
  if (cached) return cached;

  const normalizedKeywords = (group.keywords || [])
    .map(keyword => keyword.trim().toLowerCase())
    .filter(Boolean);

  cache.set(group, normalizedKeywords);
  return normalizedKeywords;
}

export function buildKeywordCounts(groups = [], cache = new WeakMap()) {
  const counts = new Map();

  groups.forEach(group => {
    getNormalizedGroupKeywords(group, cache).forEach(keyword => {
      counts.set(keyword, (counts.get(keyword) || 0) + 1);
    });
  });

  return counts;
}

export function getMatchingKeywords(
  keywordCounts = new Map(),
  searchText = '',
  fuzzyMatcher = () => false,
  cache = new Map()
) {
  const matchingKeywords = [];

  keywordCounts.forEach((count, keyword) => {
    const cacheKey = `${searchText}\u0000${keyword}`;
    let isMatch = cache.get(cacheKey);

    if (isMatch === undefined) {
      isMatch = fuzzyMatcher(keyword, searchText);
      cache.set(cacheKey, isMatch);
    }

    if (isMatch) matchingKeywords.push(keyword);
  });

  return matchingKeywords.sort((a, b) => keywordCounts.get(b) - keywordCounts.get(a));
}
