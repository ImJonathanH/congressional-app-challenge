# TeenHands

**Quick jobs for teens. Trusted help for parents.**

TeenHands connects local teens with nearby families for the jobs neighbors already ask each other
for — **babysitting**, **dog walking**, and **coaching & tutoring**. Accounts and data live in
[Firebase](https://firebase.google.com); parents are background-checked through
[Checkr](https://checkr.com) before they can contact anyone; teens control how far they'll travel.

Built for the Congressional App Challenge.

---

## Running it

```bash
npm install
cp .env.example .env    # then fill in Firebase (and Checkr, if you have it)
npm run dev             # web on :5173, API on :8787
npm run seed            # load the demo teens and jobs into Firestore
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server **and** the API together |
| `npm run dev:web` | Vite only |
| `npm run server` | API only |
| `npm run seed` | Write the demo teens and jobs to Firestore |
| `npm run emulators` | Local Firebase Auth + Firestore (needs Java 11+) |
| `npm test` | Server tests |
| `npm run build` | Production bundle in `dist/` |
| `npm run lint` | oxlint |

The landing page works with no configuration at all. Everything past it needs Firebase, and shows
a setup screen until you add it.

## Architecture

Three pieces. The split exists because two of the keys involved are real secrets.

```
┌─────────────────────┐
│  BROWSER  (src/)    │
│  React + Vite       │
└──────────┬──────────┘
           │
           ├──────────────▶ Firebase Auth        sign up / sign in
           │
           ├──────────────▶ Cloud Firestore      profiles, teens, jobs,
           │                                     applications, invites
           │                 ▲                   (guarded by firestore.rules)
           │  /api           │
           ▼                 │ Admin SDK
┌─────────────────────┐      │
│  SERVER  (server/)  │──────┘
│  Node + Express     │
│  holds the secrets  │──────────────▶ Checkr API   background checks
└─────────────────────┘
```

The browser talks to Firebase directly — that's the point of Firebase, and `firestore.rules` is
what makes it safe. It does **not** talk to Checkr directly, because a background-check API key
can't ship in client code. Requests to `/api` carry a Firebase ID token, which the server verifies
with the Admin SDK before it will start or reveal a check.

## The flow

```
Landing (/)                                    Sign in (/signin)
   │  Get Started                                 │  returning users
   ▼                                              ▼
Survey (/start)
   │  1. ZIP code
   │  2. Parent or teen?
   │  3. Create account          ← Firebase Auth
   │
   ├── Parent ──▶ 4. Top priorities (skippable)
   │              5. Checkr background check   ──▶ Parent dashboard (/parent)
   │
   └── Teen ────▶ 4. Work radius, job types,
                     days, rate, bio           ──▶ Teen dashboard (/teen)
```

Sign in again later and you land back where you left off — the survey reads your Firestore profile
and skips ahead.

**Parent dashboard** — a sidebar filters and sorts teens by job type, distance, rate, and verified
status, with a smaller *Post a job* button. *Best match* is weighted by the priorities you picked.

**Teen dashboard** — a live feed of jobs parents posted, filtered to your work radius and job
types, with a smaller *List yourself* button that publishes your profile to the parent directory.
Because everything is an `onSnapshot` subscription, a job a parent posts appears in a teen's feed
without a refresh.

`/parent` requires a **completed Checkr report with a `clear` result** — `consider` doesn't unlock it.

## Firebase setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method → Email/Password → Enable.**
3. **Firestore Database → Create database.** Production mode is fine; the rules below replace the
   defaults.
4. **Project settings → Your apps → Web app.** Copy the config into the `VITE_FIREBASE_*` values
   in `.env`. These are public by design — see the note in `.env.example`.
5. **Project settings → Service accounts → Generate new private key.** Paste the JSON into
   `FIREBASE_SERVICE_ACCOUNT` on one line. **This one is a real secret.**
6. Deploy the rules: `npx firebase deploy --only firestore:rules`
7. `npm run seed` to load the demo teens and jobs.

### Data model

| Collection | Holds | Who can read | Who can write |
| --- | --- | --- | --- |
| `users/{uid}` | role, ZIP, priorities, teen setup | you | you |
| `teens/{uid}` | public teen listing | anyone signed in | that teen |
| `jobs/{jobId}` | a posted job | anyone signed in | cleared parents; author only |
| `applications/{id}` | teen → job | the teen and the job's parent | the teen (parent may accept) |
| `invites/{id}` | parent → teen | the parent | the parent |
| `backgroundChecks/{uid}` | Checkr status and result | you | **nobody** — server only |

That last row is the load-bearing one. Background-check results are written only by the Express
server through the Admin SDK, which bypasses rules. If clients could write them, anyone could mark
themselves cleared from the browser console and unlock the parent dashboard.

### Why not Cloud Functions?

Deploying Cloud Functions requires the **Blaze** (pay-as-you-go) plan, and the free Spark plan
blocks outbound requests to non-Google services — which is exactly what calling Checkr is. Keeping
that one job in the Express server means the whole app runs on the free tier.

## How the background check works

Checkr's [invitation flow](https://docs.checkr.com/): TeenHands creates the candidate and the
invitation, then hands the parent a Checkr-hosted link where **they** enter their SSN and date of
birth and sign the FCRA disclosure.

```
Browser                TeenHands API              Checkr
   │  POST /api/background-checks
   │  (+ Firebase ID token)
   │ ─────────────────────▶ │  verify token (Admin SDK)
   │                        │  POST /v1/candidates ─▶ │
   │                        │  POST /v1/invitations ▶ │
   │ ◀───────────────────── │   { invitation_url }
   │
   │  parent opens invitation_url ──────────────────▶ │  (SSN + DOB + consent
   │                                                  │   on Checkr's page)
   │  GET /api/background-checks/:id  (poll)
   │ ─────────────────────▶ │  GET /v1/reports/:id ─▶ │
   │                        │  write result to Firestore
   │ ◀══ onSnapshot ════════╡
                            │ ◀──── POST /api/webhooks/checkr (signed)
```

Two things that are load-bearing, not incidental:

- **The API key lives only on the server.** `src/services/backgroundCheck.js` talks to `/api`,
  never to Checkr.
- **TeenHands never handles an SSN.** The invitation flow keeps that PII inside Checkr, so this app
  doesn't store regulated identifiers it has no business storing.

### `clear` vs `consider`

A finished report is `clear` (nothing to review) or `consider` (something needs a human look).
`consider` is **not** an automatic rejection — under the FCRA the applicant is entitled to a copy
of the report, a pre-adverse-action notice, and a chance to dispute inaccuracies before you act on
it. The UI routes those parents to a manual-review message and leaves the dashboard locked; a real
deployment needs the adverse-action workflow behind it.

**Webhooks** are verified with HMAC-SHA256 over the raw request body, keyed with your API key
(`X-Checkr-Signature`). Point a Checkr webhook at `POST /api/webhooks/checkr`. Because webhooks
need a public URL, the client also polls — either path updates the same record.

## Testing

```bash
npm test
```

22 tests covering the server. Two stand-ins make this possible without live credentials:

- **`server/checkrTestDouble.js`** — a fake Checkr API (Basic auth, snake_case, `clear`/`consider`).
- **`fakeFirestore()` in `server/firestoreStore.test.js`** — the slice of the Firestore Admin API
  the store uses.

Neither ships at runtime; they exist so the *real* integration code gets exercised. Coverage
includes the happy path, a `consider` result, missing keys, a Checkr rejection, webhook signature
tampering, unauthenticated requests, one user trying to read another's screening result, and the
fact that no candidate PII comes back to the browser.

The **client** has no automated tests. The Firebase emulator suite would be the way to add them,
but it needs Java 11+.

## Dependencies

`npm audit` should report **0 vulnerabilities**. Two things keep it there:

- **`firebase-admin` must stay on 14.x.** Older majors pull a vulnerable `protobufjs` (critical)
  and `jsonwebtoken` 8 (high). v14 requires Node ≥ 22.
- **The `uuid` override in `package.json`.** `@google-cloud/storage` (an optional dependency of
  firebase-admin that this app never actually uses) still asks for `uuid@9`, which has a moderate
  advisory. The override forces `^11.1.1` — the lowest patched version that still ships a
  CommonJS build. uuid 13+ is ESM-only and breaks `require('uuid')` inside `gaxios`.

⚠️ **Do not run `npm audit fix --force`.** npm's suggested "fix" here is to *downgrade*
firebase-admin to 10.3.0, which reintroduces the critical and high advisories. If audit ever goes
red again, check `npm ls firebase-admin` first — an unexpectedly old version is the usual cause.

## Going to production

1. A Checkr account with a signed agreement — production keys need business verification, and
   screening people who work with minors has extra requirements.
2. An adverse-action workflow for `consider` results.
3. Distance is currently a hardcoded field on each record, not computed. Real matching needs
   geocoding of ZIPs and a distance calculation.
4. Ratings and reviews are demo values. Nothing writes them yet.
5. Firestore rules deserve tests (`@firebase/rules-unit-testing`, which also needs Java).

## Project structure

```
server/                       Node + Express — holds the secrets
  index.js                    env config + listen
  app.js                      routes: background checks, webhook, config
  checkr.js                   Checkr client + webhook signature verification
  firebaseAdmin.js            Admin SDK init + ID-token middleware
  firestoreStore.js           check records in Firestore
  store.js                    same interface, in-memory (tests/dev)
  checkrTestDouble.js         fake Checkr — not used at runtime
  *.test.js                   server tests

src/                          React — what people see
  App.jsx                     routes + onboarding guards
  firebase/config.js          Firebase client init
  services/db.js              every Firestore read and write
  services/backgroundCheck.js talks to /api only
  state/AuthProvider.jsx      Firebase Auth session
  state/AppContext.jsx        live Firestore subscriptions
  pages/                      Landing, SignIn, Survey, both dashboards, SetupNeeded
  components/                 Logo, Avatar, Modal, DashboardShell
  data/                       job types, and the demo records `npm run seed` writes

firestore.rules               the actual access control
firebase.json                 rules + emulator config
scripts/seed.js               loads demo data into Firestore
```

## Tech

React 19 · Vite · React Router · Firebase (Auth + Firestore) · Express · Firebase Admin · plain CSS
with custom properties · Montserrat, self-hosted via `@fontsource`. No component or CSS framework.
