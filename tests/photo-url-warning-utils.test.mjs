import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canSubmitWithPhotoUrlWarning,
  getPhotoUrlWarningState
} from '../js/photo-url-warning-utils.mjs';

test('getPhotoUrlWarningState returns checking state while validation is in flight', () => {
  assert.deepEqual(
    getPhotoUrlWarningState({ hasValue: true, isChecking: true, validationResult: null }),
    {
      hidden: false,
      tone: 'info',
      message: 'Checking whether this photo link loads as an image...',
      requiresAcknowledgement: false,
      acknowledged: false
    }
  );
});

test('getPhotoUrlWarningState returns success state for valid images', () => {
  assert.deepEqual(
    getPhotoUrlWarningState({
      hasValue: true,
      isChecking: false,
      validationResult: { valid: true, reason: 'ok' }
    }),
    {
      hidden: false,
      tone: 'success',
      message: 'This photo link loads right now.',
      requiresAcknowledgement: false,
      acknowledged: false
    }
  );
});

test('getPhotoUrlWarningState returns warning state and acknowledgement requirement for invalid images', () => {
  const state = getPhotoUrlWarningState({
    hasValue: true,
    isChecking: false,
    validationResult: { valid: false, reason: 'not-image' },
    acknowledged: true
  });

  assert.equal(state.hidden, false);
  assert.equal(state.tone, 'warning');
  assert.match(state.message, /must point to a valid image/i);
  assert.equal(state.requiresAcknowledgement, true);
  assert.equal(state.acknowledged, true);
});

test('canSubmitWithPhotoUrlWarning allows acknowledged warnings but blocks active checks', () => {
  assert.equal(
    canSubmitWithPhotoUrlWarning({
      hasValue: true,
      isChecking: true,
      validationResult: null,
      acknowledged: false
    }),
    false
  );

  assert.equal(
    canSubmitWithPhotoUrlWarning({
      hasValue: true,
      isChecking: false,
      validationResult: { valid: false, reason: 'timeout' },
      acknowledged: false
    }),
    false
  );

  assert.equal(
    canSubmitWithPhotoUrlWarning({
      hasValue: true,
      isChecking: false,
      validationResult: { valid: false, reason: 'timeout' },
      acknowledged: true
    }),
    true
  );
});
