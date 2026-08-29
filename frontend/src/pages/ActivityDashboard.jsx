import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getActivityStats, getExpenses, createExpense, deleteExpense, fmt, fmtDuration, fmtPace } from '../api';
import { useActivities } from '../context/ActivitiesContext';
import RecoveryBar from '../components/RecoveryBar';
import CalendarHeatmap from '../components/CalendarHeatmap';
import {
  ComposedChart, Bar, Line, BarChart, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

function monthLabel(m) {
  const [yr, mo] = m.split('-');
  return new Date(yr, mo - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function ComboTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: '0.85rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {p.dataKey === 'total' ? fmt(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, padding: '0.5rem 0.75rem', fontSize: '0.84rem' }}>
      <strong>{p.name}</strong>: {p.value}
    </div>
  );
}

const PIE_COLORS = ['#22c55e','#3b82f6','#f97316','#ef4444','#a855f7','#eab308','#06b6d4'];

// Per-activity starter suggestions — user can type anything, these are just hints
const EXPENSE_HINTS = {
  badminton: ['Shuttle', 'Racket', 'String', 'Grip tape', 'Shoes', 'Dress', 'Wristband', 'Court bag'],
  swimming:  ['Goggles', 'Cap', 'Swimwear', 'Pool membership', 'Kickboard', 'Pull buoy', 'Fins'],
  gym:       ['Membership', 'Protein', 'Supplements', 'Pre-workout', 'Gym bag', 'Gloves', 'Belt', 'Shoes'],
  run:       ['Shoes', 'Electrolytes', 'Salts', 'Gels', 'Nutrition bars', 'GPS watch', 'Race entry', 'Socks', 'Compression gear'],
  cricket:   ['Ball', 'Bat', 'Gloves', 'Pads', 'Helmet', 'Guard', 'Dress', 'Shoes', 'Kit bag', 'Grip'],
};
const getHints = (slug) => EXPENSE_HINTS[slug] || ['Equipment', 'Gear', 'Membership', 'Clothing'];

const today = new Date().toISOString().slice(0, 10);

const PERIODS = [
  { key: 'all',   label: 'All Time' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year',  label: 'This Year' },
];

// ── Expenses section ───────────────────────────────
function ExpensesSection({ slug, activity }) {
  const [expenses, setExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: today, category: '', amount: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getExpenses(slug).then(setExpenses).catch(() => {});
  }, [slug]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleAdd = async (ev) => {
    ev.preventDefault();
    if (!form.amount || !form.category.trim()) return;
    setSaving(true);
    try {
      const expense = await createExpense(slug, { ...form, category: form.category.trim() });
      setExpenses(prev => [expense, ...prev]);
      setForm({ date: today, category: '', amount: '', description: '' });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteExpense(id);
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  // Suggestions = predefined hints + unique categories already used (deduped, case-insensitive)
  const usedCats = [...new Set(expenses.map(e => e.category))];
  const hints = getHints(slug);
  const allSuggestions = [...new Set([...hints, ...usedCats])];

  // Category breakdown summary
  const byCategory = expenses.reduce((acc, e) => {
    const k = e.category;
    if (!acc[k]) acc[k] = { total: 0, count: 0 };
    acc[k].total += e.amount;
    acc[k].count += 1;
    return acc;
  }, {});
  const categorySummary = Object.entries(byCategory)
    .sort((a, b) => b[1].total - a[1].total);

  // Monthly expense chart data (group by YYYY-MM, sorted ascending)
  const byMonth = expenses.reduce((acc, e) => {
    const m = e.date.slice(0, 7);
    acc[m] = (acc[m] || 0) + e.amount;
    return acc;
  }, {});
  const expenseChartData = Object.entries(byMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, total]) => ({ month: monthLabel(month), total }));

  const datalistId = `exp-hints-${slug}`;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <div className="card-title" style={{ marginBottom: 0 }}>Equipment &amp; Expenses</div>
          {expenses.length > 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--label-3)', marginTop: '0.2rem' }}>
              {expenses.length} purchase{expenses.length !== 1 ? 's' : ''} · total {fmt(total)}
            </div>
          )}
        </div>
        <button
          className="btn btn-sm"
          style={{ background: activity.color + '18', color: activity.color, border: 'none', fontWeight: 600 }}
          onClick={() => setShowForm(v => !v)}
        >
          {showForm ? 'Cancel' : '+ Log Purchase'}
        </button>
      </div>

      {/* Category summary chips */}
      {categorySummary.length > 0 && !showForm && (
        <div className="expense-summary-chips">
          {categorySummary.map(([cat, { total: t, count }]) => (
            <div key={cat} className="expense-chip" style={{ borderColor: activity.color + '44' }}>
              <span className="expense-chip-name">{cat}</span>
              <span className="expense-chip-count" style={{ color: activity.color }}>{count}×</span>
              <span className="expense-chip-total">{fmt(t)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Datalist for autocomplete */}
      <datalist id={datalistId}>
        {allSuggestions.map(s => <option key={s} value={s} />)}
      </datalist>

      {showForm && (
        <form onSubmit={handleAdd} className="expense-form">
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={set('date')} required />
            </div>
            <div className="form-group">
              <label>Item / Equipment</label>
              <input
                type="text"
                value={form.category}
                onChange={set('category')}
                list={datalistId}
                placeholder="e.g. Shuttle, Shoes, Racket…"
                required
                autoComplete="off"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Amount (₹)</label>
              <input type="number" value={form.amount} onChange={set('amount')} min="0" step="10" placeholder="0" required />
            </div>
            <div className="form-group">
              <label>Note (optional)</label>
              <input type="text" value={form.description} onChange={set('description')} placeholder="e.g. Yonex Mavis 350, size 10" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '0.25rem' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      {/* Expense trend line chart — only when 2+ months of data */}
      {expenseChartData.length >= 2 && !showForm && (
        <div style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--label-3)', marginBottom: '0.4rem' }}>
            Spend over time
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={expenseChartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id={`expGrad-${slug}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={activity.color} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={activity.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} width={50} />
              <Tooltip formatter={v => [fmt(v), 'Spend']} labelStyle={{ fontWeight: 700 }} contentStyle={{ borderRadius: 10, fontSize: '0.83rem', border: '1px solid #e5e5ea' }} />
              <Area type="monotone" dataKey="total" stroke={activity.color} strokeWidth={2.5}
                fill={`url(#expGrad-${slug})`} dot={{ r: 4, fill: activity.color, strokeWidth: 0 }}
                activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {expenses.length > 0 ? (
        <div className="expense-list" style={{ marginTop: expenseChartData.length >= 2 && !showForm ? '0.75rem' : (categorySummary.length > 0 && !showForm ? '0.85rem' : 0) }}>
          {expenses.map(e => (
            <div key={e.id} className="expense-row">
              <span className="expense-category" style={{ color: activity.color }}>{e.category}</span>
              {e.description && <span className="expense-desc">{e.description}</span>}
              <span className="expense-date">{new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span className="expense-amount">{fmt(e.amount)}</span>
              <button className="expense-delete" onClick={() => handleDelete(e.id)} title="Delete">×</button>
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <p style={{ color: 'var(--label-4)', fontSize: '0.88rem', margin: 0 }}>
            No expenses logged yet. Track gear purchases, memberships, and more.
          </p>
        )
      )}
    </div>
  );
}

// ── Badminton dashboard ────────────────────────────
function BadmintonDashboard({ stats, activity }) {
  const { recovery, monthly = [], total_court, avg_players } = stats;
  const totalSessions = monthly.reduce((s, m) => s + m.sessions, 0);
  const grandTotal    = monthly.reduce((s, m) => s + m.total, 0);
  const chartData = [...monthly].reverse().map(m => ({ month: monthLabel(m.month), total: m.total, sessions: m.sessions }));

  return (
    <>
      <div className="summary-strip">
        <div className="summary-tile"><div className="summary-tile-value">{totalSessions}</div><div className="summary-tile-label">Sessions</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{fmt(grandTotal)}</div><div className="summary-tile-label">Total Spend</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{fmt(total_court ?? 0)}</div><div className="summary-tile-label">Court Spend</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{avg_players ?? 0}</div><div className="summary-tile-label">Avg Players</div></div>
      </div>

      {recovery && (
        <div className="card">
          <div className="card-title">Equipment Recovery</div>
          {recovery.racket && <RecoveryBar name="Racket" emoji="🏓" {...recovery.racket} color={activity.color} />}
          {recovery.shoe   && <RecoveryBar name="Shoe"   emoji="👟" {...recovery.shoe}   color={activity.color} />}
        </div>
      )}

      {chartData.length > 0 && (
        <div className="card">
          <div className="card-title">Sessions &amp; Spend</div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: '#aeaeb2' }} axisLine={false} tickLine={false} width={28} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#aeaeb2' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} width={52} />
              <Tooltip content={<ComboTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              <Bar yAxisId="left" dataKey="sessions" fill={activity.color} radius={[5,5,0,0]} name="Sessions" />
              <Line yAxisId="right" type="monotone" dataKey="total" stroke="#1b5e3b" strokeWidth={2} dot={{ r: 3 }} name="Total Spend" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

// ── Swimming dashboard ─────────────────────────────
function SwimmingDashboard({ stats, activity }) {
  const { total_distance_km, avg_laps, total_fees, stroke_breakdown = [], monthly = [] } = stats;
  const totalSessions = monthly.reduce((s, m) => s + m.sessions, 0);
  const chartData = [...monthly].reverse().map(m => ({ month: monthLabel(m.month), sessions: m.sessions }));

  return (
    <>
      <div className="summary-strip">
        <div className="summary-tile"><div className="summary-tile-value">{totalSessions}</div><div className="summary-tile-label">Sessions</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{total_distance_km ?? 0} km</div><div className="summary-tile-label">Total Distance</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{avg_laps ?? 0}</div><div className="summary-tile-label">Avg Laps</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{fmt(total_fees ?? 0)}</div><div className="summary-tile-label">Total Fees</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {chartData.length > 0 && (
          <div className="card">
            <div className="card-title">Monthly Sessions</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="sessions" fill={activity.color} radius={[4,4,0,0]} name="Sessions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {stroke_breakdown.length > 0 && (
          <div className="card">
            <div className="card-title">Stroke Breakdown</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={stroke_breakdown} dataKey="count" nameKey="stroke" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                  {stroke_breakdown.map((s, i) => <Cell key={s.stroke} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', marginTop: '0.5rem' }}>
              {stroke_breakdown.map((s, i) => (
                <span key={s.stroke} style={{ fontSize: '0.75rem', color: PIE_COLORS[i % PIE_COLORS.length], fontWeight: 600, textTransform: 'capitalize' }}>
                  ● {s.stroke} ({s.count})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Gym dashboard ──────────────────────────────────
function GymDashboard({ stats, activity }) {
  const { session_type_breakdown = [], streak, avg_duration_min, monthly = [] } = stats;
  const totalSessions = monthly.reduce((s, m) => s + m.sessions, 0);
  const totalSpend    = monthly.reduce((s, m) => s + m.total, 0);
  const chartData = [...monthly].reverse().map(m => ({ month: monthLabel(m.month), sessions: m.sessions }));

  return (
    <>
      <div className="summary-strip">
        <div className="summary-tile"><div className="summary-tile-value">{totalSessions}</div><div className="summary-tile-label">Sessions</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{fmt(totalSpend)}</div><div className="summary-tile-label">Total Spend</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{fmtDuration(avg_duration_min)}</div><div className="summary-tile-label">Avg Duration</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{streak ?? 0}</div><div className="summary-tile-label">Day Streak</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {chartData.length > 0 && (
          <div className="card">
            <div className="card-title">Monthly Sessions</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="sessions" fill={activity.color} radius={[4,4,0,0]} name="Sessions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {session_type_breakdown.length > 0 && (
          <div className="card">
            <div className="card-title">Session Types</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={session_type_breakdown} dataKey="count" nameKey="session_type" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                  {session_type_breakdown.map((s, i) => <Cell key={s.session_type} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', marginTop: '0.5rem' }}>
              {session_type_breakdown.map((s, i) => (
                <span key={s.session_type} style={{ fontSize: '0.75rem', color: PIE_COLORS[i % PIE_COLORS.length], fontWeight: 600, textTransform: 'capitalize' }}>
                  ● {s.session_type || 'Unknown'} ({s.count})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Run dashboard ──────────────────────────────────
function RunDashboard({ stats, activity }) {
  const { total_distance_km, avg_pace_sec_per_km, best_pace_sec_per_km, longest_run_km, run_type_breakdown = [], monthly = [] } = stats;
  const totalSessions = monthly.reduce((s, m) => s + m.sessions, 0);
  const chartData = [...monthly].reverse().map(m => ({ month: monthLabel(m.month), sessions: m.sessions, total: m.total }));

  return (
    <>
      <div className="summary-strip">
        <div className="summary-tile"><div className="summary-tile-value">{totalSessions}</div><div className="summary-tile-label">Runs</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{total_distance_km ?? 0} km</div><div className="summary-tile-label">Total Distance</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{fmtPace(avg_pace_sec_per_km)}</div><div className="summary-tile-label">Avg Pace</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{longest_run_km ?? 0} km</div><div className="summary-tile-label">Longest Run</div></div>
      </div>

      {best_pace_sec_per_km && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="card-title">Personal Best Pace</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: activity.color, letterSpacing: '-0.03em' }}>
            {fmtPace(best_pace_sec_per_km)}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {chartData.length > 0 && (
          <div className="card">
            <div className="card-title">Monthly Runs</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="sessions" fill={activity.color} radius={[4,4,0,0]} name="Runs" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {run_type_breakdown.length > 0 && (
          <div className="card">
            <div className="card-title">Run Type</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={run_type_breakdown} dataKey="count" nameKey="run_type" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                  {run_type_breakdown.map((r, i) => <Cell key={r.run_type} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', marginTop: '0.5rem' }}>
              {run_type_breakdown.map((r, i) => (
                <span key={r.run_type} style={{ fontSize: '0.75rem', color: PIE_COLORS[i % PIE_COLORS.length], fontWeight: 600, textTransform: 'capitalize' }}>
                  ● {r.run_type} ({r.count})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Cricket dashboard ──────────────────────────────
function CricketDashboard({ stats, activity }) {
  const { recovery, match_type_breakdown = [], total_overs, total_ground_fees, monthly = [] } = stats;
  const totalSessions = monthly.reduce((s, m) => s + m.sessions, 0);
  const grandTotal    = monthly.reduce((s, m) => s + m.total, 0);
  const chartData = [...monthly].reverse().map(m => ({ month: monthLabel(m.month), sessions: m.sessions }));

  return (
    <>
      <div className="summary-strip">
        <div className="summary-tile"><div className="summary-tile-value">{totalSessions}</div><div className="summary-tile-label">Matches</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{fmt(grandTotal)}</div><div className="summary-tile-label">Total Spend</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{total_overs ?? 0}</div><div className="summary-tile-label">Total Overs</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{fmt(total_ground_fees ?? 0)}</div><div className="summary-tile-label">Ground Fees</div></div>
      </div>

      {recovery?.bat && (
        <div className="card">
          <div className="card-title">Equipment Recovery</div>
          <RecoveryBar name="Bat" emoji="🪵" {...recovery.bat} color={activity.color} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {chartData.length > 0 && (
          <div className="card">
            <div className="card-title">Monthly Matches</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="sessions" fill={activity.color} radius={[4,4,0,0]} name="Matches" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {match_type_breakdown.length > 0 && (
          <div className="card">
            <div className="card-title">Match Types</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={match_type_breakdown} dataKey="count" nameKey="match_type" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                  {match_type_breakdown.map((m, i) => <Cell key={m.match_type} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', marginTop: '0.5rem' }}>
              {match_type_breakdown.map((m, i) => (
                <span key={m.match_type} style={{ fontSize: '0.75rem', color: PIE_COLORS[i % PIE_COLORS.length], fontWeight: 600, textTransform: 'capitalize' }}>
                  ● {m.match_type || 'Unknown'} ({m.count})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Generic custom activity dashboard ─────────────
function GenericDashboard({ stats, activity }) {
  const { monthly = [] } = stats;
  const totalSessions = monthly.reduce((s, m) => s + m.sessions, 0);
  const grandTotal    = monthly.reduce((s, m) => s + m.total, 0);
  const chartData = [...monthly].reverse().map(m => ({ month: monthLabel(m.month), sessions: m.sessions }));

  return (
    <>
      <div className="summary-strip">
        <div className="summary-tile"><div className="summary-tile-value">{totalSessions}</div><div className="summary-tile-label">Sessions</div></div>
        <div className="summary-tile"><div className="summary-tile-value">{fmt(grandTotal)}</div><div className="summary-tile-label">Total Spend</div></div>
      </div>
      {chartData.length > 0 && (
        <div className="card">
          <div className="card-title">Monthly Sessions</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="sessions" fill={activity.color} radius={[4,4,0,0]} name="Sessions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

// ── Main component ─────────────────────────────────
export default function ActivityDashboard({ slug: propSlug }) {
  const { slug: paramSlug } = useParams();
  const slug = propSlug ?? paramSlug;
  const { activities } = useActivities();
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('all');

  const activity = activities.find(a => a.slug === slug);

  useEffect(() => {
    if (slug) getActivityStats(slug).then(setStats).catch(() => setStats({}));
  }, [slug]);

  if (!activity || !stats) return null;

  const ps = stats.period_stats?.[period];
  const periodLabel = PERIODS.find(p => p.key === period)?.label;

  const builtinSlugs = ['badminton', 'swimming', 'gym', 'run', 'cricket'];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '2rem' }}>{activity.emoji}</span>
          <h1 className="page-title" style={{ color: activity.color }}>{activity.display_name}</h1>
        </div>
        <Link to={`/sessions/new?activity=${slug}`} className="btn btn-primary">+ Log Session</Link>
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

      {/* Period summary card (shown when not "All Time") */}
      {period !== 'all' && ps && (
        <div className="card" style={{ borderLeft: `4px solid ${activity.color}`, marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--label-3)', marginBottom: '0.75rem' }}>
            {periodLabel}
          </div>
          <div style={{ display: 'flex', gap: '2.5rem' }}>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', color: activity.color }}>{ps.sessions}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--label-3)', fontWeight: 500 }}>Sessions</div>
            </div>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', color: activity.color }}>{fmt(ps.spend)}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--label-3)', fontWeight: 500 }}>Spend</div>
            </div>
          </div>
        </div>
      )}

      {slug === 'badminton' && <BadmintonDashboard stats={stats} activity={activity} />}
      {slug === 'swimming'  && <SwimmingDashboard  stats={stats} activity={activity} />}
      {slug === 'gym'       && <GymDashboard       stats={stats} activity={activity} />}
      {slug === 'run'       && <RunDashboard        stats={stats} activity={activity} />}
      {slug === 'cricket'   && <CricketDashboard   stats={stats} activity={activity} />}
      {!builtinSlugs.includes(slug) && (
        <GenericDashboard stats={stats} activity={activity} />
      )}

      {/* Expenses */}
      <ExpensesSection slug={slug} activity={activity} />

      {/* Calendar heatmap — all activities */}
      {(stats.heatmap_dates?.length > 0) && (
        <div className="card">
          <div className="card-title">Activity — Last 52 Weeks</div>
          <CalendarHeatmap sessions={stats.heatmap_dates} />
        </div>
      )}

      {/* Monthly summary table */}
      {(stats.monthly || []).length > 0 && (
        <div className="card">
          <div className="card-title">Monthly Summary</div>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Sessions</th>
                <th>Total</th>
                <th>Avg / Session</th>
              </tr>
            </thead>
            <tbody>
              {stats.monthly.map(m => (
                <tr key={m.month}>
                  <td style={{ fontWeight: 500 }}>
                    {new Date(m.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </td>
                  <td>{m.sessions}</td>
                  <td className="mono" style={{ fontWeight: 600, color: activity.color }}>{fmt(m.total)}</td>
                  <td className="mono">{fmt(m.avg_session)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(stats.monthly || []).length === 0 && (
        <div className="card empty-state">
          <span className="empty-icon">{activity.emoji}</span>
          <p>No {activity.display_name} sessions yet. <Link to={`/sessions/new?activity=${slug}`}>Log your first</Link></p>
        </div>
      )}
    </div>
  );
}
