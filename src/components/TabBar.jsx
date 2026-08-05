// Bottom nav — apple-design §6e/§12: primary controls belong in the thumb
// zone, and floating chrome should read as a material, not a solid bar.
// Not shown on ActiveWorkout or LoginScreen — the logging path stays
// distraction-free (build-plan §0 rule 3), and login has nothing to navigate to.
import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Today', icon: '●' },
  { to: '/history', label: 'History', icon: '≡' },
  { to: '/body', label: 'Body', icon: '◐' },
  { to: '/insights', label: 'Insights', icon: '△' },
  { to: '/meals', label: 'Meals', icon: '◇' },
  { to: '/settings', label: 'More', icon: '⋯' },
]

export default function TabBar() {
  return (
    <nav className="tab-bar glass">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `tab-bar-item pressable ${isActive ? 'is-active' : ''}`}>
          <span className="tab-bar-icon" aria-hidden>{t.icon}</span>
          <span className="tab-bar-label">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
