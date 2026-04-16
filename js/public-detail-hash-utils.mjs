export function buildPublicDetailHash(type, id) {
  if (!type || !id) return '';
  return `#${type}-${id}`;
}

export function parsePublicDetailHash(hash = '') {
  const normalizedHash = String(hash || '').trim();
  const match = normalizedHash.match(/^#(pi|inst|job)-(.+)$/);
  if (!match) return null;

  const [, type, id] = match;
  return id ? { type, id } : null;
}
