#!/usr/bin/env node
// Find Google Scholar profile links for all PIs
// Searches with "neuro" appended to names

const fs = require('fs');
const OUTPUT_FILE = 'scholar-links.json';

// Firestore REST API
const PROJECT_ID = 'compneuroparis';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function fetchAllPIs() {
  const pis = [];
  let pageToken = null;

  while (true) {
    let url = `${FIRESTORE_URL}/groups?pageSize=300`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const res = await fetch(url);
    const data = await res.json();
    const docs = data.documents || [];

    for (const doc of docs) {
      const fields = doc.fields || {};
      const id = doc.name.split('/').pop();
      const name = fields.name?.stringValue || '';
      const links = (fields.links?.arrayValue?.values || []).map(v => {
        const m = v.mapValue?.fields || {};
        return {
          label: m.label?.stringValue || '',
          url: m.url?.stringValue || ''
        };
      });
      const hasScholar = links.some(l => l.url && l.url.includes('scholar.google'));
      const scholarUrl = links.find(l => l.url && l.url.includes('scholar.google'))?.url || null;

      pis.push({ id, name, hasScholar, existingScholarUrl: scholarUrl });
    }

    if (data.nextPageToken) {
      pageToken = data.nextPageToken;
    } else {
      break;
    }
  }

  return pis;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchScholar(name) {
  const query = encodeURIComponent(`${name} neuro`);
  const url = `https://scholar.google.com/citations?view_op=search_authors&mauthors=${query}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  if (res.status === 429) {
    return { error: 'rate_limited', url };
  }

  const html = await res.text();

  // Check for CAPTCHA
  if (html.includes('captcha') || html.includes('unusual traffic')) {
    return { error: 'captcha', url };
  }

  // Extract profile links: /citations?user=XXXXX
  const profileRegex = /\/citations\?user=([a-zA-Z0-9_-]+)/g;
  const matches = [];
  let match;
  while ((match = profileRegex.exec(html)) !== null) {
    matches.push(match[1]);
  }

  // Deduplicate
  const uniqueUsers = [...new Set(matches)];

  if (uniqueUsers.length === 0) {
    return { error: 'not_found', url };
  }

  // Extract names associated with each profile for verification
  const results = uniqueUsers.map(userId => ({
    userId,
    profileUrl: `https://scholar.google.com/citations?user=${userId}`
  }));

  return { results, searchUrl: url };
}

async function main() {
  console.log('Fetching all PIs from Firestore...');
  const pis = await fetchAllPIs();
  console.log(`Found ${pis.length} PIs total`);

  const alreadyHave = pis.filter(p => p.hasScholar).length;
  console.log(`${alreadyHave} already have Google Scholar links`);
  console.log(`${pis.length - alreadyHave} need Scholar links\n`);

  // Load existing progress if any
  let results = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    results = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    console.log(`Loaded ${Object.keys(results).length} existing results from ${OUTPUT_FILE}\n`);
  }

  let searched = 0;
  let found = 0;
  let notFound = 0;
  let errors = 0;
  let skipped = 0;

  for (const pi of pis) {
    // Skip if already searched
    if (results[pi.id]) {
      skipped++;
      continue;
    }

    // Skip if already has a scholar link in Firestore
    if (pi.hasScholar) {
      results[pi.id] = {
        name: pi.name,
        status: 'already_has',
        scholarUrl: pi.existingScholarUrl
      };
      skipped++;
      continue;
    }

    searched++;
    process.stdout.write(`[${searched}] Searching: ${pi.name}... `);

    const result = await searchScholar(pi.name);

    if (result.error === 'rate_limited' || result.error === 'captcha') {
      console.log(`BLOCKED (${result.error}) - saving progress and stopping`);
      errors++;
      // Save progress before stopping
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
      console.log(`\nSaved progress to ${OUTPUT_FILE}`);
      console.log(`Searched: ${searched}, Found: ${found}, Not found: ${notFound}, Errors: ${errors}`);
      console.log(`\nRe-run the script to continue from where we left off.`);
      process.exit(1);
    }

    if (result.error === 'not_found') {
      console.log('NOT FOUND');
      notFound++;
      results[pi.id] = {
        name: pi.name,
        status: 'not_found',
        searchUrl: result.url
      };
    } else {
      const topResult = result.results[0];
      console.log(`FOUND -> ${topResult.profileUrl} (${result.results.length} results)`);
      found++;
      results[pi.id] = {
        name: pi.name,
        status: 'found',
        scholarUrl: topResult.profileUrl,
        allResults: result.results,
        totalResults: result.results.length,
        searchUrl: result.searchUrl
      };
    }

    // Save after each search
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

    // Rate limit: wait between requests
    await sleep(3000 + Math.random() * 2000); // 3-5 seconds
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total PIs: ${pis.length}`);
  console.log(`Skipped (already done): ${skipped}`);
  console.log(`Searched: ${searched}`);
  console.log(`Found: ${found}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Errors: ${errors}`);
  console.log(`\nResults saved to ${OUTPUT_FILE}`);
}

main().catch(console.error);
