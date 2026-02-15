#!/bin/bash
# Firebase Phase 2 Setup Script
# Run this after: npx firebase-tools login
#
# Usage: bash setup-firebase.sh <PROJECT_ID> <ADMIN_EMAIL> <ADMIN_PASSWORD>
# Example: bash setup-firebase.sh compneuroparis admin@example.com MySecurePass123

set -e

PROJECT_ID="${1:?Usage: bash setup-firebase.sh <PROJECT_ID> <ADMIN_EMAIL> <ADMIN_PASSWORD>}"
ADMIN_EMAIL="${2:?Please provide admin email}"
ADMIN_PASSWORD="${3:?Please provide admin password}"

FIREBASE="npx firebase-tools"

echo "=== Step 1: Create Firebase project ==="
$FIREBASE projects:create "$PROJECT_ID" --display-name "Comp Neuro Paris" 2>/dev/null || echo "Project may already exist, continuing..."

echo ""
echo "=== Step 2: Set active project ==="
$FIREBASE use "$PROJECT_ID"

echo ""
echo "=== Step 3: Deploy Firestore rules & indexes ==="
$FIREBASE deploy --only firestore:rules,firestore:indexes

echo ""
echo "=== Step 4: Get web app config ==="
# List existing apps or create one
APP_ID=$($FIREBASE apps:list WEB --json 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
apps = data.get('result', [])
if apps:
    print(apps[0]['appId'])
" 2>/dev/null || echo "")

if [ -z "$APP_ID" ]; then
    echo "Creating web app..."
    $FIREBASE apps:create WEB "Comp Neuro Paris Web"
    sleep 2
    APP_ID=$($FIREBASE apps:list WEB --json | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(data['result'][0]['appId'])
")
fi

echo "Web App ID: $APP_ID"

echo ""
echo "=== Step 5: Extract and write Firebase config ==="
CONFIG_JSON=$($FIREBASE apps:sdkconfig WEB "$APP_ID" --json)

# Parse config and write firebase-config.js
python3 << PYEOF
import json

raw = '''$CONFIG_JSON'''
data = json.loads(raw)
cfg = data.get('result', {}).get('sdkConfig', {})

js = '''import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "''' + cfg.get('apiKey','') + '''",
  authDomain: "''' + cfg.get('authDomain','') + '''",
  projectId: "''' + cfg.get('projectId','') + '''",
  storageBucket: "''' + cfg.get('storageBucket','') + '''",
  messagingSenderId: "''' + cfg.get('messagingSenderId','') + '''",
  appId: "''' + cfg.get('appId','') + '''"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
'''

with open('js/firebase-config.js', 'w') as f:
    f.write(js)

print("Wrote js/firebase-config.js with config:")
for k, v in cfg.items():
    print(f"  {k}: {v}")
PYEOF

echo ""
echo "=== Step 6: Create admin user & seed data ==="
echo "NOTE: Email/Password auth and Firestore must be enabled in the Firebase Console."
echo ""
echo "Please complete these manual steps in https://console.firebase.google.com/project/$PROJECT_ID :"
echo ""
echo "  1. Authentication > Sign-in method > Enable 'Email/Password'"
echo "  2. Firestore Database > Create database (production mode, any region)"
echo ""
echo "After enabling those services, run:"
echo "  bash seed-firebase.sh $PROJECT_ID $ADMIN_EMAIL $ADMIN_PASSWORD"
echo ""
echo "=== Done (config written) ==="
