export const PROFILE_IMAGE_BASE_DIR = 'assets/profile-images';

const MIME_TYPE_TO_EXTENSION = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/pjpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/svg+xml', '.svg'],
  ['image/avif', '.avif'],
  ['image/bmp', '.bmp']
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.bmp']);

export function slugifyProfileImageSegment(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function normalizeProfileImageExtension(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (!normalizedValue) return '.jpg';

  if (MIME_TYPE_TO_EXTENSION.has(normalizedValue)) {
    return MIME_TYPE_TO_EXTENSION.get(normalizedValue);
  }

  const extension = normalizedValue.startsWith('.') ? normalizedValue : `.${normalizedValue}`;
  if (extension === '.jpeg') return '.jpg';
  return ALLOWED_EXTENSIONS.has(extension) ? extension : '.jpg';
}

export function getProfileImageExtension({ contentType = '', url = '' } = {}) {
  if (contentType) {
    return normalizeProfileImageExtension(contentType.split(';', 1)[0]);
  }

  try {
    const parsed = new URL(url);
    const match = parsed.pathname.toLowerCase().match(/\.([a-z0-9]+)$/);
    if (!match) return '.jpg';
    return normalizeProfileImageExtension(match[1]);
  } catch {
    return '.jpg';
  }
}

export function buildProfileImageFilename({ name = '', groupId = '', extension = '.jpg' } = {}) {
  const safeName = slugifyProfileImageSegment(name) || 'profile';
  const safeId = slugifyProfileImageSegment(groupId) || 'group';
  return `${safeName}-${safeId}${normalizeProfileImageExtension(extension)}`;
}

export function buildProfileImageLocalPath(fileName, { baseDir = PROFILE_IMAGE_BASE_DIR } = {}) {
  const cleanedBaseDir = String(baseDir || PROFILE_IMAGE_BASE_DIR).replace(/^\/+|\/+$/g, '') || PROFILE_IMAGE_BASE_DIR;
  return `${cleanedBaseDir}/${String(fileName || '').replace(/^\/+/, '')}`;
}

export function buildProfileImageManifestEntry(group, { baseDir = PROFILE_IMAGE_BASE_DIR } = {}) {
  const suggestedFileName = buildProfileImageFilename({
    name: group?.name,
    groupId: group?.id,
    extension: getProfileImageExtension({ url: group?.photoURL || '' })
  });

  return {
    groupId: group?.id || '',
    name: group?.name || '',
    currentPhotoURL: group?.photoURL || '',
    suggestedFileName,
    suggestedLocalPath: buildProfileImageLocalPath(suggestedFileName, { baseDir })
  };
}
