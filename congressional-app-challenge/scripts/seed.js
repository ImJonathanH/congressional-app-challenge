/**
 * Loads the demo teens and jobs into Firestore.
 *
 *   npm run seed
 *
 * Uses the Admin SDK, so it needs the same FIREBASE_SERVICE_ACCOUNT credentials
 * as the server (or a running emulator). Safe to re-run: every document has a
 * fixed id, so it overwrites rather than duplicating.
 *
 * These are demo listings, not real people. Delete them before you ever put
 * this in front of actual families.
 */
import { initFirebaseAdmin } from '../server/firebaseAdmin.js'
import { SEED_JOBS, SEED_TEENS } from '../src/data/seed.js'

const { configured, db } = initFirebaseAdmin()

if (!configured) {
  console.error('Firebase Admin is not configured.')
  console.error('Set FIREBASE_SERVICE_ACCOUNT in .env (see .env.example), then try again.')
  process.exit(1)
}

const run = async () => {
  const batch = db.batch()

  for (const teen of SEED_TEENS) {
    const { id, ...data } = teen
    batch.set(db.collection('teens').doc(id), { ...data, seeded: true })
  }

  for (const job of SEED_JOBS) {
    const { id, ...data } = job
    batch.set(db.collection('jobs').doc(id), {
      ...data,
      seeded: true,
      // Ordered by createdAt in the app, so give the seeds real timestamps
      // spread over the last week rather than all landing at once.
      createdAt: new Date(Date.now() - Math.random() * 7 * 864e5),
    })
  }

  await batch.commit()
  console.log(`Seeded ${SEED_TEENS.length} teens and ${SEED_JOBS.length} jobs.`)
}

run().then(
  () => process.exit(0),
  (error) => {
    console.error('Seeding failed:', error.message)
    process.exit(1)
  },
)
