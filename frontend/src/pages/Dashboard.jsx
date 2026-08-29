import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStats, fmt, fmtDuration } from '../api';
import CalendarHeatmap from '../components/CalendarHeatmap';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, padding: '0.5rem 0.8rem', fontSize: '0.84rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
      <strong>{p.payload.emoji} {p.payload.display_name}</strong>: {p.value} session{p.value !== 1 ? 's' : ''}
    </div>
  );
};

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, padding: '0.5rem 0.8rem', fontSize: '0.84rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
      <strong>{label}</strong>: {fmt(payload[0].value)}
    </div>
  );
};

function ActivityCard({ act }) {
  return (
    <Link to={`/${act.slug}`} className="act-summary-card" style={{ borderTopColor: act.color }}>
      <div className="act-summary-emoji">{act.emoji}</div>
      <div className="act-summary-name">{act.display_name}</div>
      <div className="act-summary-count" style={{ color: act.color }}>{act.count}</div>
      <div className="act-summary-label">sessions</div>
      <div className="act-summary-spend">{fmt(act.total)}</div>
    </Link>
  );
}

const PERIODS = [
  { key: 'all',   label: 'All Time' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year',  label: 'This Year' },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('all');

  useEffect(() => { getStats().then(setStats); }, []);

  if (!stats) return null;

  const {
    total_sessions, total_spend, active_activities, current_streak,
    sessions_by_activity, spend_by_activity, recent_sessions, heatmap_dates,
    period_stats,
  } = stats;

  const ps = period === 'all'
    ? { sessions: total_sessions, spend: total_spend }
    : (period_stats?.[period] || { sessions: 0, spend: 0 });

  const periodLabel = PERIODS.find(p => p.key === period)?.label || 'All Time';

  const spendMap = Object.fromEntries((spend_by_activity || []).map(a => [a.slug, a.total]));
  const activityCards = (sessions_by_activity || [])
    .filter(a => a.count > 0)
    .map(a => ({ ...a, total: spendMap[a.slug] || 0 }));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <Link to="/sessions/new" className="btn btn-primary">+ Log Activity</Link>
      </div>

      {/* Period tabs */}
      <div className="period-tabs">
        {PERIODS.map(p => (
          <button
            key={p.key}
            className={`period-tab${period === p.key ? ' active' : ''}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI strip */}
      <div className="summary-strip">
        <div className="summary-tile">
          <div className="summary-tile-value">{ps.sessions}</div>
          <div className="summary-tile-label">Sessions{period !== 'all' ? ` · ${periodLabel}` : ''}</div>
        </div>
        <div className="summary-tile">
          <div className="summary-tile-value">{fmt(ps.spend)}</div>
          <div className="summary-tile-label">Spend{period !== 'all' ? ` · ${periodLabel}` : ''}</div>
        </div>
        <div className="summary-tile">
          <div className="summary-tile-value">{active_activities}</div>
          <div className="summary-tile-label">Active Activities</div>
        </div>
        <div className="summary-tile">
          <div className="summary-tile-value" style={{ color: current_streak > 0 ? '#f97316' : undefined }}>
            {current_streak ?? 0} {current_streak === 1 ? 'day' : 'days'}
          </div>
          <div className="summary-tile-label">🔥 Current Streak</div>
        </div>
      </div>

      {/* Activity breakdown charts */}
      {activityCards.length > 0 && (
        <div className="card">
          <div className="card-title">Activity Breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--label-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>Sessions</div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={sessions_by_activity.filter(a => a.count > 0)} dataKey="count" nameKey="display_name"
                    cx="50%" cy="50%" innerRadius={45} outerRadius={75}>
                    {sessions_by_activity.filter(a => a.count > 0).map(a => (
                      <Cell key={a.slug} fill={a.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--label-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>Spend</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={spend_by_activity.filter(a => a.total > 0)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                  <YAxis type="category" dataKey="emoji" tick={{ fontSize: 14 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {spend_by_activity.filter(a => a.total > 0).map(a => (
                      <Cell key={a.slug} fill={a.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Per-activity summary cards */}
      {activityCards.length > 0 && (
        <div className="act-summary-grid">
          {activityCards.map(a => <ActivityCard key={a.slug} act={a} />)}
        </div>
      )}

      {/* Heatmap */}
      {heatmap_dates?.length > 0 && (
        <div className="card">
          <div className="card-title">Activity — Last 52 Weeks</div>
          <CalendarHeatmap sessions={heatmap_dates} />
        </div>
      )}

      {/* Recent activity feed */}
      {recent_sessions?.length > 0 && (
        <div className="card">
          <div className="card-title">Recent Activity</div>
          <div className="recent-feed">
            {recent_sessions.map(s => (
              <Link key={s.id} to={`/sessions/${s.id}`} className="recent-row">
                <span className="recent-act-badge" style={{ background: s.activity.color + '22', color: s.activity.color }}>
                  {s.activity.emoji} {s.activity.display_name}
                </span>
                <span className="recent-date">{formatDate(s.date)}</span>
                <span className="recent-dur">{fmtDuration(s.duration_minutes)}</span>
                <span className="recent-cost">{fmt(s.total_cost)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {total_sessions === 0 && (
        <div className="card empty-state">
          <span className="empty-icon">🏃</span>
          <p>No sessions yet. <Link to="/sessions/new">Log your first activity</Link></p>
        </div>
      )}
    </div>
  );
}
