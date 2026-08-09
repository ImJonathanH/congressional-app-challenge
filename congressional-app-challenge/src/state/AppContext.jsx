import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppContext } from './appContext.js'
import { useAuth } from './authContext.js'
import * as db from '../services/db.js'

/**
 * Session state, backed by Firestore.
 *
 * Everything here is a live subscription: a job a parent posts appears in a
 * teen's feed without a refresh, and the background-check result written by the
 * Express server lands on the parent's screen the moment Checkr finishes.
 *
 * Nothing is cached in localStorage any more — the signed-in Firebase user is
 * the identity, and Firestore is the single source of truth.
 */
export function AppProvider({ children }) {
  const { uid } = useAuth()

  const [profile, setProfile] = useState(null)
  const [teens, setTeens] = useState([])
  const [jobs, setJobs] = useState([])
  const [applications, setApplications] = useState([])
  const [invites, setInvites] = useState([])
  const [verification, setVerification] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const onError = useCallback((e) => setError(e.message), [])

  // Per-user documents. Torn down and rebuilt when the signed-in user changes.
  useEffect(() => {
    if (!uid) {
      setProfile(null)
      setApplications([])
      setInvites([])
      setVerification(null)
      setLoading(false)
      return undefined
    }

    setLoading(true)
    const unsubscribes = [
      db.subscribeProfile(
        uid,
        (next) => {
          setProfile(next)
          setLoading(false)
        },
        onError,
      ),
      db.subscribeApplications(uid, setApplications, onError),
      db.subscribeInvites(uid, setInvites, onError),
      db.subscribeBackgroundCheck(uid, setVerification, onError),
    ]
    return () => unsubscribes.forEach((fn) => fn())
  }, [uid, onError])

  // Shared collections. Readable by anyone signed in, so they don't depend on uid.
  useEffect(() => {
    if (!uid) return undefined
    const unsubscribes = [db.subscribeTeens(setTeens, onError), db.subscribeJobs(setJobs, onError)]
    return () => unsubscribes.forEach((fn) => fn())
  }, [uid, onError])

  const value = useMemo(() => {
    const applicationJobIds = applications.map((a) => a.jobId)
    const invitedTeenIds = invites.map((i) => i.teenId)

    return {
      uid,
      loading,
      error,

      // Profile fields, flattened so components read them the same way as before.
      profile,
      role: profile?.role ?? null,
      zip: profile?.zip ?? '',
      priorities: profile?.priorities ?? [],
      teenProfile: profile?.teenProfile ?? null,
      listed: Boolean(profile?.listed),
      verification,

      teens,
      jobs,
      applications: applicationJobIds,
      invites: invitedTeenIds,
      postedJobs: jobs.filter((j) => j.postedBy === uid),

      /* ---- writes ---- */

      setRole: (role) => db.saveProfile(uid, { role }),
      setZip: (zip) => db.saveProfile(uid, { zip }),
      setPriorities: (priorities) => db.saveProfile(uid, { priorities }),
      setTeenProfile: (teenProfile) => db.saveProfile(uid, { teenProfile }),

      postJob: (job) =>
        db.postJob(uid, {
          ...job,
          zip: job.zip || profile?.zip || '',
          family: profile?.displayName ? `The ${profile.displayName.split(' ').pop()} Family` : undefined,
        }),

      applyToJob: (jobId) => {
        const job = jobs.find((j) => j.id === jobId)
        return job ? db.applyToJob(uid, job) : Promise.resolve()
      },

      toggleInvite: (teenId) =>
        invitedTeenIds.includes(teenId)
          ? db.withdrawInvite(uid, teenId)
          : db.inviteTeen(uid, teenId),

      /** Publishes the teen into the parent-facing directory. */
      listSelf: async (teenProfile) => {
        await db.saveProfile(uid, { teenProfile, listed: true })
        await db.publishTeenListing(uid, { ...teenProfile, zip: profile?.zip ?? '' })
      },
    }
  }, [uid, loading, error, profile, verification, teens, jobs, applications, invites])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
