import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getSession, deleteSession, fmt, fmtDuration, fmtPace, fmtElapsed } from '../api';
import { useAuth } from '../context/AuthContext';

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function BadmintonBreakdown({ session }) {
  const d = session.data || {};
  const breakdown = [
    { label: 'Court booking', amount: d.court_cost },
    { label: 'Transport',     amount: session.transport_cost },
    { label: `Shuttle (${fmtDuration(session.duration_minutes)})`, amount: d.shuttle_cost },
    { label: 'Racket recovery', amount: d.racket_charge },
    { label: 'Shoe recovery',   amount: d.shoe_charge },
  ].filter(r => r.amount != null);
  return <BreakdownTable rows={breakdown} total={session.total_cost} />;
}

function CricketBreakdown({ session }) {
  const d = session.data || {};
  const breakdown = [
    { label: 'Ground',      amount: d.ground_cost },
    { label: 'Transport',   amount: session.transport_cost },
    { label: `Ball (${fmtDuration(session.duration_minutes)})`, amount: d.ball_cost },
    { label: 'Bat recovery', amount: d.bat_charge },
  ].filter(r => r.amount != null);
  return <BreakdownTable rows={breakdown} total={session.total_cost} />;
}

function SwimmingBreakdown({ session }) {
  const d = session.data || {};
  const breakdown = [
    { label: 'Entry Fee',  amount: d.entry_fee },
    { label: 'Transport',  amount: session.transport_cost },
  ].filter(r => r.amount != null);
  return <BreakdownTable rows={breakdown} total={session.total_cost} />;
}

function GymBreakdown({ session }) {
  const d = session.data || {};
  const breakdown = [
    { label: 'Entry / Session Cost', amount: d.entry_fee },
    { label: 'Transport',            amount: session.transport_cost },
  ].filter(r => r.amount != null);
  return <BreakdownTable rows={breakdown} total={session.total_cost} />;
}

function MarathonBreakdown({ session }) {
  const d = session.data || {};
  const breakdown = [
    { label: 'Entry Fee', amount: d.entry_fee },
    { label: 'Transport', amount: session.transport_cost },
  ].filter(r => r.amount != null);
  return <BreakdownTable rows={breakdown} total={session.total_cost} />;
}

