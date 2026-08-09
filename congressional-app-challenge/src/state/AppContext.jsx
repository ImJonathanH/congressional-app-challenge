import { useEffect, useMemo, useState } from 'react'
import { AppContext } from './appContext.js'
import { SEED_JOBS, SEED_TEENS } from '../data/seed.js'

const STORAGE_KEY = 'teenhands.v1'

const EMPTY = {
  /** 'parent' | 'teen' | null */
  role: null,
  zip: '',
  /** Parent-only */
  priorities: [],
  verification: null,
  /** Teen-only */
  teenProfile: null,
  /** Job ids the signed-in teen has applied to */
  applications: [],
  /** Teen ids the signed-in parent has invited */
  invites: [],
  /** Jobs the signed-in parent has posted (prepended to the seed list) */
  postedJobs: [],
  /** Teen listings created from "List yourself" */
  listedTeens: [],
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
  } catch {
    return EMPTY
  }
}

export function AppProvider({ children }) {
  const [state, setState] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage disabled — the session just won't persist */
    }
  }, [state])

  const value = useMemo(() => {
    const patch = (updates) => setState((s) => ({ ...s, ...updates }))

    return {
      ...state,

      /** Every job a teen can browse: parent-posted first, then seeds. */
      jobs: [...state.postedJobs, ...SEED_JOBS],
      /** Every teen a parent can browse, including self-listings. */
      teens: [...state.listedTeens, ...SEED_TEENS],

      patch,

      setRole: (role) => patch({ role }),
      setZip: (zip) => patch({ zip }),
      setPriorities: (priorities) => patch({ priorities }),
      setVerification: (verification) => patch({ verification }),
      setTeenProfile: (teenProfile) => patch({ teenProfile }),

      postJob: (job) =>
        setState((s) => ({
          ...s,
          postedJobs: [
            {
              ...job,
              id: `j-${Date.now()}`,
              postedBy: 'me',
              postedAt: 'Just now',
              zip: job.zip || s.zip,
              distance: 0,
            },
            ...s.postedJobs,
          ],
        })),

      applyToJob: (jobId) =>
        setState((s) =>
          s.applications.includes(jobId)
            ? s
            : { ...s, applications: [...s.applications, jobId] },
        ),

      toggleInvite: (teenId) =>
        setState((s) => ({
          ...s,
          invites: s.invites.includes(teenId)
            ? s.invites.filter((id) => id !== teenId)
            : [...s.invites, teenId],
        })),

      /** Publishes the signed-in teen into the parent-facing directory. */
      listSelf: (profile) =>
        setState((s) => ({
          ...s,
          teenProfile: profile,
          listedTeens: [
            {
              id: 'me',
              name: profile.name || 'You',
              age: Number(profile.age) || 16,
              grade: profile.grade || '',
              services: profile.services,
              rate: Number(profile.rate) || 15,
              rating: null,
              reviews: 0,
              distance: 0,
              verified: false,
              cpr: Boolean(profile.cpr),
              badges: ['Your listing'],
              days: profile.days || [],
              bio: profile.bio || '',
              isSelf: true,
            },
            ...s.listedTeens.filter((t) => t.id !== 'me'),
          ],
        })),

      reset: () => setState(EMPTY),
    }
  }, [state])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
