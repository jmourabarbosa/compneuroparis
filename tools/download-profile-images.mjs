#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { isSupportedRemoteImageUrl } from '../js/image-url-utils.mjs';
import {
  PROFILE_IMAGE_BASE_DIR,
  buildProfileImageFilename,
  buildProfileImageLocalPath,
  getProfileImageExtension
} from '../js/profile-image-migration-utils.mjs';

async function main() {
  const [manifestPathArg, outputPathArg] = process.argv.slice(2);

  if (!manifestPathArg) {
    throw new Error('Usage: node tools/download-profile-images.mjs <manifest.json> [output-mapping.json]');
  }

  const manifestPath = path.resolve(process.cwd(), manifestPathArg);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const items = Array.isArray(manifest?.items) ? manifest.items : null;

  if (!items) {
    throw new Error('Manifest must contain an items array.');
  }

  const baseDir = manifest.baseDir || PROFILE_IMAGE_BASE_DIR;
  const results = [];

  for (const item of items) {
    const currentPhotoURL = String(item?.currentPhotoURL || '').trim();
    const groupId = String(item?.groupId || '').trim();
    const name = String(item?.name || '').trim();

    if (!groupId) {
      results.push({ ...item, status: 'failed', error: 'Missing groupId.' });
      continue;
    }

    if (!isSupportedRemoteImageUrl(currentPhotoURL)) {
      results.push({ ...item, status: 'skipped', error: 'Photo URL is not a supported remote http(s) URL.' });
      continue;
    }

    try {
      const response = await fetch(currentPhotoURL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const extension = getProfileImageExtension({ contentType, url: currentPhotoURL });
      const fileName = buildProfileImageFilename({ name, groupId, extension });
      const localPhotoURL = buildProfileImageLocalPath(fileName, { baseDir });
      const absolutePath = path.resolve(process.cwd(), localPhotoURL);
      const fileBuffer = Buffer.from(await response.arrayBuffer());

      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, fileBuffer);

      results.push({
        ...item,
        contentType,
        localPhotoURL,
        savedFileName: fileName,
        sizeBytes: fileBuffer.byteLength,
        status: 'downloaded'
      });

      console.log(`Downloaded ${name || groupId} -> ${localPhotoURL}`);
    } catch (error) {
      results.push({
        ...item,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });

      console.error(`Failed ${name || groupId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const outputPath = outputPathArg
    ? path.resolve(process.cwd(), outputPathArg)
    : manifestPath.replace(/\.json$/i, '.downloaded.json');

  const output = {
    generatedAt: new Date().toISOString(),
    sourceManifest: path.relative(process.cwd(), manifestPath),
    baseDir,
    items: results
  };

  await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`Wrote mapping file: ${path.relative(process.cwd(), outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
