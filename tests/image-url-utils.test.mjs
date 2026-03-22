import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getImageUrlValidationMessage,
  isSupportedLocalImagePath,
  isSupportedRemoteImageUrl,
  validateImageUrl
} from '../js/image-url-utils.mjs';

class SuccessfulImage {
  set src(_value) {
    queueMicrotask(() => this.onload?.());
  }
}

class FailingImage {
  set src(_value) {
    queueMicrotask(() => this.onerror?.(new Error('failed')));
  }
}

class HangingImage {
  set src(_value) {}
}

test('isSupportedRemoteImageUrl accepts only http and https URLs', () => {
  assert.equal(isSupportedRemoteImageUrl('https://example.org/pic.jpg'), true);
  assert.equal(isSupportedRemoteImageUrl('http://example.org/pic.jpg'), true);
  assert.equal(isSupportedRemoteImageUrl('ftp://example.org/pic.jpg'), false);
  assert.equal(isSupportedRemoteImageUrl('not a url'), false);
});

test('isSupportedLocalImagePath accepts repo-hosted asset paths', () => {
  assert.equal(isSupportedLocalImagePath('assets/profile-images/pic.jpg'), true);
  assert.equal(isSupportedLocalImagePath('/assets/profile-images/pic.webp'), true);
  assert.equal(isSupportedLocalImagePath('profile-images/pic.jpg'), false);
  assert.equal(isSupportedLocalImagePath('https://example.org/pic.jpg'), false);
});

test('validateImageUrl rejects malformed URLs before trying to load them', async () => {
  const result = await validateImageUrl('not a url', { ImageCtor: SuccessfulImage });
  assert.deepEqual(result, { valid: false, reason: 'invalid-url' });
});

test('validateImageUrl accepts local asset paths that load as images', async () => {
  const result = await validateImageUrl('assets/profile-images/pic.jpg', { ImageCtor: SuccessfulImage });
  assert.deepEqual(result, { valid: true, reason: 'ok' });
});

test('validateImageUrl accepts URLs that load as images', async () => {
  const result = await validateImageUrl('https://example.org/pic', { ImageCtor: SuccessfulImage });
  assert.deepEqual(result, { valid: true, reason: 'ok' });
});

test('validateImageUrl rejects URLs that fail to load as images', async () => {
  const result = await validateImageUrl('https://example.org/not-image', { ImageCtor: FailingImage });
  assert.deepEqual(result, { valid: false, reason: 'not-image' });
});

test('validateImageUrl times out when the image never loads', async () => {
  const result = await validateImageUrl('https://example.org/stuck', { ImageCtor: HangingImage, timeoutMs: 5 });
  assert.deepEqual(result, { valid: false, reason: 'timeout' });
});

test('getImageUrlValidationMessage returns a user-facing error string', () => {
  assert.equal(
    getImageUrlValidationMessage({ valid: false, reason: 'not-image' }, 'PI photo URL'),
    'PI photo URL must point to a valid image that can be loaded.'
  );
  assert.equal(
    getImageUrlValidationMessage({ valid: false, reason: 'invalid-url' }, 'PI photo URL'),
    'PI photo URL must be a valid http(s) URL or local assets path.'
  );
});
