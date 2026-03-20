import { getImageUrlValidationMessage } from './image-url-utils.mjs';

export function getPhotoUrlWarningState({
  hasValue,
  isChecking,
  validationResult,
  acknowledged = false
}) {
  if (!hasValue) {
    return {
      hidden: true,
      tone: 'info',
      message: '',
      requiresAcknowledgement: false,
      acknowledged: false
    };
  }

  if (isChecking) {
    return {
      hidden: false,
      tone: 'info',
      message: 'Checking whether this photo link loads as an image...',
      requiresAcknowledgement: false,
      acknowledged: false
    };
  }

  if (!validationResult) {
    return {
      hidden: true,
      tone: 'info',
      message: '',
      requiresAcknowledgement: false,
      acknowledged: false
    };
  }

  if (validationResult.valid) {
    return {
      hidden: false,
      tone: 'success',
      message: 'This photo link loads right now.',
      requiresAcknowledgement: false,
      acknowledged: false
    };
  }

  return {
    hidden: false,
    tone: 'warning',
    message: `${getImageUrlValidationMessage(validationResult, 'PI photo URL')} You can still submit if you confirm you want to continue with this link.`,
    requiresAcknowledgement: true,
    acknowledged: Boolean(acknowledged)
  };
}

export function canSubmitWithPhotoUrlWarning({
  hasValue,
  isChecking,
  validationResult,
  acknowledged = false
}) {
  if (!hasValue || isChecking) return false;
  if (!validationResult) return true;
  return validationResult.valid || Boolean(acknowledged);
}
