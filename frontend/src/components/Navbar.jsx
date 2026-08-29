import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useActivities } from '../context/ActivitiesContext';
import LockModal from './LockModal';

export default function Navbar() {
  const { isUnlocked, lock } = useAuth();
  const { enabled } = useActivities();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <nav className="navbar">
        <NavLink to="/" className="brand">🏃 Activity Tracker</NavLink>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/sessions">Sessions</NavLink>
        <NavLink to="/activities">Activities</NavLink>
        {isUnlocked && <NavLink to="/settings">Settings</NavLink>}
        <button
          className="lock-btn"
          onClick={isUnlocked ? lock : () => setShowModal(true)}
          title={isUnlocked ? 'Lock' : 'Unlock advantageous mode'}
        >
          {isUnlocked ? '🔓' : '🔒'}
        </button>
      </nav>

      {enabled.length > 0 && (
        <div className="subnav">
          {enabled.map(a => (
            <NavLink key={a.slug} to={`/${a.slug}`} className="subnav-link">
              <span>{a.emoji}</span>
              <span>{a.display_name}</span>
            </NavLink>
          ))}
        </div>
      )}

      {showModal && <LockModal onClose={() => setShowModal(false)} />}
    </>
  );
}
