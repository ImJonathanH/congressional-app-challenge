import { useMemo, useState } from 'react'
import DashboardShell from '../components/DashboardShell.jsx'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'
import { useApp } from '../state/appContext.js'
import { PARENT_PRIORITIES, SERVICES, serviceEmoji, serviceLabel } from '../data/services.js'
import './Dashboard.css'

const SORTS = [
  { id: 'best', label: 'Best match' },
  { id: 'distance', label: 'Closest first' },
  { id: 'rating', label: 'Highest rated' },
  { id: 'rate-low', label: 'Lowest rate' },
]

const EMPTY_JOB = {
  title: '',
  service: 'babysitting',
  when: '',
  pay: 18,
  payUnit: 'hr',
  description: '',
}

/**
 * Ranks a teen against the parent's stated priorities. Higher is better —
 * this is what makes "Best match" different from a plain distance sort.
 */
function matchScore(teen, priorities) {
  let score = teen.rating ? teen.rating * 2 : 6
  score += Math.max(0, 5 - teen.distance)
  if (priorities.includes('background-checked') && teen.verified) score += 5
  if (priorities.includes('nearby')) score += Math.max(0, 6 - teen.distance * 1.5)
  if (priorities.includes('experience')) score += Math.min(teen.reviews, 30) / 4
  if (priorities.includes('cpr') && teen.cpr) score += 4
  if (priorities.includes('affordable')) score += Math.max(0, 25 - teen.rate) / 3
  if (priorities.includes('flexible') && teen.days.length >= 5) score += 2.5
  if (priorities.includes('recurring') && teen.days.length >= 4) score += 2
  if (priorities.includes('references')) score += Math.min(teen.reviews, 20) / 5
  return score
}

