#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function runCurlDownload(url, outputPath) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'profile-image-retry-'));
  const headerPath = path.join(tempDir, 'headers.txt');

  try {
    const { stdout, stderr } = await execFileAsync('curl', [
      '-k',
      '-L',
      '--retry',
      '2',
      '--retry-all-errors',
      '--max-time',
      '60',
      '-A',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      '-H',
      'Accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      '-D',
      headerPath,
      '-o',
      outputPath,
      '-w',
      'http_code=%{http_code}\ncontent_type=%{content_type}\n',
      url
    ], { maxBuffer: 1024 * 1024 * 10 });

    const meta = Object.fromEntries(
      stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [key, value] = line.split('=', 2);
          return [key, value || ''];
        })
    );

    return {
      httpCode: Number(meta.http_code || 0),
      contentType: meta.content_type || '',
      stderr: stderr.trim()
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function getCandidateUrls(url) {
  const candidates = [url];

  try {
    const parsed = new URL(url);
    const optimizedMarker = '/assets/images/optimized/';
    const embeddedOriginMarker = '/cerveau-enfant.org/';

    if (parsed.hostname === 'cdn-ilakmbb.nitrocdn.com' && parsed.pathname.includes(optimizedMarker) && parsed.pathname.includes(embeddedOriginMarker)) {
      const embeddedOriginPath = parsed.pathname.split(embeddedOriginMarker, 2)[1];
      if (embeddedOriginPath) {
        candidates.push(`https://cerveau-enfant.org/${embeddedOriginPath}`);
      }
    }
  } catch {}

  return [...new Set(candidates)];
}

function getRetryItems(data) {
  const items = Array.isArray(data?.downloadFailures) ? data.downloadFailures : null;
  if (!items) {
    throw new Error('Follow-up file must contain a downloadFailures array.');
  }
  return items.filter((item) => item?.groupId && item?.currentPhotoURL && item?.suggestedLocalPath);
}

async function main() {
  const [followupPathArg, outputPathArg] = process.argv.slice(2);
  if (!followupPathArg) {
    throw new Error('Usage: node tools/retry-failed-profile-images.mjs <followup.json> [retry-report.json]');
  }

  const followupPath = path.resolve(process.cwd(), followupPathArg);
  const followup = JSON.parse(await readFile(followupPath, 'utf8'));
  const retryItems = getRetryItems(followup);
  const retriedItems = [];

  for (const item of retryItems) {
    const absolutePath = path.resolve(process.cwd(), item.suggestedLocalPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });

    try {
      let successfulUrl = '';
      let successfulResponse = null;
      let lastError = '';

      for (const candidateUrl of getCandidateUrls(item.currentPhotoURL)) {
        const response = await runCurlDownload(candidateUrl, absolutePath);
        if (response.httpCode === 200 && response.contentType.toLowerCase().startsWith('image/')) {
          successfulUrl = candidateUrl;
          successfulResponse = response;
          break;
        }

        lastError = response.httpCode !== 200
          ? `HTTP ${response.httpCode || '000'}`
          : `Unexpected content type: ${response.contentType || 'unknown'}`;
      }

      if (!successfulResponse) {
        throw new Error(lastError || 'Download failed');
      }

      const fileStats = await stat(absolutePath);
      retriedItems.push({
        ...item,
        downloadedFromURL: successfulUrl || item.currentPhotoURL,
        contentType: successfulResponse.contentType,
        localPhotoURL: item.suggestedLocalPath,
        savedFileName: path.basename(item.suggestedLocalPath),
        sizeBytes: fileStats.size,
        previousError: item.error || '',
        status: 'downloaded'
      });
      console.log(`Recovered ${item.name || item.groupId} -> ${item.suggestedLocalPath}`);
    } catch (error) {
      await rm(absolutePath, { force: true });
      const message = error instanceof Error ? error.message : String(error);
      retriedItems.push({
        ...item,
        previousError: item.error || '',
        status: 'failed',
        error: message
      });
      console.error(`Still failed ${item.name || item.groupId}: ${message}`);
    }
  }

  const recoveredItems = retriedItems.filter((item) => item.status === 'downloaded');
  const remainingFailures = retriedItems.filter((item) => item.status !== 'downloaded');

  const output = {
    generatedAt: new Date().toISOString(),
    sourceFollowup: path.relative(process.cwd(), followupPath),
    recoveredCount: recoveredItems.length,
    remainingFailureCount: remainingFailures.length,
    recoveredItems,
    remainingFailures
  };

  const outputPath = outputPathArg
    ? path.resolve(process.cwd(), outputPathArg)
    : followupPath.replace(/\.json$/i, '.retry-report.json');

  await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`Wrote retry report: ${path.relative(process.cwd(), outputPath)}`);
  console.log(`Summary: recovered=${recoveredItems.length} remaining=${remainingFailures.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
