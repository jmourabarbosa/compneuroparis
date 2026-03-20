export function deriveManagerNameFromEmail(email = '') {
  const trimmedEmail = String(email || '').trim();
  if (!trimmedEmail) return '';

  const localPart = trimmedEmail.split('@')[0]?.split('+')[0] || '';
  const tokens = localPart
    .split(/[._-]+/)
    .map(token => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return localPart || trimmedEmail;

  return tokens
    .map(token => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

export function getPreferredUserName(user = null) {
  if (!user) return '';
  return String(user.displayName || '').trim()
    || deriveManagerNameFromEmail(user.email || '');
}

export function getClaimManagerName(record = {}, fallback = 'member') {
  return String(record.claimedByName || '').trim()
    || deriveManagerNameFromEmail(record.claimedByEmail || '')
    || fallback;
}
