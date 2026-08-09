# TeenHands

**Quick jobs for teens. Trusted help for parents.**

TeenHands connects local teens with nearby families for the jobs neighbors already ask each other
for — **babysitting**, **dog walking**, and **coaching & tutoring**. Parents are background-checked
through [Checkr](https://checkr.com) before they can contact anyone; teens control how far they're
willing to travel.

Built for the Congressional App Challenge.

---

## Running it

```bash
npm install
cp .env.example .env    # then add your Checkr API key
npm run dev             # web on :5173, API on :8787
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server **and** the API together |
| `npm run dev:web` | Vite only |
| `npm run server` | API only (reads `.env` if present) |
| `npm test` | Server integration tests |
| `npm run build` | Production bundle in `dist/` |
| `npm run lint` | oxlint |

Without a `CHECKR_API_KEY` the site runs fine and the verification step tells you it's unavailable
instead of pretending to screen anyone.

## The flow

```
Landing (/)
   │  Get Started
   ▼
Survey (/start)
   │  1. ZIP code
   │  2. Parent or teen?
   │
   ├── Parent ──▶ 3. Top priorities (skippable)
   │              4. Checkr background check   ──▶ Parent dashboard (/parent)
   │
   └── Teen ────▶ 3. Work radius, job types,
                     days, rate, bio           ──▶ Teen dashboard (/teen)
```

**Parent dashboard** — a sidebar filters and sorts teens by job type, distance, rate, and verified
status, with a smaller *Post a job* button. The *Best match* sort is weighted by the priorities
picked during onboarding.

**Teen dashboard** — a feed of jobs parents have posted, filtered to the teen's own work radius and
job types, with a smaller *List yourself* button that publishes their profile into the parent-facing
directory.

Both dashboards are guarded. `/parent` requires a **completed Checkr report with a `clear` result** —
a `consider` result does not unlock it.

## How the background check works

Checkr's [invitation flow](https://docs.checkr.com/): TeenHands creates the candidate and the
invitation, then hands the parent a Checkr-hosted link where **they** enter their SSN and date of
birth and sign the FCRA disclosure.

```
Browser                TeenHands API              Checkr
   │  POST /api/background-checks
   │ ─────────────────────▶ │  POST /v1/candidates
   │                        │ ────────────────────▶ │
   │                        │  POST /v1/invitations
   │                        │ ────────────────────▶ │
   │ ◀───────────────────── │   { invitation_url }
   │
   │  parent opens invitation_url ──────────────────▶ │  (SSN + DOB + consent
   │                                                  │   entered on Checkr's page)
   │  GET /api/background-checks/:id  (poll)
   │ ─────────────────────▶ │  GET /v1/invitations/:id
   │                        │  GET /v1/reports/:id ─▶ │
   │ ◀───────────────────── │   { status, result }
                            │ ◀──── POST /api/webhooks/checkr (signed)
```

Two things that are load-bearing, not incidental:

- **The API key lives only on the server.** A Checkr secret key in browser code is readable by
  anyone who opens devtools. `src/services/backgroundCheck.js` talks to `/api`, never to Checkr.
- **TeenHands never handles an SSN.** The invitation flow keeps that PII inside Checkr, which means
  this app is not storing regulated identifiers it has no business storing.

### `clear` vs `consider`

A finished report is `clear` (nothing to review) or `consider` (something needs a human look).
`consider` is **not** an automatic rejection — under the FCRA the applicant is entitled to a copy
of the report, a pre-adverse-action notice, and a chance to dispute inaccuracies before you act on
it. The UI routes those parents to a manual-review message and leaves the dashboard locked; a real
deployment needs the adverse-action workflow behind it.

### Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `CHECKR_API_KEY` | — | Secret key from Checkr → Developer Settings. Server-only. |
| `CHECKR_ENVIRONMENT` | `staging` | `staging` or `production`. Defaults to staging so a misconfiguration can't bill a real screening. |
| `CHECKR_PACKAGE` | `tasker_standard` | Package slugs are account-specific; check your Checkr dashboard. |
| `PORT` | `8787` | Vite proxies `/api` here in dev. |
| `CHECKR_API_BASE_URL` | — | Overrides the environment. Used by the tests. |

**Webhooks** are verified with HMAC-SHA256 over the raw request body, keyed with your API key
(`X-Checkr-Signature`). Point a Checkr webhook at `POST /api/webhooks/checkr`. Because webhooks need
a public URL, the client also polls — either path updates the same record, so local development
works without a tunnel.

### Testing without credentials

`server/checkrTestDouble.js` is a stand-in for the Checkr API — Basic auth, snake_case fields,
`clear`/`consider` results. It is **not** used at runtime; it exists so `npm test` can drive the
real integration code end to end. The suite covers the happy path, a `consider` result, a missing
API key, a Checkr rejection, webhook signature verification, and the fact that no candidate PII
comes back to the browser.

```bash
npm test
```

## Going to production

1. A Checkr account with a signed agreement — Checkr verifies businesses before issuing production
   keys, and screening minors or people working with minors has extra requirements.
2. Swap `server/store.js` for a database. It's an in-memory `Map` right now, so a restart forgets
   every check in flight, and real reports can take days.
3. Real accounts and sessions. There is no auth yet; anyone can claim to be any parent.
4. An adverse-action workflow for `consider` results (pre-adverse notice, waiting period, dispute
   handling).

## Project structure

```
server/
  index.js                    env config + listen
  app.js                      routes: background checks, webhook, config
  checkr.js                   Checkr API client + webhook signature verification
  store.js                    in-memory check records (no PII)
  checkrTestDouble.js         fake Checkr for tests — not used at runtime
  app.test.js                 integration tests

src/
  App.jsx                     routes + onboarding guards
  index.css                   design tokens, Montserrat, shared controls
  components/                 Logo, Avatar, Modal, DashboardShell
  data/services.js            the three job types + parent priorities
  data/seed.js                demo teens and jobs
  pages/                      Landing, Survey, ParentDashboard, TeenDashboard
  services/backgroundCheck.js client side of the check — talks to /api only
  state/AppContext.jsx        session state, persisted to localStorage
  state/appContext.js         the useApp() hook
```

## Tech

React 19 · Vite · React Router · Express · plain CSS with custom properties · Montserrat
(self-hosted via `@fontsource`, so the app renders identically offline). No component or CSS
framework.

## Data

Teens, jobs, and reviews are demo content in `src/data/seed.js`. Background checks are real Checkr
API calls. Session state lives in `localStorage` — *Sign out* clears it.
