/**
 * Firestore-backed background-check store.
 *
 * Same interface as createStore() in store.js, so app.js doesn't care which one
 * it got. This is the one that matters in production: a Checkr report can take
 * days, and the in-memory version forgets everything on restart.
 *
 * One document per user (`backgroundChecks/{uid}`) — a person has one check.
 * Clients can read their own and can never write one; see firestore.rules.
 */
export function createFirestoreStore(db, { collectionName = 'backgroundChecks' } = {}) {
  const col = () => db.collection(collectionName)

  /** Firestore rejects undefined values, and we write partial patches a lot. */
  const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))

  return {
    async create(fields) {
      const uid = fields.uid
      if (!uid) throw new Error('createFirestoreStore.create requires a uid')

      const now = new Date().toISOString()
      const record = clean({
        id: uid,
        status: 'awaiting_candidate',
        result: null,
        assessment: null,
        reportId: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        ...fields,
      })

      await col().doc(uid).set(record)
      return record
    },

    async get(id) {
      const snap = await col().doc(id).get()
      return snap.exists ? snap.data() : null
    },

    async update(id, updates) {
      const ref = col().doc(id)
      const snap = await ref.get()
      if (!snap.exists) return null

      const next = { ...snap.data(), ...clean(updates), updatedAt: new Date().toISOString() }
      await ref.set(next)
      return next
    },

    /**
     * Webhooks arrive with Checkr's ids, not ours, so look up by field.
     * Both fields are indexed single-field by default in Firestore.
     */
    async findBy(_predicate, { field, value } = {}) {
      if (!field) {
        throw new Error('createFirestoreStore.findBy needs { field, value } — it cannot scan')
      }
      const snap = await col().where(field, '==', value).limit(1).get()
      return snap.empty ? null : snap.docs[0].data()
    },
  }
}
