// Bottom nav — apple-design §6e: primary controls belong in the thumb zone.
// Not rendered on ActiveWorkout or LoginScreen: the logging path stays
// distraction-free (build-plan §0 rule 3), and login has nowhere to navigate.
//
// Labels are specific, not umbrella terms (apple-design §16: "Name nav items
// for their contents") — "Today", "History", "Body", not "Home"/"More".
import { NavLink } from 'react-router-dom'
import Icon from './Icon'

const TABS = [
  { to: '/', icon: 'today', label: 'Today' },
  { to: '/history', icon: 'history', label: 'History' },
  { to: '/body', icon: 'body', label: 'Body' },
  { to: '/meals', icon: 'meals', label: 'Meals' },
  { to: '/insights', icon: 'insights', label: 'Trends' },
  { to: '/settings', icon: 'settings', label: 'Setup' },
]

export default function TabBar() {
  return (
    <nav className="tabbar glass">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) => `tabbar-item pressable ${isActive ? 'is-active' : ''}`}
        >
          <Icon name={t.icon} size={20} />
          <span className="tabbar-label">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
