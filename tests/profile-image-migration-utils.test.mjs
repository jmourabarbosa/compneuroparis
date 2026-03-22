import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROFILE_IMAGE_BASE_DIR,
  buildProfileImageFilename,
  buildProfileImageLocalPath,
  buildProfileImageManifestEntry,
  getProfileImageExtension,
  normalizeProfileImageExtension,
  slugifyProfileImageSegment
} from '../js/profile-image-migration-utils.mjs';

test('slugifyProfileImageSegment removes accents and collapses separators', () => {
  assert.equal(slugifyProfileImageSegment('Élodie de la Côte / Lab'), 'elodie-de-la-cote-lab');
});

test('normalizeProfileImageExtension accepts mime types and common extensions', () => {
  assert.equal(normalizeProfileImageExtension('image/jpeg'), '.jpg');
  assert.equal(normalizeProfileImageExtension('.png'), '.png');
  assert.equal(normalizeProfileImageExtension('jpeg'), '.jpg');
  assert.equal(normalizeProfileImageExtension('weird'), '.jpg');
});

test('getProfileImageExtension prefers content type and falls back to URL path', () => {
  assert.equal(
    getProfileImageExtension({ contentType: 'image/webp; charset=binary', url: 'https://example.org/photo.jpg' }),
    '.webp'
  );
  assert.equal(
    getProfileImageExtension({ url: 'https://example.org/photo.png?size=large' }),
    '.png'
  );
  assert.equal(getProfileImageExtension({ url: 'not a url' }), '.jpg');
});

test('buildProfileImageFilename creates a stable filename with the group id', () => {
  assert.equal(
    buildProfileImageFilename({ name: 'Alice Example', groupId: 'AbC123', extension: '.jpeg' }),
    'alice-example-abc123.jpg'
  );
});

test('buildProfileImageLocalPath joins the base directory and filename safely', () => {
  assert.equal(
    buildProfileImageLocalPath('/alice-example-abc123.jpg', { baseDir: '/assets/profile-images/' }),
    `${PROFILE_IMAGE_BASE_DIR}/alice-example-abc123.jpg`
  );
});

test('buildProfileImageManifestEntry creates a suggested local path from a group record', () => {
  assert.deepEqual(
    buildProfileImageManifestEntry({
      id: 'group123',
      name: 'Alice Example',
      photoURL: 'https://example.org/photo.webp'
    }),
    {
      groupId: 'group123',
      name: 'Alice Example',
      currentPhotoURL: 'https://example.org/photo.webp',
      suggestedFileName: 'alice-example-group123.webp',
      suggestedLocalPath: 'assets/profile-images/alice-example-group123.webp'
    }
  );
});
