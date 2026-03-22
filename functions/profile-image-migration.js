const { randomUUID } = require("node:crypto");

const PROFILE_IMAGE_PREFIX = "profile-images";

function isSupportedRemoteImageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function slugifyProfileImageSegment(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeProfileImageExtension(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (!normalizedValue) return ".jpg";

  const mimeMap = new Map([
    ["image/jpeg", ".jpg"],
    ["image/jpg", ".jpg"],
    ["image/pjpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/webp", ".webp"],
    ["image/gif", ".gif"],
    ["image/svg+xml", ".svg"],
    ["image/avif", ".avif"],
    ["image/bmp", ".bmp"],
  ]);

  if (mimeMap.has(normalizedValue)) {
    return mimeMap.get(normalizedValue);
  }

  const extension = normalizedValue.startsWith(".") ? normalizedValue : `.${normalizedValue}`;
  if (extension === ".jpeg") return ".jpg";
  return new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".bmp"]).has(extension)
    ? extension
    : ".jpg";
}

function getProfileImageExtension({ contentType = "", sourceUrl = "" } = {}) {
  if (contentType) {
    return normalizeProfileImageExtension(contentType.split(";", 1)[0]);
  }

  try {
    const parsed = new URL(sourceUrl);
    const match = parsed.pathname.toLowerCase().match(/\.([a-z0-9]+)$/);
    if (!match) return ".jpg";
    return normalizeProfileImageExtension(match[1]);
  } catch {
    return ".jpg";
  }
}

function buildManagedProfileImagePath({ groupId = "", name = "", contentType = "", sourceUrl = "", prefix = PROFILE_IMAGE_PREFIX } = {}) {
  const safeName = slugifyProfileImageSegment(name) || "profile";
  const safeId = slugifyProfileImageSegment(groupId) || "group";
  const extension = getProfileImageExtension({ contentType, sourceUrl });
  const cleanPrefix = String(prefix || PROFILE_IMAGE_PREFIX).replace(/^\/+|\/+$/g, "") || PROFILE_IMAGE_PREFIX;
  return `${cleanPrefix}/${safeName}-${safeId}${extension}`;
}

function buildFirebaseStorageDownloadUrl({ bucketName, objectPath, token }) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(token)}`;
}

function isManagedProfileImageUrl(url, { bucketName, prefix = PROFILE_IMAGE_PREFIX } = {}) {
  if (!isSupportedRemoteImageUrl(url) || !bucketName) return false;

  try {
    const parsed = new URL(url);
    const cleanPrefix = `${String(prefix || PROFILE_IMAGE_PREFIX).replace(/^\/+|\/+$/g, "")}/`;

    if (parsed.hostname === "firebasestorage.googleapis.com") {
      const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (!match) return false;
      return decodeURIComponent(match[1]) === bucketName
        && decodeURIComponent(match[2]).startsWith(cleanPrefix);
    }

    if (parsed.hostname === "storage.googleapis.com") {
      const prefixPath = `/${bucketName}/${cleanPrefix}`;
      return parsed.pathname.startsWith(prefixPath);
    }

    return false;
  } catch {
    return false;
  }
}

function shouldMigrateProfileImageUrl(url, options = {}) {
  return isSupportedRemoteImageUrl(url) && !isManagedProfileImageUrl(url, options);
}

function getDefaultStorageBucketName(projectId, explicitBucketName = "") {
  return String(explicitBucketName || "").trim() || `${projectId}.firebasestorage.app`;
}

function normalizeRequestedGroupIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map((entry) => String(entry || "").trim())
      .filter(Boolean),
  )];
}

async function migrateSingleProfileImage({
  groupDoc,
  bucket,
  bucketName,
  firestoreFieldValue,
  fetchImpl = globalThis.fetch,
}) {
  const group = groupDoc.data();
  const currentPhotoURL = String(group.photoURL || "").trim();

  if (!shouldMigrateProfileImageUrl(currentPhotoURL, { bucketName })) {
    return {
      status: "skipped",
      reason: currentPhotoURL ? "already-managed-or-unsupported" : "missing-photo-url",
      groupId: groupDoc.id,
      name: group.name || "",
      currentPhotoURL,
    };
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch is not available in the functions runtime.");
  }

  const response = await fetchImpl(currentPhotoURL);
  if (!response.ok) {
    throw new Error(`Image download failed with HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`Remote file is not an image (${contentType || "unknown content type"}).`);
  }

  const objectPath = buildManagedProfileImagePath({
    groupId: groupDoc.id,
    name: group.name || "",
    contentType,
    sourceUrl: currentPhotoURL,
  });
  const token = randomUUID();
  const fileBuffer = Buffer.from(await response.arrayBuffer());
  const file = bucket.file(objectPath);

  await file.save(fileBuffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: "public,max-age=31536000,immutable",
      metadata: {
        firebaseStorageDownloadTokens: token,
        sourceUrl: currentPhotoURL,
        groupId: groupDoc.id,
      },
    },
  });

  const managedPhotoURL = buildFirebaseStorageDownloadUrl({
    bucketName,
    objectPath,
    token,
  });

  const latestGroupSnap = await groupDoc.ref.get();
  const latestPhotoURL = String((latestGroupSnap.data() || {}).photoURL || "").trim();
  if (latestPhotoURL !== currentPhotoURL) {
    return {
      status: "skipped",
      reason: "photo-url-changed-during-migration",
      groupId: groupDoc.id,
      name: group.name || "",
      currentPhotoURL,
      managedPhotoURL,
    };
  }

  await groupDoc.ref.update({
    photoURL: managedPhotoURL,
    photoStoragePath: objectPath,
    photoMigratedFrom: currentPhotoURL,
    photoMigratedAt: firestoreFieldValue.serverTimestamp(),
  });

  return {
    status: "migrated",
    groupId: groupDoc.id,
    name: group.name || "",
    currentPhotoURL,
    managedPhotoURL,
    objectPath,
  };
}

module.exports = {
  PROFILE_IMAGE_PREFIX,
  buildFirebaseStorageDownloadUrl,
  buildManagedProfileImagePath,
  getDefaultStorageBucketName,
  isManagedProfileImageUrl,
  isSupportedRemoteImageUrl,
  migrateSingleProfileImage,
  normalizeRequestedGroupIds,
  shouldMigrateProfileImageUrl,
};
