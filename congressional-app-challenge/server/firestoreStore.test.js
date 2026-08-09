import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createApp } from './app.js'
import { createFirestoreStore } from './firestoreStore.js'
import { createCheckrTestDouble } from './checkrTestDouble.js'

/**
 * Minimal stand-in for the Firestore Admin API — just the surface
 * createFirestoreStore uses. Same idea as checkrTestDouble: exercise our real
 * code without needing the service it talks to. (The actual Firestore emulator
 * needs Java, which isn't available here.)
 */
function fakeFirestore() {
  const collections = new Map()
  const store = (name) => {
    if (!collections.has(name)) collections.set(name, new Map())
    return collections.get(name)
  }

  const makeQuery = (name, filters) => ({
    where: (field, _op, value) => makeQuery(name, [...filters, { field, value }]),
    limit: (n) => ({
      async get() {
        const matches = [...store(name).values()]
          .filter((doc) => filters.every((f) => doc[f.field] === f.value))
          .slice(0, n)
        return { empty: matches.length === 0, docs: matches.map((d) => ({ data: () => d })) }
      },
    }),
    async get() {
      const matches = [...store(name).values()].filter((doc) =>
        filters.every((f) => doc[f.field] === f.value),
      )
      return { empty: matches.length === 0, docs: matches.map((d) => ({ data: () => d })) }
    },
  })

  return {
    _raw: collections,
    collection: (name) => ({
      doc: (id) => ({
        async set(data) {
          store(name).set(id, data)
        },
        async get() {
          const data = store(name).get(id)
          return { exists: data !== undefined, data: () => data }
        },
      }),
      where: (field, op, value) => makeQuery(name, [{ field, value }]).where(field, op, value),
    }),
  }
}

const fakeFirebaseAuth = {
  async verifyIdToken(token) {
    const match = /^id-token-for-(.+)$/.exec(token)
    if (!match) throw new Error('invalid token')
    return { uid: match[1] }
  },
}

describe('createFirestoreStore', () => {
  it('keys one check per user and round-trips it', async () => {
    const store = createFirestoreStore(fakeFirestore())

    const created = await store.create({ uid: 'user_1', candidateId: 'cand_1' })
    assert.equal(created.id, 'user_1')
    assert.equal(created.status, 'awaiting_candidate')

    const fetched = await store.get('user_1')
    assert.equal(fetched.candidateId, 'cand_1')
    assert.equal(await store.get('nobody'), null)
  })

  it('merges updates and refreshes updatedAt', async () => {
    const store = createFirestoreStore(fakeFirestore())
    await store.create({ uid: 'user_1' })

    const updated = await store.update('user_1', { status: 'complete', result: 'clear' })
    assert.equal(updated.status, 'complete')
    assert.equal(updated.result, 'clear')
    assert.ok(updated.createdAt) // preserved
    assert.equal(await store.update('missing', { status: 'complete' }), null)
  })

  it('strips undefined, which Firestore rejects', async () => {
    const db = fakeFirestore()
    const store = createFirestoreStore(db)
    await store.create({ uid: 'user_1', expiresAt: undefined, reportId: undefined })

    const written = db._raw.get('backgroundChecks').get('user_1')
    assert.ok(!Object.values(written).includes(undefined))
    assert.ok(!('expiresAt' in written) || written.expiresAt !== undefined)
  })

  it('finds a record by a Checkr id, the way webhooks arrive', async () => {
    const store = createFirestoreStore(fakeFirestore())
    await store.create({ uid: 'user_1', reportId: 'rep_9' })

    const found = await store.findBy(null, { field: 'reportId', value: 'rep_9' })
    assert.equal(found.id, 'user_1')
    assert.equal(await store.findBy(null, { field: 'reportId', value: 'rep_nope' }), null)
  })

  it('refuses to scan without a field, rather than silently reading everything', async () => {
    const store = createFirestoreStore(fakeFirestore())
    await assert.rejects(() => store.findBy(() => true), /cannot scan/)
  })
})

describe('the app works the same on either store', () => {
  it('runs a full check through the Firestore-backed store', async () => {
    const servers = []
    const listen = (app) =>
      new Promise((resolve) => {
        const s = app.listen(0, () => {
          servers.push(s)
          resolve(`http://127.0.0.1:${s.address().port}`)
        })
      })

    const checkrUrl = await listen(
      createCheckrTestDouble({
        apiKey: 'k',
        script: { pollsBeforeInvitationCompleted: 0, pollsBeforeReportComplete: 0 },
      }),
    )
    const url = await listen(
      createApp({
        apiKey: 'k',
        baseUrl: `${checkrUrl}/v1`,
        store: createFirestoreStore(fakeFirestore()),
        firebaseAuth: fakeFirebaseAuth,
        logger: {},
      }),
    )

    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer id-token-for-u1' }
    const created = await (
      await fetch(`${url}/api/background-checks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          firstName: 'Jordan',
          lastName: 'Alvarez',
          email: 'j@example.com',
          workState: 'CA',
        }),
      })
    ).json()
    assert.equal(created.id, 'u1')

    let latest
    for (let i = 0; i < 5; i += 1) {
      latest = await (
        await fetch(`${url}/api/background-checks/u1`, { headers })
      ).json()
      if (latest.status === 'complete') break
    }
    assert.equal(latest.status, 'complete')
    assert.equal(latest.result, 'clear')

    servers.forEach((s) => s.close())
  })
})
