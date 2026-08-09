import { useMemo, useState } from 'react'
import DashboardShell from '../components/DashboardShell.jsx'
import Modal from '../components/Modal.jsx'
import { useApp } from '../state/appContext.js'
import { SERVICES, WEEKDAYS, serviceEmoji, serviceLabel } from '../data/services.js'
import './Dashboard.css'

const SORTS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'distance', label: 'Closest first' },
  { id: 'pay', label: 'Highest pay' },
]

export default function TeenDashboard() {
  const app = useApp()
  const profile = app.teenProfile ?? {}

  const [service, setService] = useState('all')
  const [matchMyServices, setMatchMyServices] = useState(true)
  const [radius, setRadius] = useState(profile.radius ?? 3)
  const [sort, setSort] = useState('newest')
  const [showListing, setShowListing] = useState(false)
  const [listed, setListed] = useState(app.listedTeens.some((t) => t.id === 'me'))

  const jobs = useMemo(() => {
    const filtered = app.jobs.filter((j) => {
      if (j.distance > radius) return false
      if (service !== 'all' && j.service !== service) return false
      if (matchMyServices && profile.services?.length && !profile.services.includes(j.service))
        return false
      return true
    })

    const sorters = {
      newest: () => 0, // already newest-first
      distance: (a, b) => a.distance - b.distance,
      pay: (a, b) => b.pay - a.pay,
    }
    return [...filtered].sort(sorters[sort])
  }, [app.jobs, radius, service, matchMyServices, profile.services, sort])

  const sidebar = (
    <>
      <section className="panel card">
        <h2 className="panel-title">Find jobs</h2>

        <div className="filter-block">
          <label className="field-label" htmlFor="teen-radius">
            My work radius <strong className="filter-value">{radius} mi</strong>
          </label>
          <input
            id="teen-radius"
            className="radius-slider"
            type="range"
            min="1"
            max="15"
            value={radius}
            onChange={(e) => {
              const next = Number(e.target.value)
              setRadius(next)
              app.setTeenProfile({ ...profile, radius: next })
            }}
          />
          <p className="panel-note">Only jobs inside this radius show up.</p>
        </div>

        <div className="filter-block">
          <span className="field-label">Job type</span>
          <div className="filter-list">
            <label className={`filter-radio${service === 'all' ? ' is-on' : ''}`}>
              <input
                type="radio"
                name="teen-service"
                checked={service === 'all'}
                onChange={() => setService('all')}
              />
              <span>All job types</span>
            </label>
            {SERVICES.map((s) => (
              <label key={s.id} className={`filter-radio${service === s.id ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="teen-service"
                  checked={service === s.id}
                  onChange={() => setService(s.id)}
                />
                <span>
                  {s.emoji} {s.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={matchMyServices}
            onChange={(e) => setMatchMyServices(e.target.checked)}
          />
          <span>Only what I signed up for</span>
        </label>

        <div className="filter-block filter-block-last">
          <label className="field-label" htmlFor="teen-sort">
            Sort by
          </label>
          <select
            id="teen-sort"
            className="select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="panel card">
        <h2 className="panel-title">My profile</h2>
        <ul className="mini-list">
          <li>
            <span className="mini-list-title">${profile.rate}/hr</span>
            <span className="mini-list-meta">Your rate</span>
          </li>
          <li>
            <span className="mini-list-title">
              {(profile.services ?? []).map(serviceLabel).join(', ') || 'None yet'}
            </span>
            <span className="mini-list-meta">Jobs you take</span>
          </li>
          <li>
            <span className="mini-list-title">{(profile.days ?? []).join(' · ') || 'Not set'}</span>
            <span className="mini-list-meta">Free days</span>
          </li>
        </ul>
        <p className="panel-note">
          {listed
            ? '✓ You are listed — parents can find and invite you.'
            : 'You are not listed yet. Parents can only find you if you list yourself.'}
        </p>
      </section>

      {app.applications.length > 0 && (
        <section className="panel card">
          <h2 className="panel-title">My applications</h2>
          <ul className="mini-list">
            {app.applications.map((id) => {
              const job = app.jobs.find((j) => j.id === id)
              if (!job) return null
              return (
                <li key={id}>
                  <span className="mini-list-title">{job.title}</span>
                  <span className="mini-list-meta">Awaiting reply from {job.family}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )

  return (
    <DashboardShell
      name={profile.name || 'You'}
      subtitle={`Teen · ZIP ${app.zip} · ${radius} mi radius`}
      sidebar={sidebar}
      action={
        <div className="dash-head">
          <div>
            <h1 className="dash-title">Jobs near you</h1>
            <p className="dash-sub">
              {jobs.length} open {jobs.length === 1 ? 'job' : 'jobs'} within {radius} miles
            </p>
          </div>
          <div className="dash-head-actions">
            {/* Smaller than the job feed on purpose — applying is the main path. */}
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() => setShowListing(true)}
            >
              {listed ? 'Edit my listing' : '+ List yourself'}
            </button>
          </div>
        </div>
      }
    >
      {!listed && (
        <div className="banner banner-quiet">
          <span>
            Parents can&apos;t find you until you list yourself. It takes about 30 seconds.
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowListing(true)}
          >
            List yourself
          </button>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="empty card">
          <p className="empty-title">Nothing open in your radius right now</p>
          <p className="empty-body">
            Widen your work radius or turn off &ldquo;only what I signed up for&rdquo; to see more
            jobs.
          </p>
        </div>
      ) : (
        <div className="job-list">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              applied={app.applications.includes(job.id)}
              onApply={() => app.applyToJob(job.id)}
            />
          ))}
        </div>
      )}

      <ListingModal
        open={showListing}
        profile={profile}
        onClose={() => setShowListing(false)}
        onSave={(next) => {
          app.listSelf(next)
          setListed(true)
          setShowListing(false)
        }}
      />
    </DashboardShell>
  )
}

function JobCard({ job, applied, onApply }) {
  return (
    <article className="job-card card">
      <div className="job-card-main">
        <div className="job-card-head">
          <span className="tag">
            {serviceEmoji(job.service)} {serviceLabel(job.service)}
          </span>
          <span className="job-card-posted">{job.postedAt}</span>
        </div>
        <h3 className="job-card-title">{job.title}</h3>
        <p className="job-card-meta">
          {job.family} · {job.distance} mi away · {job.when}
        </p>
        <p className="job-card-desc">{job.description}</p>
      </div>
      <div className="job-card-side">
        <p className="job-card-pay">
          ${job.pay}
          <span>/{job.payUnit}</span>
        </p>
        <button
          type="button"
          className={`btn btn-sm ${applied ? 'btn-ghost' : 'btn-primary'}`}
          onClick={onApply}
          disabled={applied}
        >
          {applied ? '✓ Applied' : 'Apply'}
        </button>
      </div>
    </article>
  )
}

function ListingModal({ open, profile, onClose, onSave }) {
  const [draft, setDraft] = useState(profile)

  // Re-sync when the modal reopens with a changed profile.
  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) setDraft(profile)
  }

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }))
  const toggleIn = (key, value) =>
    setDraft((d) => {
      const list = d[key] ?? []
      return { ...d, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] }
    })

  return (
    <Modal
      open={open}
      title="List yourself"
      subtitle="This is the card parents see when they browse teens nearby."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave(draft)
        }}
      >
        <div className="form-grid modal-field">
          <label className="field">
            <span className="field-label">Name</span>
            <input
              className="input"
              value={draft.name ?? ''}
              onChange={(e) => set('name', e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Hourly rate ($)</span>
            <input
              className="input"
              type="number"
              min="5"
              max="60"
              value={draft.rate ?? 15}
              onChange={(e) => set('rate', Number(e.target.value))}
            />
          </label>
        </div>

        <div className="modal-field">
          <span className="field-label">Jobs you take</span>
          <div className="chip-row">
            {SERVICES.map((s) => {
              const on = (draft.services ?? []).includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`priority-chip${on ? ' is-on' : ''}`}
                  onClick={() => toggleIn('services', s.id)}
                  aria-pressed={on}
                >
                  <span className="priority-box" aria-hidden="true">
                    {on ? '✓' : ''}
                  </span>
                  {s.emoji} {s.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="modal-field">
          <span className="field-label">Days you&apos;re free</span>
          <div className="day-row">
            {WEEKDAYS.map((d) => {
              const on = (draft.days ?? []).includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  className={`day-chip${on ? ' is-on' : ''}`}
                  onClick={() => toggleIn('days', d)}
                  aria-pressed={on}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>

        <label className="field modal-field">
          <span className="field-label">About you</span>
          <textarea
            className="textarea"
            value={draft.bio ?? ''}
            onChange={(e) => set('bio', e.target.value)}
            placeholder="What makes you a good hire?"
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-md" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-md">
            Publish my listing
          </button>
        </div>
      </form>
    </Modal>
  )
}
