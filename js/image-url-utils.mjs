export function isSupportedRemoteImageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function validateImageUrl(url, { ImageCtor = globalThis.Image, timeoutMs = 5000 } = {}) {
  if (!url) {
    return { valid: false, reason: 'missing' };
  }

  if (!isSupportedRemoteImageUrl(url)) {
    return { valid: false, reason: 'invalid-url' };
  }

  if (typeof ImageCtor !== 'function') {
    return { valid: false, reason: 'image-loader-unavailable' };
  }

  return await new Promise((resolve) => {
    const img = new ImageCtor();
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ valid: false, reason: 'timeout' });
    }, timeoutMs);

    img.onload = () => finish({ valid: true, reason: 'ok' });
    img.onerror = () => finish({ valid: false, reason: 'not-image' });
    img.src = url;
  });
}

export function getImageUrlValidationMessage(result, fieldLabel = 'Image URL') {
  switch (result?.reason) {
    case 'missing':
      return `${fieldLabel} is required.`;
    case 'invalid-url':
      return `${fieldLabel} must be a valid http(s) URL.`;
    case 'timeout':
    case 'not-image':
      return `${fieldLabel} must point to a valid image that can be loaded.`;
    case 'image-loader-unavailable':
      return `Could not validate ${fieldLabel.toLowerCase()} right now. Please try again.`;
    default:
      return '';
  }
}
