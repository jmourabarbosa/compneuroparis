export function buildPublicDetailHash(type, id) {
  if (!type || !id) return '';
  return `#${type}-${id}`;
}

export function buildPublicJobPageUrl(id) {
  if (!id) return 'job.html';
  return `job.html?id=${encodeURIComponent(id)}`;
}

export function parsePublicDetailHash(hash = '') {
  const normalizedHash = String(hash || '').trim();
  const match = normalizedHash.match(/^#(pi|inst|job)-(.+)$/);
  if (!match) return null;

  const [, type, id] = match;
  return id ? { type, id } : null;
}

export function parsePublicJobPageId(search = '') {
  const normalizedSearch = String(search || '').replace(/^\?/, '');
  const params = new URLSearchParams(normalizedSearch);
  return params.get('id')?.trim() || '';
}
