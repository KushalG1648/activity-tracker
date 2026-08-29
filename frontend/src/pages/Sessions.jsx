import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSessions, deleteSession, fmt, fmtDuration } from '../api';
import { useAuth } from '../context/AuthContext';
import { useActivities } from '../context/ActivitiesContext';

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState(null);
  const navigate = useNavigate();
  const { isUnlocked } = useAuth();
  const { enabled } = useActivities();

  useEffect(() => {
    getSessions(filter).then(setSessions);
  }, [filter]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this session? This cannot be undone.')) return;
    await deleteSession(id);
    setSessions(s => s.filter(x => x.id !== id));
  };

  const isGroupSport = (slug) => slug === 'badminton' || slug === 'cricket';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sessions</h1>
        <Link to="/sessions/new" className="btn btn-primary">+ Log Activity</Link>
      </div>

      {/* Activity filter pills */}
      {enabled.length > 1 && (
        <div className="filter-pills">
          <button
            className={`filter-pill ${!filter ? 'active' : ''}`}
            onClick={() => setFilter(null)}
          >
            All
          </button>
          {enabled.map(a => (
            <button
              key={a.slug}
              className={`filter-pill ${filter === a.slug ? 'active' : ''}`}
              style={filter === a.slug ? { background: a.color, borderColor: a.color, color: '#fff' } : {}}
              onClick={() => setFilter(filter === a.slug ? null : a.slug)}
            >
              {a.emoji} {a.display_name}
            </button>
          ))}
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">🏃</span>
          <p>No sessions yet. <Link to="/sessions/new" style={{ color: 'var(--green-mid)', fontWeight: 600, textDecoration: 'none' }}>Log your first activity</Link></p>
        </div>
      ) : sessions.map(s => {
        const data = s.data || {};
        const act = s.activity;
        const isGroup = act && isGroupSport(act.slug);

        return (
          <div key={s.id} className="session-card" onClick={() => navigate(`/sessions/${s.id}`)}>
            <div className="session-card-header">
              <div>
                <div className="session-date">{formatDate(s.date)}</div>
                {(data.venue || data.pool_name || data.gym_name || data.route_name) && (
                  <div className="session-venue">
                    {data.venue || data.pool_name || data.gym_name || data.route_name}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {act && (
                  <span className="activity-badge" style={{ background: act.color + '22', color: act.color }}>
                    {act.emoji} {act.display_name}
                  </span>
                )}
                <div className="session-actions" onClick={e => e.stopPropagation()}>
                  <Link to={`/sessions/${s.id}`} className="btn btn-outline btn-sm">View</Link>
                  <button className="btn btn-danger btn-sm" onClick={e => handleDelete(s.id, e)}>Delete</button>
                </div>
              </div>
            </div>

            <div className="session-meta">
              <span>{fmtDuration(s.duration_minutes)}</span>
              {isGroup && <span>{data.num_other_players ?? data.num_players} player{(data.num_other_players ?? data.num_players) !== 1 ? 's' : ''}</span>}
              {act?.slug === 'run' && data.distance_km && <span>{data.distance_km} km</span>}
              {act?.slug === 'swimming' && data.distance_m && <span>{data.distance_m} m</span>}
              {act?.slug === 'cricket' && data.overs && <span>{data.overs} overs</span>}
              {s.transport_cost > 0 && <span>Transport {fmt(s.transport_cost)}</span>}
              <span className="session-total-inline">Total {fmt(s.total_cost)}</span>
            </div>

            {isGroup && (
              <div className="session-charges">
                <span className="charge-pill fair">Fair  {fmt(s.per_player_fair)} / player</span>
                {isUnlocked && (
                  s.per_player_adv != null
                    ? <span className="charge-pill adv">Advantageous  {fmt(s.per_player_adv)} / player</span>
                    : <span className="charge-pill adv">Solo session</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
