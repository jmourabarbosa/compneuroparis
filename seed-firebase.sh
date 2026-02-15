#!/bin/bash
# Seed Firebase with admin user and sample groups
# Run AFTER enabling Auth, Firestore, and Storage in the Firebase Console
#
# Usage: bash seed-firebase.sh <PROJECT_ID> <ADMIN_EMAIL> <ADMIN_PASSWORD>

set -e

PROJECT_ID="${1:?Usage: bash seed-firebase.sh <PROJECT_ID> <ADMIN_EMAIL> <ADMIN_PASSWORD>}"
ADMIN_EMAIL="${2:?Please provide admin email}"
ADMIN_PASSWORD="${3:?Please provide admin password}"

# We'll use the Firebase REST APIs to create the admin user and seed data.
# First we need the API key from the config.
API_KEY=$(python3 -c "
import re
with open('js/firebase-config.js') as f:
    content = f.read()
m = re.search(r'apiKey:\s*\"([^\"]+)\"', content)
if m: print(m.group(1))
")

if [ -z "$API_KEY" ]; then
    echo "ERROR: Could not extract API key from js/firebase-config.js"
    echo "Make sure you've run setup-firebase.sh first."
    exit 1
fi

echo "Using API key: ${API_KEY:0:10}..."

echo ""
echo "=== Creating admin user via Firebase Auth REST API ==="
AUTH_RESPONSE=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"returnSecureToken\":true}")

# Extract UID and ID token
ADMIN_UID=$(echo "$AUTH_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('localId',''))")
ID_TOKEN=$(echo "$AUTH_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('idToken',''))")

if [ -z "$ADMIN_UID" ]; then
    echo "Auth response: $AUTH_RESPONSE"
    echo ""
    echo "User may already exist. Trying to sign in instead..."
    AUTH_RESPONSE=$(curl -s -X POST \
      "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$API_KEY" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"returnSecureToken\":true}")
    ADMIN_UID=$(echo "$AUTH_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('localId',''))")
    ID_TOKEN=$(echo "$AUTH_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('idToken',''))")
fi

if [ -z "$ADMIN_UID" ]; then
    echo "ERROR: Could not create or sign in admin user."
    echo "Response: $AUTH_RESPONSE"
    exit 1
fi

echo "Admin UID: $ADMIN_UID"

echo ""
echo "=== Adding admin to Firestore admins collection ==="
FIRESTORE_URL="https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents"

curl -s -X PATCH \
  "$FIRESTORE_URL/admins/$ADMIN_UID?currentDocument.exists=false" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"fields\": {
      \"email\": {\"stringValue\": \"$ADMIN_EMAIL\"},
      \"addedBy\": {\"stringValue\": \"setup-script\"},
      \"addedAt\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
    }
  }" > /dev/null 2>&1 || true

# Verify it was written (or already exists)
curl -s -X PATCH \
  "$FIRESTORE_URL/admins/$ADMIN_UID" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"fields\": {
      \"email\": {\"stringValue\": \"$ADMIN_EMAIL\"},
      \"addedBy\": {\"stringValue\": \"setup-script\"},
      \"addedAt\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
    }
  }"

echo ""
echo "Admin document written."

echo ""
echo "=== Seeding sample groups ==="

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Group 1
curl -s -X POST \
  "$FIRESTORE_URL/groups" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"fields\": {
      \"name\": {\"stringValue\": \"Group for Neural Theory (GNT) - ENS\"},
      \"keywords\": {\"arrayValue\": {\"values\": [
        {\"stringValue\": \"neural dynamics\"},
        {\"stringValue\": \"theoretical neuroscience\"},
        {\"stringValue\": \"statistical physics\"}
      ]}},
      \"summary\": {\"stringValue\": \"The Group for Neural Theory at ENS develops theoretical and computational approaches to understand brain function, combining tools from statistical physics, dynamical systems, and machine learning.\"},
      \"links\": {\"arrayValue\": {\"values\": [
        {\"mapValue\": {\"fields\": {
          \"label\": {\"stringValue\": \"Website\"},
          \"url\": {\"stringValue\": \"https://www.phys.ens.fr/~gnt/\"}
        }}}
      ]}},
      \"photoURL\": {\"stringValue\": \"\"},
      \"createdAt\": {\"timestampValue\": \"$NOW\"},
      \"updatedAt\": {\"timestampValue\": \"$NOW\"}
    }
  }" > /dev/null

echo "  Seeded: Group for Neural Theory (GNT) - ENS"

# Group 2
curl -s -X POST \
  "$FIRESTORE_URL/groups" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"fields\": {
      \"name\": {\"stringValue\": \"Institut de la Vision - Computational Neuroscience\"},
      \"keywords\": {\"arrayValue\": {\"values\": [
        {\"stringValue\": \"vision\"},
        {\"stringValue\": \"retinal processing\"},
        {\"stringValue\": \"neural coding\"}
      ]}},
      \"summary\": {\"stringValue\": \"Computational neuroscience teams at Institut de la Vision study how the retina and visual cortex encode and process visual information, using a combination of electrophysiology, modeling, and machine learning.\"},
      \"links\": {\"arrayValue\": {\"values\": [
        {\"mapValue\": {\"fields\": {
          \"label\": {\"stringValue\": \"Website\"},
          \"url\": {\"stringValue\": \"https://www.institut-vision.org/en/\"}
        }}}
      ]}},
      \"photoURL\": {\"stringValue\": \"\"},
      \"createdAt\": {\"timestampValue\": \"$NOW\"},
      \"updatedAt\": {\"timestampValue\": \"$NOW\"}
    }
  }" > /dev/null

echo "  Seeded: Institut de la Vision"

# Group 3
curl -s -X POST \
  "$FIRESTORE_URL/groups" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"fields\": {
      \"name\": {\"stringValue\": \"LNC2 - Laboratoire de Neurosciences Cognitives et Computationnelles\"},
      \"keywords\": {\"arrayValue\": {\"values\": [
        {\"stringValue\": \"decision making\"},
        {\"stringValue\": \"reinforcement learning\"},
        {\"stringValue\": \"cognitive modeling\"},
        {\"stringValue\": \"Bayesian inference\"}
      ]}},
      \"summary\": {\"stringValue\": \"LNC2 at ENS investigates the computational principles underlying human cognition, with a focus on decision-making, learning, and reasoning using behavioral experiments, neuroimaging, and computational modeling.\"},
      \"links\": {\"arrayValue\": {\"values\": [
        {\"mapValue\": {\"fields\": {
          \"label\": {\"stringValue\": \"Website\"},
          \"url\": {\"stringValue\": \"https://lnc2.dec.ens.fr/en\"}
        }}}
      ]}},
      \"photoURL\": {\"stringValue\": \"\"},
      \"createdAt\": {\"timestampValue\": \"$NOW\"},
      \"updatedAt\": {\"timestampValue\": \"$NOW\"}
    }
  }" > /dev/null

echo "  Seeded: LNC2"

echo ""
echo "=== Phase 2 Complete ==="
echo ""
echo "Your site is configured with:"
echo "  Project: $PROJECT_ID"
echo "  Admin:   $ADMIN_EMAIL"
echo "  UID:     $ADMIN_UID"
echo "  Groups:  3 sample groups seeded"
echo ""
echo "Next: push to GitHub and enable Pages."
