import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { createSession, getEquipment, getActivityStats, fmt } from '../api';
import { useAuth } from '../context/AuthContext';
import { useActivities } from '../context/ActivitiesContext';
import { calcPreview } from '../utils/activityCalc';

const today = new Date().toISOString().slice(0, 10);

function BadmintonFields({ form, set }) {
  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label>Venue</label>
          <input type="text" value={form.venue || ''} onChange={set('venue')} placeholder="e.g. Sports Arena" />
        </div>
        <div className="form-group">
          <label>Other Players</label>
          <input type="number" value={form.num_other_players || '3'} onChange={set('num_other_players')} min="0" max="20" step="1" />
        </div>
      </div>
      <div className="form-group">
        <label>Court Cost (₹)</label>
        <input type="number" value={form.court_cost || ''} onChange={set('court_cost')} min="0" step="10" placeholder="0" />
      </div>
    </>
  );
}

function SwimmingFields({ form, set }) {
  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label>Pool Name</label>
          <input type="text" value={form.pool_name || ''} onChange={set('pool_name')} placeholder="e.g. City Aquatics" />
        </div>
        <div className="form-group">
          <label>Pool Type</label>
          <select value={form.pool_type || 'indoor'} onChange={set('pool_type')}>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
            <option value="open_water">Open Water</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Stroke Type</label>
          <select value={form.stroke_type || 'freestyle'} onChange={set('stroke_type')}>
            <option value="freestyle">Freestyle</option>
            <option value="breaststroke">Breaststroke</option>
            <option value="backstroke">Backstroke</option>
            <option value="butterfly">Butterfly</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>
        <div className="form-group">
          <label>Entry Fee (₹)</label>
          <input type="number" value={form.entry_fee || ''} onChange={set('entry_fee')} min="0" step="10" placeholder="0" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Laps</label>
          <input type="number" value={form.laps || ''} onChange={set('laps')} min="0" step="1" placeholder="0" />
        </div>
        <div className="form-group">
          <label>Distance (m)</label>
          <input type="number" value={form.distance_m || ''} onChange={set('distance_m')} min="0" step="25" placeholder="0" />
        </div>
      </div>
    </>
  );
}

function GymFields({ form, set }) {
  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label>Gym Name</label>
          <input type="text" value={form.gym_name || ''} onChange={set('gym_name')} placeholder="e.g. FitLife" />
        </div>
        <div className="form-group">
          <label>Session Type</label>
          <select value={form.session_type || 'strength'} onChange={set('session_type')}>
            <option value="strength">Strength</option>
            <option value="cardio">Cardio</option>
            <option value="mixed">Mixed</option>
            <option value="yoga">Yoga</option>
            <option value="hiit">HIIT</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Entry Fee / Session Cost (₹)</label>
        <input type="number" value={form.entry_fee || ''} onChange={set('entry_fee')} min="0" step="10" placeholder="0" />
      </div>
    </>
  );
}

function MarathonFields({ form, set }) {
  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label>Route Name</label>
          <input type="text" value={form.route_name || ''} onChange={set('route_name')} placeholder="e.g. Marina Beach Run" />
        </div>
        <div className="form-group">
          <label>Run Type</label>
          <select value={form.run_type || 'training'} onChange={set('run_type')}>
            <option value="training">Training</option>
            <option value="race">Race</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Distance (km)</label>
          <input type="number" value={form.distance_km || ''} onChange={set('distance_km')} min="0" step="0.1" placeholder="0.0" />
        </div>
        <div className="form-group">
          <label>Time (HH:MM:SS)</label>
          <input type="text" value={form.time_str || ''} onChange={set('time_str')} placeholder="0:30:00" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Elevation Gain (m)</label>
          <input type="number" value={form.elevation_m || ''} onChange={set('elevation_m')} min="0" step="1" placeholder="0" />
        </div>
        <div className="form-group">
          <label>Entry Fee (₹)</label>
          <input type="number" value={form.entry_fee || ''} onChange={set('entry_fee')} min="0" step="10" placeholder="0" />
        </div>
      </div>
    </>
  );
}

function CricketFields({ form, set }) {
  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label>Venue / Ground</label>
          <input type="text" value={form.venue || ''} onChange={set('venue')} placeholder="e.g. Sports Ground" />
        </div>
        <div className="form-group">
          <label>Match Type</label>
          <select value={form.match_type || 'friendly'} onChange={set('match_type')}>
            <option value="friendly">Friendly</option>
            <option value="practice">Practice</option>
            <option value="tournament">Tournament</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Number of Players</label>
          <input type="number" value={form.num_players || '21'} onChange={set('num_players')} min="1" max="30" step="1" />
        </div>
        <div className="form-group">
          <label>Overs</label>
          <input type="number" value={form.overs || ''} onChange={set('overs')} min="0" step="1" placeholder="20" />
        </div>
      </div>
      <div className="form-group">
        <label>Ground Cost (₹)</label>
        <input type="number" value={form.ground_cost || ''} onChange={set('ground_cost')} min="0" step="50" placeholder="0" />
      </div>
    </>
  );
}

