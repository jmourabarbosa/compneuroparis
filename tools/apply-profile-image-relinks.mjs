#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import process from 'node:process';

import firebaseTools from 'firebase-tools';

const PROJECT_ID = 'compneuroparis';
const require = createRequire(import.meta.url);
const { getAccessToken: refreshAccessToken } = require('firebase-tools/lib/auth');
const { CLOUD_PLATFORM } = require('firebase-tools/lib/scopes');

async function getAccessToken() {
  const logins = await firebaseTools.login.list();
  const refreshToken = logins.find((entry) => entry?.tokens?.refresh_token)?.tokens?.refresh_token;
  if (!refreshToken) {
    throw new Error('No logged-in firebase-tools refresh token is available. Run `./node_modules/.bin/firebase login` first.');
  }
  const token = await refreshAccessToken(refreshToken, [CLOUD_PLATFORM]);
  if (!token?.access_token) {
    throw new Error('firebase-tools did not return a usable access token.');
  }
  return token.access_token;
}

function getMappingItems(mapping) {
  if (!mapping || !Array.isArray(mapping.items)) {
    throw new Error('Mapping file must contain an items array.');
  }
  return mapping.items.filter((item) => item && item.groupId);
}

function countStatuses(items) {
  return items.reduce((counts, item) => {
    const key = item.status || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

async function fetchFirestoreDocument(accessToken, documentPath) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${documentPath}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Firestore GET failed with HTTP ${response.status}`);
  }

  return response.json();
}

async function commitFirestoreUpdate(accessToken, documentName, updateTime, localPhotoURL) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: documentName,
            fields: {
              photoURL: { stringValue: localPhotoURL }
            }
          },
          updateMask: {
            fieldPaths: ['photoURL']
          },
          updateTransforms: [
            {
              fieldPath: 'updatedAt',
              setToServerValue: 'REQUEST_TIME'
            }
          ],
          currentDocument: {
            updateTime
          }
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firestore commit failed with HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function main() {
  const [mappingPathArg, reportPathArg] = process.argv.slice(2);
  if (!mappingPathArg) {
    throw new Error('Usage: node tools/apply-profile-image-relinks.mjs <mapping.json> [output-report.json]');
  }

  const mappingPath = path.resolve(process.cwd(), mappingPathArg);
  const mapping = JSON.parse(await readFile(mappingPath, 'utf8'));
  const items = getMappingItems(mapping);
  const readyItems = items.filter((item) => item.status === 'downloaded' && item.localPhotoURL);

  if (!readyItems.length) {
    throw new Error('The mapping file has no downloaded items to apply.');
  }

  const accessToken = await getAccessToken();
  const results = [];

  for (const item of readyItems) {
    const label = item.name || item.groupId;

    try {
      const liveDocument = await fetchFirestoreDocument(accessToken, `groups/${item.groupId}`);
      if (!liveDocument) {
        console.log(`Missing group: ${label}`);
        results.push({
          ...item,
          status: 'missing-group'
        });
        continue;
      }

      const livePhotoURL = liveDocument.fields?.photoURL?.stringValue || '';
      if (livePhotoURL === item.localPhotoURL) {
        console.log(`Already linked: ${label}`);
        results.push({
          ...item,
          status: 'already-linked',
          livePhotoURL
        });
        continue;
      }

      if (livePhotoURL !== item.currentPhotoURL) {
        console.log(`Changed live photo URL: ${label}`);
        results.push({
          ...item,
          status: 'changed-live-photo-url',
          livePhotoURL
        });
        continue;
      }

      await commitFirestoreUpdate(accessToken, liveDocument.name, liveDocument.updateTime, item.localPhotoURL);
      console.log(`Relinked ${label} -> ${item.localPhotoURL}`);
      results.push({
        ...item,
        status: 'updated',
        livePhotoURLBefore: livePhotoURL
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed ${label}: ${message}`);
      results.push({
        ...item,
        status: 'failed',
        error: message
      });
    }
  }

  const reportPath = reportPathArg
    ? path.resolve(process.cwd(), reportPathArg)
    : mappingPath.replace(/\.json$/i, '.relink-report.json');

  const report = {
    generatedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    sourceMapping: path.relative(process.cwd(), mappingPath),
    counts: countStatuses(results),
    items: results
  };

  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(`Wrote relink report: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`Summary: ${JSON.stringify(report.counts)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
