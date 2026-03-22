const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PROFILE_IMAGE_PREFIX,
  buildFirebaseStorageDownloadUrl,
  buildManagedProfileImagePath,
  getDefaultStorageBucketName,
  getStorageBucketCandidates,
  isManagedProfileImageUrl,
  normalizeRequestedGroupIds,
  shouldMigrateProfileImageUrl,
} = require("./profile-image-migration");

test("buildManagedProfileImagePath creates a stable storage path", () => {
  assert.equal(
    buildManagedProfileImagePath({
      groupId: "AbC123",
      name: "Élodie Example",
      contentType: "image/webp",
    }),
    `${PROFILE_IMAGE_PREFIX}/elodie-example-abc123.webp`,
  );
});

test("buildFirebaseStorageDownloadUrl encodes the bucket, path, and token", () => {
  assert.equal(
    buildFirebaseStorageDownloadUrl({
      bucketName: "compneuroparis.firebasestorage.app",
      objectPath: "profile-images/alice example.jpg",
      token: "token value",
    }),
    "https://firebasestorage.googleapis.com/v0/b/compneuroparis.firebasestorage.app/o/profile-images%2Falice%20example.jpg?alt=media&token=token%20value",
  );
});

test("isManagedProfileImageUrl recognizes Firebase download URLs for migrated images", () => {
  const bucketName = "compneuroparis.firebasestorage.app";
  const managedUrl = "https://firebasestorage.googleapis.com/v0/b/compneuroparis.firebasestorage.app/o/profile-images%2Falice-example.jpg?alt=media&token=abc";
  assert.equal(isManagedProfileImageUrl(managedUrl, { bucketName }), true);
  assert.equal(
    isManagedProfileImageUrl("https://example.org/alice-example.jpg", { bucketName }),
    false,
  );
});

test("shouldMigrateProfileImageUrl skips already-managed Firebase URLs", () => {
  const bucketName = "compneuroparis.firebasestorage.app";
  assert.equal(
    shouldMigrateProfileImageUrl("https://example.org/alice-example.jpg", { bucketName }),
    true,
  );
  assert.equal(
    shouldMigrateProfileImageUrl("https://firebasestorage.googleapis.com/v0/b/compneuroparis.firebasestorage.app/o/profile-images%2Falice-example.jpg?alt=media&token=abc", { bucketName }),
    false,
  );
});

test("getDefaultStorageBucketName prefers an explicit bucket and falls back to project id", () => {
  assert.equal(
    getDefaultStorageBucketName("compneuroparis", "custom-bucket.example"),
    "custom-bucket.example",
  );
  assert.equal(
    getDefaultStorageBucketName("compneuroparis"),
    "compneuroparis.firebasestorage.app",
  );
});

test("getStorageBucketCandidates prefers explicit bucket and includes common Firebase defaults", () => {
  assert.deepEqual(
    getStorageBucketCandidates("compneuroparis", "custom-bucket.example"),
    [
      "custom-bucket.example",
      "compneuroparis.appspot.com",
      "compneuroparis.firebasestorage.app",
    ],
  );
});

test("normalizeRequestedGroupIds trims, deduplicates, and ignores empty values", () => {
  assert.deepEqual(
    normalizeRequestedGroupIds([" group-a ", "", "group-b", "group-a", null]),
    ["group-a", "group-b"],
  );
  assert.deepEqual(normalizeRequestedGroupIds(null), []);
});