function BreakdownTable({ rows, total }) {
  return (
    <table className="breakdown-table">
      <tbody>
        {rows.map(({ label, amount }) => (
          <tr key={label}>
            <td style={{ color: 'var(--label-2)' }}>{label}</td>
            <td>{fmt(amount)}</td>
          </tr>
        ))}
        <tr className="breakdown-row-total">
          <td>Total</td>
          <td>{fmt(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function GroupChargeCards({ session, isUnlocked }) {
  const { per_player_fair, per_player_adv } = session;
  const d = session.data || {};
  const N = d.num_other_players ?? d.num_players ?? 0;
  return (
    <div className="card">
      <div className="card-title">Per-Player Charge</div>
      <div className={isUnlocked ? 'mode-cards' : ''}>
        <div className="mode-card fair" style={!isUnlocked ? { borderRadius: 'var(--r-lg)' } : {}}>
          <div className="mode-label">Fair Mode</div>
          <div className="mode-amount">{fmt(per_player_fair)}</div>
          <div className="mode-sub">per player · split {N + 1} ways</div>
          <span className="mode-you-pay">You pay {fmt(per_player_fair)}</span>
        </div>
        {isUnlocked && (
          <div className="mode-card adv">
            <div className="mode-label">Advantageous</div>
            {per_player_adv != null ? (
              <>
                <div className="mode-amount">{fmt(per_player_adv)}</div>
                <div className="mode-sub">per player · split {N} ways</div>
                <span className="mode-you-pay">You pay ₹0.00</span>
              </>
            ) : (
              <>
                <div className="mode-amount" style={{ fontSize: '1.2rem', marginTop: '0.8rem' }}>Solo</div>
                <div className="mode-sub" style={{ marginBottom: '0.8rem' }}>No others to split with</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isUnlocked } = useAuth();
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getSession(id)
      .then(setSession)
      .catch(err => setError(err.response?.data?.error || err.message || 'Failed to load session'));
  }, [id]);

  if (error) return <div className="card" style={{ color: '#e53e3e', fontFamily: 'monospace', fontSize: '0.85rem' }}><strong>Error:</strong> {error}</div>;
  if (!session) return <div className="card" style={{ color: 'var(--label-3)' }}>Loading…</div>;

  const act = session.activity;
  const d = session.data || {};

  const handleDelete = async () => {
    if (!window.confirm('Delete this session?')) return;
    await deleteSession(id);
    navigate('/sessions');
  };

  return (
    <div>
      <Link to="/sessions" className="back-link">← Back to Sessions</Link>

      <div className="page-header">
        <h1 className="page-title">
          {act && <span style={{ color: act.color, marginRight: '0.4rem' }}>{act.emoji}</span>}
          {formatDate(session.date)}
        </h1>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>
      </div>

      {/* Activity badge */}
      {act && (
        <div style={{ marginBottom: '1rem' }}>
          <span className="activity-badge" style={{ background: act.color + '22', color: act.color, fontSize: '0.9rem' }}>
            {act.emoji} {act.display_name}
          </span>
        </div>
      )}

      {/* Meta bar */}
      <div className="detail-meta">
        <div className="detail-meta-item">
          <div className="meta-label">Duration</div>
          <div className="meta-value">{fmtDuration(session.duration_minutes)}</div>
        </div>
        {(d.venue || d.pool_name || d.gym_name || d.route_name) && (
          <div className="detail-meta-item">
            <div className="meta-label">{act?.slug === 'swimming' ? 'Pool' : act?.slug === 'gym' ? 'Gym' : act?.slug === 'run' ? 'Route' : 'Venue'}</div>
            <div className="meta-value">{d.venue || d.pool_name || d.gym_name || d.route_name}</div>
          </div>
        )}
        {(d.num_other_players != null || d.num_players != null) && (
          <div className="detail-meta-item">
            <div className="meta-label">Players</div>
            <div className="meta-value">{d.num_other_players ?? d.num_players}</div>
          </div>
        )}
        {act?.slug === 'run' && d.distance_km && (
          <div className="detail-meta-item">
            <div className="meta-label">Distance</div>
            <div className="meta-value">{d.distance_km} km</div>
          </div>
        )}
        {act?.slug === 'run' && session.pace_sec_per_km && (
          <div className="detail-meta-item">
            <div className="meta-label">Avg Pace</div>
            <div className="meta-value">{fmtPace(session.pace_sec_per_km)}</div>
          </div>
        )}
        {act?.slug === 'run' && d.elapsed_seconds && (
          <div className="detail-meta-item">
            <div className="meta-label">Time</div>
            <div className="meta-value">{fmtElapsed(d.elapsed_seconds)}</div>
          </div>
        )}
        {act?.slug === 'swimming' && d.distance_m && (
          <div className="detail-meta-item">
            <div className="meta-label">Distance</div>
            <div className="meta-value">{d.distance_m} m</div>
          </div>
        )}
        {act?.slug === 'swimming' && d.laps && (
          <div className="detail-meta-item">
            <div className="meta-label">Laps</div>
            <div className="meta-value">{d.laps}</div>
          </div>
        )}
        {act?.slug === 'swimming' && d.stroke_type && (
          <div className="detail-meta-item">
            <div className="meta-label">Stroke</div>
            <div className="meta-value" style={{ textTransform: 'capitalize' }}>{d.stroke_type}</div>
          </div>
        )}
        {act?.slug === 'gym' && d.session_type && (
          <div className="detail-meta-item">
            <div className="meta-label">Type</div>
            <div className="meta-value" style={{ textTransform: 'capitalize' }}>{d.session_type}</div>
          </div>
        )}
        {act?.slug === 'cricket' && d.match_type && (
          <div className="detail-meta-item">
            <div className="meta-label">Match Type</div>
            <div className="meta-value" style={{ textTransform: 'capitalize' }}>{d.match_type}</div>
          </div>
        )}
        {act?.slug === 'cricket' && d.overs && (
          <div className="detail-meta-item">
            <div className="meta-label">Overs</div>
            <div className="meta-value">{d.overs}</div>
          </div>
        )}
        <div className="detail-meta-item">
          <div className="meta-label">Session Total</div>
          <div className="meta-value green">{fmt(session.total_cost)}</div>
        </div>
      </div>

      {session.notes && (
        <div className="card" style={{ color: 'var(--label-3)', fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '1rem' }}>
          {session.notes}
        </div>
      )}

      {/* Cost breakdown */}
      <div className="card">
        <div className="card-title">Cost Breakdown</div>
        {act?.slug === 'badminton' && <BadmintonBreakdown session={session} />}
        {act?.slug === 'cricket'   && <CricketBreakdown session={session} />}
        {act?.slug === 'swimming'  && <SwimmingBreakdown session={session} />}
        {act?.slug === 'gym'       && <GymBreakdown session={session} />}
        {act?.slug === 'run'  && <MarathonBreakdown session={session} />}
        {!['badminton','cricket','swimming','gym','run'].includes(act?.slug) && (
          <BreakdownTable
            rows={[
              { label: 'Entry Fee',  amount: d.entry_fee || 0 },
              { label: 'Transport',  amount: session.transport_cost },
            ]}
            total={session.total_cost}
          />
        )}
      </div>

      {/* Group sport per-player cards */}
      {(act?.slug === 'badminton' || act?.slug === 'cricket') && (
        <GroupChargeCards session={session} isUnlocked={isUnlocked} />
      )}
    </div>
  );
}
