#!/usr/bin/env python3
"""Find Google Scholar profile links for all PIs using DuckDuckGo search via curl."""

import json
import re
import time
import subprocess
import urllib.parse
import sys
import os

OUTPUT_FILE = 'scholar-links.json'
PIS_FILE = 'all-pis.json'

def search_ddg(name):
    """Search DuckDuckGo for a PI's Google Scholar profile using curl."""
    query = f'{name} Google Scholar neuroscience'
    url = f'https://html.duckduckgo.com/html/?q={urllib.parse.quote_plus(query)}'

    try:
        result = subprocess.run(
            ['curl', '-s', '-L', '--max-time', '15',
             '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
             url],
            capture_output=True, text=True, timeout=20
        )
        html = result.stdout
    except Exception as e:
        return {'error': str(e)}

    if not html:
        return {'error': 'empty_response'}

    # Check for rate limiting
    if 'captcha' in html.lower() or 'robot' in html.lower():
        return {'error': 'captcha'}

    # Find all scholar.google.com/citations?user= URLs (may be URL-encoded)
    # First decode any URL encoding
    decoded = urllib.parse.unquote(html)
    user_ids = re.findall(r'scholar\.google\.[a-z.]+/citations\?user=([A-Za-z0-9_-]+)', decoded)
    unique_ids = list(dict.fromkeys(user_ids))

    if not unique_ids:
        return {'error': 'not_found'}

    return {
        'results': [
            {'userId': uid, 'profileUrl': f'https://scholar.google.com/citations?user={uid}'}
            for uid in unique_ids
        ]
    }

def main():
    # Load PIs
    with open(PIS_FILE) as f:
        pis = json.load(f)

    print(f'Total PIs: {len(pis)}')

    # Load existing results
    results = {}
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE) as f:
            results = json.load(f)
        print(f'Loaded {len(results)} existing results')

    # Mark PIs that already have scholar links
    for pi in pis:
        if pi['has_scholar'] and pi['id'] not in results:
            results[pi['id']] = {
                'name': pi['name'],
                'status': 'already_has',
                'scholarUrl': pi['scholar_url']
            }

    need_search = [p for p in pis if p['id'] not in results]
    print(f'Need to search: {len(need_search)}')
    print()

    searched = 0
    found = 0
    not_found = 0
    errors = 0

    for pi in need_search:
        searched += 1
        sys.stdout.write(f'[{searched}/{len(need_search)}] {pi["name"]}... ')
        sys.stdout.flush()

        result = search_ddg(pi['name'])

        if result.get('error') == 'captcha':
            print('CAPTCHA - waiting 60s and retrying...')
            sys.stdout.flush()
            time.sleep(60)
            result = search_ddg(pi['name'])
            if result.get('error') == 'captcha':
                print('CAPTCHA again - saving and stopping')
                with open(OUTPUT_FILE, 'w') as f:
                    json.dump(results, f, indent=2)
                print(f'\nSaved {len(results)} results. Re-run to continue.')
                sys.exit(1)

        if result.get('error') == 'not_found':
            # Try with just "neuro" instead of "neuroscience"
            time.sleep(2)
            result2 = search_ddg_query(f'{pi["name"]} neuro Google Scholar')
            if result2.get('results'):
                result = result2

        if result.get('error'):
            print(f'NOT FOUND ({result["error"]})')
            not_found += 1
            results[pi['id']] = {
                'name': pi['name'],
                'status': 'not_found',
                'error': result['error']
            }
        else:
            top = result['results'][0]
            n_results = len(result['results'])
            print(f'FOUND -> {top["profileUrl"]} ({n_results} result{"s" if n_results > 1 else ""})')
            found += 1
            results[pi['id']] = {
                'name': pi['name'],
                'status': 'found',
                'scholarUrl': top['profileUrl'],
                'allResults': result['results'],
                'totalResults': n_results
            }

        # Save after each search
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(results, f, indent=2)

        # Rate limit: 4-6 seconds between requests
        delay = 4 + (searched % 3)
        time.sleep(delay)

    print(f'\n=== SUMMARY ===')
    print(f'Searched: {searched}')
    print(f'Found: {found}')
    print(f'Not found: {not_found}')
    print(f'Total results saved: {len(results)}')
    print(f'\nResults saved to {OUTPUT_FILE}')


def search_ddg_query(query):
    """Search DuckDuckGo with a custom query string."""
    url = f'https://html.duckduckgo.com/html/?q={urllib.parse.quote_plus(query)}'

    try:
        result = subprocess.run(
            ['curl', '-s', '-L', '--max-time', '15',
             '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
             url],
            capture_output=True, text=True, timeout=20
        )
        html = result.stdout
    except Exception as e:
        return {'error': str(e)}

    if not html:
        return {'error': 'empty_response'}

    if 'captcha' in html.lower() or 'robot' in html.lower():
        return {'error': 'captcha'}

    decoded = urllib.parse.unquote(html)
    user_ids = re.findall(r'scholar\.google\.[a-z.]+/citations\?user=([A-Za-z0-9_-]+)', decoded)
    unique_ids = list(dict.fromkeys(user_ids))

    if not unique_ids:
        return {'error': 'not_found'}

    return {
        'results': [
            {'userId': uid, 'profileUrl': f'https://scholar.google.com/citations?user={uid}'}
            for uid in unique_ids
        ]
    }


if __name__ == '__main__':
    main()