function CustomFields({ form, set }) {
  return (
    <div className="form-group">
      <label>Entry / Session Cost (₹)</label>
      <input type="number" value={form.entry_fee || ''} onChange={set('entry_fee')} min="0" step="10" placeholder="0" />
    </div>
  );
}

function parseTimeStr(str) {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseInt(str) || 0;
}

export default function AddSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { enabled } = useActivities();
  const { isUnlocked } = useAuth();

  const preselected = searchParams.get('activity');
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [form, setForm] = useState({ date: today, duration_minutes: '60', transport_cost: '', notes: '' });
  const [equipment, setEquipment] = useState(null);
  const [recoveryTotals, setRecovery] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-select from query param
  useEffect(() => {
    if (preselected && enabled.length) {
      const act = enabled.find(a => a.slug === preselected);
      if (act) setSelectedActivity(act);
    }
  }, [preselected, enabled]);

  // Load equipment + recovery when activity changes
  useEffect(() => {
    if (!selectedActivity) return;
    setEquipment(null);
    setRecovery(null);
    if (selectedActivity.slug === 'badminton' || selectedActivity.slug === 'cricket') {
      getEquipment(selectedActivity.slug).then(setEquipment);
      getActivityStats(selectedActivity.slug).then(s => {
        if (selectedActivity.slug === 'badminton') {
          setRecovery({ total_racket: s.recovery?.racket?.recovered || 0, total_shoe: s.recovery?.shoe?.recovered || 0 });
        } else {
          setRecovery({ total_bat: s.recovery?.bat?.recovered || 0 });
        }
      });
    }
  }, [selectedActivity]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const preview = useMemo(() => {
    if (!selectedActivity) return null;
    return calcPreview(selectedActivity.slug, equipment, recoveryTotals, form);
  }, [selectedActivity, equipment, recoveryTotals, form]);

  const handleSubmit = async ev => {
    ev.preventDefault();
    setError('');
    setLoading(true);
    try {
      const activityData = { ...form };
      delete activityData.date;
      delete activityData.duration_minutes;
      delete activityData.transport_cost;
      delete activityData.notes;

      // Marathon: convert time_str to elapsed_seconds
      if (selectedActivity.slug === 'run' && form.time_str) {
        activityData.elapsed_seconds = parseTimeStr(form.time_str);
        delete activityData.time_str;
      }

      const session = await createSession({
        activity_id:      selectedActivity.id,
        date:             form.date,
        duration_minutes: parseFloat(form.duration_minutes) || 60,
        transport_cost:   parseFloat(form.transport_cost) || 0,
        notes:            form.notes || undefined,
        activityData,
      });
      navigate(`/sessions/${session.id}`);
    } catch {
      setError('Failed to save. Is the server running?');
      setLoading(false);
    }
  };

  if (!selectedActivity) {
    return (
      <div>
        <Link to="/sessions" className="back-link">← Back</Link>
        <div className="page-header">
          <h1 className="page-title">Log Activity</h1>
        </div>
        <div className="card">
          <div className="card-title">Choose Activity</div>
          <div className="activity-picker">
            {enabled.map(a => (
              <button
                key={a.slug}
                className="activity-pick-card"
                style={{ borderTopColor: a.color }}
                onClick={() => setSelectedActivity(a)}
              >
                <span className="pick-emoji">{a.emoji}</span>
                <span className="pick-name">{a.display_name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const showGroupSplit = (selectedActivity.slug === 'badminton' || selectedActivity.slug === 'cricket') && preview;

  return (
    <div>
      <button className="back-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        onClick={() => setSelectedActivity(null)}>
        ← Change Activity
      </button>
      <div className="page-header">
        <h1 className="page-title">
          <span style={{ color: selectedActivity.color }}>{selectedActivity.emoji}</span>{' '}
          Log {selectedActivity.display_name}
        </h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem', alignItems: 'start' }}>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={form.date} onChange={set('date')} required />
              </div>
              <div className="form-group">
                <label>Duration (minutes)</label>
                <input type="number" value={form.duration_minutes} onChange={set('duration_minutes')} min="5" max="480" step="5" required />
              </div>
            </div>

            {selectedActivity.slug === 'badminton' && <BadmintonFields form={form} set={set} />}
            {selectedActivity.slug === 'swimming'  && <SwimmingFields  form={form} set={set} />}
            {selectedActivity.slug === 'gym'        && <GymFields       form={form} set={set} />}
            {selectedActivity.slug === 'run'   && <MarathonFields  form={form} set={set} />}
            {selectedActivity.slug === 'cricket'    && <CricketFields   form={form} set={set} />}
            {!['badminton','swimming','gym','run','cricket'].includes(selectedActivity.slug) && (
              <CustomFields form={form} set={set} />
            )}

            <div className="form-group" style={{ marginTop: '0.25rem' }}>
              <label>Transport Cost (₹)</label>
              <input type="number" value={form.transport_cost} onChange={set('transport_cost')} min="0" step="10" placeholder="0" />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Anything worth noting…" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}>
              {loading ? 'Saving…' : 'Save Session'}
            </button>
          </form>
        </div>

        {/* Live preview */}
        <div className="card">
          <div className="card-title">Live Preview</div>
          {preview ? (
            <>
              <div className="preview-panel">
                {selectedActivity.slug === 'badminton' && (
                  <>
                    {[
                      ['Court',   parseFloat(form.court_cost) || 0],
                      ['Transport', parseFloat(form.transport_cost) || 0],
                      ['Shuttle', preview.shuttle_cost],
                      ['Racket',  preview.racket_charge],
                      ['Shoe',    preview.shoe_charge],
                    ].map(([label, amount]) => (
                      <div key={label} className="preview-row">
                        <span style={{ color: 'var(--label-3)' }}>{label}</span>
                        <span>{amount > 0 ? fmt(amount) : <span style={{ color: 'var(--label-4)', fontSize: '0.8rem' }}>Recovered</span>}</span>
                      </div>
                    ))}
                  </>
                )}
                {selectedActivity.slug === 'cricket' && (
                  <>
                    {[
                      ['Ground',    parseFloat(form.ground_cost) || 0],
                      ['Transport', parseFloat(form.transport_cost) || 0],
                      ['Ball',      preview.ball_cost],
                      ['Bat',       preview.bat_charge],
                    ].map(([label, amount]) => (
                      <div key={label} className="preview-row">
                        <span style={{ color: 'var(--label-3)' }}>{label}</span>
                        <span>{amount > 0 ? fmt(amount) : <span style={{ color: 'var(--label-4)', fontSize: '0.8rem' }}>Recovered</span>}</span>
                      </div>
                    ))}
                  </>
                )}
                {!['badminton','cricket'].includes(selectedActivity.slug) && (
                  <>
                    <div className="preview-row">
                      <span style={{ color: 'var(--label-3)' }}>Entry Fee</span>
                      <span>{fmt(parseFloat(form.entry_fee) || 0)}</span>
                    </div>
                    <div className="preview-row">
                      <span style={{ color: 'var(--label-3)' }}>Transport</span>
                      <span>{fmt(parseFloat(form.transport_cost) || 0)}</span>
                    </div>
                  </>
                )}
                <div className="preview-row total">
                  <span>Total</span>
                  <span>{fmt(preview.session_total)}</span>
                </div>
              </div>

              {showGroupSplit && (
                <div className={isUnlocked ? 'mode-cards' : ''} style={{ marginTop: '0.9rem' }}>
                  <div className="mode-card fair" style={{ padding: '1rem 0.9rem' }}>
                    <div className="mode-label">Fair</div>
                    <div className="mode-amount" style={{ fontSize: '1.5rem' }}>{fmt(preview.per_player_fair)}</div>
                    <div className="mode-sub">per player</div>
                  </div>
                  {isUnlocked && (
                    <div className="mode-card adv" style={{ padding: '1rem 0.9rem' }}>
                      <div className="mode-label">Advantageous</div>
                      <div className="mode-amount" style={{ fontSize: '1.5rem' }}>
                        {preview.per_player_adv != null ? fmt(preview.per_player_adv) : '—'}
                      </div>
                      <div className="mode-sub">per player</div>
                    </div>
                  )}
                </div>
              )}

              {selectedActivity.slug === 'run' && form.distance_km && form.time_str && (() => {
                const dist = parseFloat(form.distance_km);
                const secs = parseTimeStr(form.time_str);
                if (!dist || !secs) return null;
                const pace = secs / dist;
                const pm = Math.floor(pace / 60);
                const ps = Math.round(pace % 60);
                return (
                  <div style={{ marginTop: '0.9rem', padding: '0.75rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--label-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Avg Pace</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{pm}:{String(ps).padStart(2,'0')} /km</div>
                  </div>
                );
              })()}

              {selectedActivity.slug === 'swimming' && form.distance_m && (
                <div style={{ marginTop: '0.9rem', padding: '0.75rem 1rem', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--label-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Distance</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>
                    {(parseFloat(form.distance_m) / 1000).toFixed(2)} km
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--label-4)', fontSize: '0.88rem' }}>
              {selectedActivity.slug === 'badminton' || selectedActivity.slug === 'cricket'
                ? 'Loading equipment…'
                : 'Fill in the form to see cost preview.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
