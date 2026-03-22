# Computational Neuroscience in Paris

A directory of computational neuroscience research groups in the Paris area. Static site hosted on GitHub Pages with Firebase backend.

**Live site**: https://jmourabarbosa.github.io/compneuroparis/

## Architecture

- **Frontend**: Plain HTML/CSS/JS (no build step), hosted on GitHub Pages
- **Backend**: Firebase (Auth, Firestore)

## Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project
2. Enable **Email/Password** authentication (Authentication > Sign-in method)
3. Create a **Firestore Database** (in production mode)
4. Register a **Web App** and copy the config

### 2. Configure the App

Edit `js/firebase-config.js` and replace the placeholder values with your Firebase config:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Firestore Security Rules

In the Firebase Console, go to Firestore > Rules and deploy:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null
        && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    // Groups: public read, admin write
    match /groups/{groupId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    // Submissions: public create, admin read/write
    match /submissions/{subId} {
      allow create: if true;
      allow read, update, delete: if isAdmin();
    }

    // Admins: admin only
    match /admins/{uid} {
      allow read, write: if isAdmin();
    }
  }
}
```

### 4. Create First Admin

1. In Firebase Console > Authentication, manually create a user (email + password)
2. Copy the user's **UID**
3. In Firestore, create a document in the `admins` collection with:
   - Document ID = the UID
   - Fields: `email` (string), `addedBy` (string, "manual"), `addedAt` (timestamp)

### 5. Seed Sample Data (Optional)

Add documents to the `groups` collection in Firestore:

```json
{
  "name": "Example Lab",
  "keywords": ["neural coding", "computational modeling"],
  "summary": "A research group focused on...",
  "links": [{"label": "Website", "url": "https://example.com"}],
  "photoURL": "",
  "createdAt": "<server timestamp>",
  "updatedAt": "<server timestamp>"
}
```

### 6. Deploy to GitHub Pages

1. Push all files to the `main` branch
2. Go to repo Settings > Pages
3. Set source to "Deploy from a branch", select `main` / `/ (root)`
4. The site will be live at `https://jmourabarbosa.github.io/compneuroparis/`

## Testing

Run the automated ownership tests with:

```bash
npm test
```

Run the site locally for browser profiling with:

```bash
npm run serve
```

Then open `http://localhost:4173/index.html`.

## One-click profile image migration workflow

To move existing profile photos away from fragile external URLs with one click:

1. Deploy the Firebase functions changes.
2. Open `migrate-profile-images.html` as an admin.
3. Click **Migrate external profile images**.

The callable migrates each external image server-side into managed storage, then updates the live Firestore `groups` documents automatically.

This keeps backward compatibility because `photoURL` remains the same field during rollout:

- migrated profiles use Firebase-managed image URLs
- any remaining unmigrated profiles can keep their existing external `http(s)` URLs until they are processed

This currently covers:

- auto-claim behavior when a user-submitted PI is approved
- claimant reconciliation rules for admin ownership assignment and clearing

## Local stress-testing workflow

Use this workflow when checking whether the site still feels slow after a change:

1. Start the local server with `npm run serve`.
2. Open Chrome DevTools on `http://localhost:4173/index.html`.
3. In the Network tab:
   - enable **Disable cache**
   - test once with normal network
   - test once with **Slow 4G**
4. In the Performance tab:
   - test once with normal CPU
   - test once with **4x CPU slowdown**
5. Record timings for:
   - first page load
   - first PI card render
   - search responsiveness
   - first PI detail open
   - first edit modal open
   - admin workspace open
6. Repeat the same actions a second time to compare warm vs cold behavior.

Useful local checks:

- Lighthouse performance pass on the homepage
- DevTools Performance recording around first edit modal open
- Network waterfall for Firebase Auth / Firestore / callable requests

## Security review checklist

The app is a static frontend with Firebase Auth, Firestore, and Cloud Functions. For each security pass, verify:

1. Hosting headers are present on deployed pages.
   - `Content-Security-Policy`
   - `Referrer-Policy`
   - `X-Content-Type-Options`
   - `X-Frame-Options`
   - `Permissions-Policy`

2. Public write surfaces are still intentional.
   - anonymous: `reports`, `messages`
   - authenticated: `claims`, `institutes`, `jobs`

3. Admin-only callables still reject non-admins.
   - `listUsers`
   - `deleteUser`
   - `updateUser`
   - `verifyUser`
   - `setGroupClaim`

4. Frontend HTML injection points remain escaped.
   - review every `innerHTML` write touching user-controlled or Firestore-controlled values

## Auth persistence

The app now supports an explicit **Remember me on this device** option in auth entry points.

- checked: persistent login across browser restarts
- unchecked: session-only login

This keeps persistence explicit instead of silently remembering users by default.

## File Structure

```
/
├── index.html              # Single page with all sections and modals
├── css/styles.css          # Full styling (responsive, cards, modals)
├── js/
│   ├── firebase-config.js  # Firebase SDK init (CDN imports)
│   ├── db.js               # Firestore CRUD helpers
│   ├── auth.js             # Firebase Auth (login, logout, state)
│   ├── ui-groups.js        # Render group cards, search/filter
│   ├── ui-form.js          # Submission form handling
│   ├── ui-admin.js         # Admin panel (pending, manage, admins)
│   └── app.js              # Main entry point
├── assets/
│   └── placeholder-lab.svg # Default group avatar
├── .nojekyll               # Prevent Jekyll processing
└── README.md               # This file
```

## Firestore Collections

| Collection | Purpose | Access |
|---|---|---|
| `groups` | Approved research groups | Public read, admin write |
| `submissions` | Pending group submissions | Public create, admin read/write |
| `admins` | Admin user registry | Admin only |
