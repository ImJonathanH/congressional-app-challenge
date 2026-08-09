import { Link } from 'react-router-dom'
import './Logo.css'

export default function Logo({ to = '/', size = 'md' }) {
  const mark = (
    <span className="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M11 22V9.5a2 2 0 0 1 4 0V15m0 0V7.5a2 2 0 0 1 4 0V15m0 0V9.5a2 2 0 0 1 4 0V21c0 4-3 7-7.5 7S8 25 8 21v-3.5a2 2 0 0 1 3-1.7"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )

  const body = (
    <>
      {mark}
      <span className="logo-word">
        Teen<span className="logo-word-accent">Hands</span>
      </span>
    </>
  )

  const className = `logo logo-${size}`
  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <span className={className}>{body}</span>
  )
}