export default function ParentDashboard() {
  const app = useApp()
  const [service, setService] = useState('all')
  const [maxDistance, setMaxDistance] = useState(10)
  const [maxRate, setMaxRate] = useState(30)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [sort, setSort] = useState('best')
  const [query, setQuery] = useState('')
  const [showPost, setShowPost] = useState(false)
  const [draft, setDraft] = useState(EMPTY_JOB)
  const [posted, setPosted] = useState(false)

  const teens = useMemo(() => {
    const filtered = app.teens.filter((t) => {
      if (t.id === app.uid) return false
      if (service !== 'all' && !t.services.includes(service)) return false
      if (t.distance > maxDistance) return false
      if (t.rate > maxRate) return false
      if (verifiedOnly && !t.verified) return false
      if (query && !`${t.name} ${t.bio} ${t.badges.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
        return false
      return true
    })

    const sorters = {
      best: (a, b) => matchScore(b, app.priorities) - matchScore(a, app.priorities),
      distance: (a, b) => a.distance - b.distance,
      rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
      'rate-low': (a, b) => a.rate - b.rate,
    }
    return [...filtered].sort(sorters[sort])
  }, [app.teens, app.uid, app.priorities, service, maxDistance, maxRate, verifiedOnly, sort, query])

  const myJobs = app.postedJobs

  const submitJob = (e) => {
    e.preventDefault()
    app.postJob(draft)
    setDraft(EMPTY_JOB)
    setShowPost(false)
    setPosted(true)
  }

  const priorityLabels = app.priorities
    .map((id) => PARENT_PRIORITIES.find((p) => p.id === id)?.label)
    .filter(Boolean)

  const sidebar = (
    <>
      <section className="panel card">
        <h2 className="panel-title">Filter teens</h2>

        <div className="filter-block">
          <span className="field-label">Job type</span>
          <div className="filter-list">
            <FilterRadio
              name="service"
              checked={service === 'all'}
              onChange={() => setService('all')}
              label="All job types"
            />
            {SERVICES.map((s) => (
              <FilterRadio
                key={s.id}
                name="service"
                checked={service === s.id}
                onChange={() => setService(s.id)}
                label={`${s.emoji} ${s.label}`}
              />
            ))}
          </div>
        </div>

        <div className="filter-block">
          <label className="field-label" htmlFor="distance">
            Within <strong className="filter-value">{maxDistance} mi</strong>
          </label>
          <input
            id="distance"
            className="radius-slider"
            type="range"
            min="1"
            max="15"
            value={maxDistance}
            onChange={(e) => setMaxDistance(Number(e.target.value))}
          />
        </div>

        <div className="filter-block">
          <label className="field-label" htmlFor="rate">
            Max rate <strong className="filter-value">${maxRate}/hr</strong>
          </label>
          <input
            id="rate"
            className="radius-slider"
            type="range"
            min="10"
            max="30"
            value={maxRate}
            onChange={(e) => setMaxRate(Number(e.target.value))}
          />
        </div>

        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
          />
          <span>Verified teens only</span>
        </label>

        <div className="filter-block filter-block-last">
          <label className="field-label" htmlFor="sort">
            Sort by
          </label>
          <select
            id="sort"
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

      {priorityLabels.length > 0 && (
        <section className="panel card">
          <h2 className="panel-title">Your priorities</h2>
          <div className="panel-tags">
            {priorityLabels.map((label) => (
              <span key={label} className="tag">
                {label}
              </span>
            ))}
          </div>
          <p className="panel-note">Best match uses these to rank results.</p>
        </section>
      )}

      {myJobs.length > 0 && (
        <section className="panel card">
          <h2 className="panel-title">Your posted jobs</h2>
          <ul className="mini-list">
            {myJobs.map((j) => (
              <li key={j.id}>
                <span className="mini-list-title">{j.title}</span>
                <span className="mini-list-meta">
                  {serviceLabel(j.service)} · ${j.pay}/{j.payUnit}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )

  return (
    <DashboardShell
      name={app.profile?.displayName || 'Your family'}
      subtitle={`Parent · ZIP ${app.zip}`}
      verified={app.verification?.result === 'clear'}
      sidebar={sidebar}
      action={
        <div className="dash-head">
          <div>
            <h1 className="dash-title">Teens near {app.zip}</h1>
            <p className="dash-sub">
              {teens.length} {teens.length === 1 ? 'teen' : 'teens'} match your filters
            </p>
          </div>
          <div className="dash-head-actions">
            <input
              className="input dash-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teens…"
              aria-label="Search teens"
            />
            {/* Secondary to browsing — parents mostly hire by browsing. */}
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() => setShowPost(true)}
            >
              + Post a job
            </button>
          </div>
        </div>
      }
    >
      {posted && (
        <div className="banner">
          <span>✓ Your job is live. Teens within their work radius can apply now.</span>
          <button type="button" className="banner-x" onClick={() => setPosted(false)}>
            ✕
          </button>
        </div>
      )}

      {teens.length === 0 ? (
        <div className="empty card">
          <p className="empty-title">No teens match those filters yet</p>
          <p className="empty-body">
            Try widening your distance or raising the rate cap — or post a job and let teens come to
            you.
          </p>
          <button type="button" className="btn btn-primary btn-md" onClick={() => setShowPost(true)}>
            Post a job
          </button>
        </div>
      ) : (
        <div className="teen-grid">
          {teens.map((teen) => (
            <TeenCard
              key={teen.id}
              teen={teen}
              invited={app.invites.includes(teen.id)}
              onInvite={() => app.toggleInvite(teen.id)}
            />
          ))}
        </div>
      )}

      <Modal
        open={showPost}
        title="Post a job"
        subtitle="Teens nearby will see this in their feed within seconds."
        onClose={() => setShowPost(false)}
      >
        <form onSubmit={submitJob}>
          <label className="field modal-field">
            <span className="field-label">Job title</span>
            <input
              className="input"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Friday evening sitter for two kids"
              required
              autoFocus
            />
          </label>

          <div className="form-grid modal-field">
            <label className="field">
              <span className="field-label">Job type</span>
              <select
                className="select"
                value={draft.service}
                onChange={(e) => setDraft({ ...draft, service: e.target.value })}
              >
                {SERVICES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.emoji} {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">When</span>
              <input
                className="input"
                value={draft.when}
                onChange={(e) => setDraft({ ...draft, when: e.target.value })}
                placeholder="Fri, 6–10 PM"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Pay ($)</span>
              <input
                className="input"
                type="number"
                min="5"
                value={draft.pay}
                onChange={(e) => setDraft({ ...draft, pay: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span className="field-label">Per</span>
              <select
                className="select"
                value={draft.payUnit}
                onChange={(e) => setDraft({ ...draft, payUnit: e.target.value })}
              >
                <option value="hr">hour</option>
                <option value="walk">walk</option>
                <option value="visit">visit</option>
                <option value="job">job</option>
              </select>
            </label>
          </div>

          <label className="field modal-field">
            <span className="field-label">Details</span>
            <textarea
              className="textarea"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Ages of the kids, the dog's routine, what you need handled…"
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost btn-md" onClick={() => setShowPost(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-md">
              Post job
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  )
}

function FilterRadio({ name, checked, onChange, label }) {
  return (
    <label className={`filter-radio${checked ? ' is-on' : ''}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  )
}

function TeenCard({ teen, invited, onInvite }) {
  return (
    <article className="teen-card card">
      <div className="teen-card-head">
        <Avatar name={teen.name} size={54} />
        <div className="teen-card-id">
          <p className="teen-card-name">
            {teen.name}
            {teen.verified && (
              <span className="tag tag-ok teen-card-verified">Verified</span>
            )}
          </p>
          <p className="teen-card-meta">
            {teen.age} · {teen.grade} · {teen.distance} mi away
          </p>
        </div>
        <p className="teen-card-rate">
          ${teen.rate}
          <span>/hr</span>
        </p>
      </div>

      <div className="teen-card-tags">
        {teen.services.map((s) => (
          <span key={s} className="tag">
            {serviceEmoji(s)} {serviceLabel(s)}
          </span>
        ))}
        {teen.cpr && <span className="tag tag-accent">CPR certified</span>}
      </div>

      <p className="teen-card-bio">{teen.bio}</p>

      <div className="teen-card-days">
        {teen.days.map((d) => (
          <span key={d} className="day-pill">
            {d}
          </span>
        ))}
      </div>

      <footer className="teen-card-foot">
        <span className="teen-card-rating">
          {teen.rating ? (
            <>
              ★ {teen.rating.toFixed(1)} <span className="muted">({teen.reviews})</span>
            </>
          ) : (
            <span className="muted">New to TeenHands</span>
          )}
        </span>
        <button
          type="button"
          className={`btn btn-sm ${invited ? 'btn-ghost' : 'btn-primary'}`}
          onClick={onInvite}
        >
          {invited ? '✓ Invited' : 'Invite to apply'}
        </button>
      </footer>
    </article>
  )
}
