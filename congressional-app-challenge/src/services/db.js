import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase/config.js'

/**
 * Every Firestore read and write in the app lives here, so the React components
 * stay free of database code.
 *
 * Collections
 *   users/{uid}          private profile: role, zip, priorities, teen setup
 *   teens/{uid}          public listing a teen opts into via "List yourself"
 *   jobs/{jobId}         a job a parent posted
 *   applications/{id}    a teen applying to a job
 *   invites/{id}         a parent inviting a teen
 *   backgroundChecks/{uid}  written by the server only (see firestore.rules)
 *
 * The `subscribe*` helpers use onSnapshot, so a job posted by a parent shows up
 * in a teen's feed live, without a refresh.
 */

const usersRef = () => collection(db, 'users')
const teensRef = () => collection(db, 'teens')
const jobsRef = () => collection(db, 'jobs')
const applicationsRef = () => collection(db, 'applications')
const invitesRef = () => collection(db, 'invites')

const withId = (snapshot) => snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))

/* ---------------------------------------------------------------- */
/* Profile                                                           */
/* ---------------------------------------------------------------- */

export function subscribeProfile(uid, onChange, onError) {
  return onSnapshot(
    doc(usersRef(), uid),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  )
}

/** Creates the profile on first write and merges on every one after. */
export function saveProfile(uid, patch) {
  return setDoc(doc(usersRef(), uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
}

export function createProfile(uid, { email, displayName }) {
  return setDoc(
    doc(usersRef(), uid),
    { email, displayName, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  )
}

/* ---------------------------------------------------------------- */
/* Teens (the parent-facing directory)                               */
/* ---------------------------------------------------------------- */

export function subscribeTeens(onChange, onError) {
  return onSnapshot(teensRef(), (snap) => onChange(withId(snap)), onError)
}

/** "List yourself" — the teen's own uid is the document id, so one each. */
export function publishTeenListing(uid, profile) {
  return setDoc(
    doc(teensRef(), uid),
    {
      name: profile.name ?? '',
      age: Number(profile.age) || null,
      grade: profile.grade ?? '',
      services: profile.services ?? [],
      rate: Number(profile.rate) || 15,
      days: profile.days ?? [],
      bio: profile.bio ?? '',
      cpr: Boolean(profile.cpr),
      radius: Number(profile.radius) || 3,
      zip: profile.zip ?? '',
      rating: null,
      reviews: 0,
      distance: 0,
      verified: false,
      badges: ['Your listing'],
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export function unpublishTeenListing(uid) {
  return deleteDoc(doc(teensRef(), uid))
}

/* ---------------------------------------------------------------- */
/* Jobs                                                              */
/* ---------------------------------------------------------------- */

export function subscribeJobs(onChange, onError) {
  return onSnapshot(
    query(jobsRef(), orderBy('createdAt', 'desc')),
    (snap) => onChange(withId(snap)),
    onError,
  )
}

export function postJob(uid, job) {
  return addDoc(jobsRef(), {
    title: job.title,
    service: job.service,
    when: job.when,
    pay: Number(job.pay) || 0,
    payUnit: job.payUnit ?? 'hr',
    description: job.description ?? '',
    zip: job.zip ?? '',
    family: job.family ?? 'A local family',
    distance: 0,
    postedBy: uid,
    createdAt: serverTimestamp(),
  })
}

/* ---------------------------------------------------------------- */
/* Applications and invites                                          */
/* ---------------------------------------------------------------- */

export function subscribeApplications(uid, onChange, onError) {
  return onSnapshot(
    query(applicationsRef(), where('teenUid', '==', uid)),
    (snap) => onChange(withId(snap)),
    onError,
  )
}

/** Doc id is `{jobId}_{uid}` so applying twice is impossible by construction. */
export function applyToJob(uid, job) {
  return setDoc(doc(applicationsRef(), `${job.id}_${uid}`), {
    jobId: job.id,
    jobTitle: job.title,
    teenUid: uid,
    parentUid: job.postedBy ?? null,
    status: 'applied',
    createdAt: serverTimestamp(),
  })
}

export function subscribeInvites(uid, onChange, onError) {
  return onSnapshot(
    query(invitesRef(), where('parentUid', '==', uid)),
    (snap) => onChange(withId(snap)),
    onError,
  )
}

export function inviteTeen(parentUid, teenId) {
  return setDoc(doc(invitesRef(), `${parentUid}_${teenId}`), {
    parentUid,
    teenId,
    createdAt: serverTimestamp(),
  })
}

export function withdrawInvite(parentUid, teenId) {
  return deleteDoc(doc(invitesRef(), `${parentUid}_${teenId}`))
}

/* ---------------------------------------------------------------- */
/* Background check (server writes, client reads)                    */
/* ---------------------------------------------------------------- */

export function subscribeBackgroundCheck(uid, onChange, onError) {
  return onSnapshot(
    doc(collection(db, 'backgroundChecks'), uid),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  )
}

/** Marks a teen listing verified/unverified — used after a check completes. */
export function setTeenVerified(uid, verified) {
  return updateDoc(doc(teensRef(), uid), { verified })
}
