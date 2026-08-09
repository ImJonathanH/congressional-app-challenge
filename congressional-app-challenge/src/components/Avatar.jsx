import './Avatar.css'

const PALETTE = ['#14705f', '#3f6ea8', '#a4553a', '#6b57a3', '#2f7d6b', '#96603f']

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

/** Deterministic color so a person keeps the same avatar across renders. */
function hueFor(name = '') {
  let sum = 0
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i)
  return PALETTE[sum % PALETTE.length]
}

export default function Avatar({ name, size = 52 }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: hueFor(name), fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}
