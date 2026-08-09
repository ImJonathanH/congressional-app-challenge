/** The three job types TeenHands launches with. */
export const SERVICES = [
  {
    id: 'babysitting',
    label: 'Babysitting',
    emoji: '🧸',
    blurb: 'Evening sitters, after-school care, and last-minute coverage.',
    typicalRate: '$15–20/hr',
  },
  {
    id: 'dog-walking',
    label: 'Dog Walking',
    emoji: '🐕',
    blurb: 'Midday walks, weekend hikes, and pet check-ins.',
    typicalRate: '$12–18/walk',
  },
  {
    id: 'coaching',
    label: 'Coaching & Tutoring',
    emoji: '⚽',
    blurb: 'Sports practice, music lessons, and homework help.',
    typicalRate: '$18–25/hr',
  },
]

export const SERVICE_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s]))

export const serviceLabel = (id) => SERVICE_BY_ID[id]?.label ?? id
export const serviceEmoji = (id) => SERVICE_BY_ID[id]?.emoji ?? '•'

/** Priorities a parent can rank during onboarding. */
export const PARENT_PRIORITIES = [
  { id: 'background-checked', label: 'Background-checked teens' },
  { id: 'nearby', label: 'Lives close by' },
  { id: 'experience', label: 'Prior experience' },
  { id: 'cpr', label: 'CPR / First Aid certified' },
  { id: 'affordable', label: 'Affordable rates' },
  { id: 'flexible', label: 'Flexible on short notice' },
  { id: 'recurring', label: 'Available for recurring jobs' },
  { id: 'references', label: 'Strong neighbor references' },
]

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
