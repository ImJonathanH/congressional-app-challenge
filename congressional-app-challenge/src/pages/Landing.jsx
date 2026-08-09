import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import Avatar from '../components/Avatar.jsx'
import { SERVICES } from '../data/services.js'
import './Landing.css'

const STEPS = [
  {
    n: '01',
    title: 'Tell us where you are',
    body: 'Enter your ZIP code so we only show people in your actual neighborhood.',
  },
  {
    n: '02',
    title: 'Parent or teen?',
    body: 'Parents get verified and post jobs. Teens set a work radius and list themselves.',
  },
  {
    n: '03',
    title: 'Match and get to work',
    body: 'Browse, invite, apply. Every job starts with two people who live minutes apart.',
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const start = () => navigate('/start')

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="shell landing-nav-inner">
          <Logo to={null} />
          <nav className="landing-nav-links">
            <a href="#services">Jobs</a>
            <a href="#how">How it works</a>
            <a href="#trust">Safety</a>
          </nav>
          <button type="button" className="btn btn-primary btn-sm" onClick={start}>
            Get Started
          </button>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="hero">
          <div className="shell hero-inner">
            <div className="hero-copy">
              <span className="hero-eyebrow">Neighborhood work, made simple</span>
              <h1 className="hero-title">
                Quick jobs for teens.
                <br />
                Trusted help for <span className="hero-underline">parents</span>.
              </h1>
              <p className="hero-lede">
                TeenHands connects responsible local teens with families a few streets away.
                Babysitting, dog walking, and coaching — booked in minutes, not group chats.
              </p>

              <div className="hero-actions">
                <button type="button" className="btn btn-primary btn-lg" onClick={start}>
                  Get Started
                </button>
                <a className="btn btn-ghost btn-lg" href="#how">
                  See how it works
                </a>
              </div>

              <ul className="hero-proof">
                <li>
                  <strong>Background-checked</strong> parents
                </li>
                <li>
                  <strong>Radius-based</strong> matching
                </li>
                <li>
                  <strong>Free</strong> for teens
                </li>
              </ul>
            </div>

            <aside className="hero-card-stack" aria-hidden="true">
              <div className="hero-card hero-card-main card">
                <div className="hero-card-row">
                  <Avatar name="Maya R" size={46} />
                  <div>
                    <p className="hero-card-name">Maya R.</p>
                    <p className="hero-card-meta">0.8 mi away · ★ 4.9 (24)</p>
                  </div>
                  <span className="tag tag-ok">Verified</span>
                </div>
                <div className="hero-card-tags">
                  <span className="tag">🧸 Babysitting</span>
                  <span className="tag">⚽ Coaching</span>
                </div>
                <p className="hero-card-quote">
                  “I bring a craft box and I actually enjoy bedtime routines.”
                </p>
                <div className="hero-card-foot">
                  <span className="hero-card-rate">$18/hr</span>
                  <span className="btn btn-primary btn-sm">Invite</span>
                </div>
              </div>

              <div className="hero-card hero-card-job card">
                <span className="tag tag-accent">🐕 Dog Walking</span>
                <p className="hero-card-jobtitle">Midday walk for a golden retriever</p>
                <p className="hero-card-meta">0.6 mi · Weekdays 12:30 PM · $16/walk</p>
              </div>

              <div className="hero-blob" />
            </aside>
          </div>
        </section>

        {/* ---------- Services ---------- */}
        <section id="services" className="section">
          <div className="shell">
            <div className="section-head">
              <h2 className="section-title">Three ways to earn, three ways to get help</h2>
              <p className="section-sub">
                We start with the jobs neighbors already ask each other for — so there is always
                someone nearby who can say yes.
              </p>
            </div>

            <div className="service-grid">
              {SERVICES.map((s) => (
                <article key={s.id} className="service-card card">
                  <span className="service-emoji" aria-hidden="true">
                    {s.emoji}
                  </span>
                  <h3 className="service-title">{s.label}</h3>
                  <p className="service-blurb">{s.blurb}</p>
                  <p className="service-rate">Typically {s.typicalRate}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="section section-alt">
          <div className="shell">
            <div className="section-head">
              <h2 className="section-title">From sign-up to first job in three steps</h2>
            </div>
            <ol className="steps">
              {STEPS.map((s) => (
                <li key={s.n} className="step">
                  <span className="step-n">{s.n}</span>
                  <h3 className="step-title">{s.title}</h3>
                  <p className="step-body">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Trust ---------- */}
        <section id="trust" className="section">
          <div className="shell trust-inner">
            <div>
              <span className="hero-eyebrow">Safety first</span>
              <h2 className="section-title">
                Parents are screened before they can contact a single teen
              </h2>
              <p className="section-sub trust-copy">
                Every parent account runs through a Raptor background check — identity, criminal
                records, and watchlists — before their dashboard unlocks. Teens choose their own
                work radius and never share an address until they accept a job.
              </p>
              <ul className="trust-list">
                <li>Raptor identity and criminal-record screening</li>
                <li>Teen-controlled work radius and availability</li>
                <li>Ratings and reviews from real neighbors</li>
              </ul>
              <button type="button" className="btn btn-primary btn-lg" onClick={start}>
                Get Started
              </button>
            </div>
            <div className="trust-badge card" aria-hidden="true">
              <span className="trust-badge-check">✓</span>
              <p className="trust-badge-title">Background check complete</p>
              <p className="trust-badge-meta">Raptor · Identity · Criminal · Watchlists</p>
              <span className="tag tag-ok">Cleared</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-foot">
        <div className="shell landing-foot-inner">
          <Logo to={null} size="sm" />
          <p className="muted landing-foot-note">
            A Congressional App Challenge project. Demo data — no real background checks are
            performed.
          </p>
          <Link to="/start" className="btn btn-ghost btn-sm">
            Get Started
          </Link>
        </div>
      </footer>
    </div>
  )
}
