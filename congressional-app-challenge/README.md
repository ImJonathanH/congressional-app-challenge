# TeenHands

**Quick jobs for teens. Trusted help for parents.**

TeenHands connects local teens with nearby families for the jobs neighbors already ask each other
for — **babysitting**, **dog walking**, and **coaching & tutoring**. Parents are background-checked
before they can contact anyone; teens control how far they're willing to travel.

Built for the Congressional App Challenge.

---

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the production build
npm run lint     # oxlint
```

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
   │              4. Raptor background check  ──▶ Parent dashboard (/parent)
   │
   └── Teen ────▶ 3. Work radius, job types,
                     days, rate, bio         ──▶ Teen dashboard (/teen)
```

**Parent dashboard** — a sidebar filters and sorts teens by job type, distance, rate, and verified
status, with a smaller *Post a job* button for parents who'd rather have teens come to them. The
*Best match* sort is weighted by the priorities picked during onboarding.

**Teen dashboard** — a feed of jobs parents have posted, filtered to the teen's own work radius and
job types, with a smaller *List yourself* button that publishes their profile into the parent-facing
directory. Jobs posted by a parent show up in the teen feed immediately.

Both dashboards are guarded: visiting `/parent` or `/teen` without finishing onboarding redirects
back to the survey.

## Project structure

```
src/
  App.jsx                       routes + onboarding guards
  index.css                     design tokens, Montserrat, shared controls
  components/                   Logo, Avatar, Modal, DashboardShell
  data/services.js              the three job types + parent priorities
  data/seed.js                  demo teens and jobs
  pages/                        Landing, Survey, ParentDashboard, TeenDashboard
  services/raptorVerification.js  background-check integration (SIMULATED)
  state/AppContext.jsx          session state, persisted to localStorage
  state/appContext.js           the useApp() hook
```

## ⚠️ About the background check

`src/services/raptorVerification.js` **simulates** a Raptor Technologies screening. It does not
contact Raptor and it does not screen anyone — it exists so the onboarding flow is complete and
demoable end to end.

Going live requires three things this prototype does not have:

1. **A Raptor account and API credentials.**
2. **A server.** A criminal-background API key can never ship in browser code. The check has to run
   on a backend that the client calls.
3. **FCRA compliance.** Background-check results are regulated personal data in the US. You need the
   subject's written consent (the consent checkbox is the UI for this) and an adverse-action process
   before you can act on a result.

The module's function signatures match the shape a real integration would take, so swapping in a
call to your own backend is a contained change.

## Tech

React 19 · Vite · React Router · plain CSS with custom properties · Montserrat (self-hosted via
`@fontsource`, so the app renders identically offline). No component or CSS framework.

## Data

All teens, jobs, and reviews are demo content in `src/data/seed.js`. Session state lives in
`localStorage` — *Sign out* clears it and returns you to the landing page.
