import { useEffect, useState } from 'react';
import { getEquipment, getActivityStats, updateEquipment, changePassword, fmt } from '../api';
import { useActivities } from '../context/ActivitiesContext';
import RecoveryBar from '../components/RecoveryBar';

const EQUIP_ACTIVITIES = ['badminton', 'cricket'];

export default function Settings() {
  const { activities } = useActivities();
  const equipActivities = activities.filter(a => EQUIP_ACTIVITIES.includes(a.slug));
  const [activeTab, setActiveTab] = useState('badminton');
  const [equipment, setEquipment] = useState({});
  const [recovery, setRecovery] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwStatus, setPwStatus] = useState('');

  useEffect(() => {
    for (const slug of EQUIP_ACTIVITIES) {
      getEquipment(slug).then(eq => setEquipment(prev => ({ ...prev, [slug]: eq })));
      getActivityStats(slug).then(s => setRecovery(prev => ({ ...prev, [slug]: s.recovery })));
    }
  }, []);

  const getItem = (slug, name) => (equipment[slug] || []).find(e => e.name === name) || {};

  const setField = (slug, name, field) => e =>
    setEquipment(prev => ({
      ...prev,
      [slug]: (prev[slug] || []).map(item => item.name === name ? { ...item, [field]: e.target.value } : item),
    }));

  const handleSave = async () => {
    setSaving(true); setSaved('');
    try {
      const slug = activeTab;
      const equip = equipment[slug] || [];
      await Promise.all(equip.map(item => {
        const payload = { total_cost: +item.total_cost };
        if (item.cost_model === 'hourly') {
          payload.units_per_pack = +item.units_per_pack;
          payload.hours_per_unit = +item.hours_per_unit;
        } else {
          payload.amort_sessions = +item.amort_sessions;
        }
        return updateEquipment(slug, item.name, payload);
      }));
      const s = await getActivityStats(slug);
      setRecovery(prev => ({ ...prev, [slug]: s.recovery }));
      setSaved('Saved');
    } catch { setSaved('error'); }
    finally { setSaving(false); }
  };

  const renderEquipItem = (slug, item) => {
    const rec = recovery[slug]?.[item.name];
    return (
      <div key={item.name} className="settings-section">
        <div className="settings-section-title">{item.emoji} {item.display_name}</div>
        {rec && <div style={{ marginBottom: '0.85rem' }}><RecoveryBar name={item.display_name} emoji={item.emoji} {...rec} hideLabel /></div>}
        <div className="form-row">
          <div className="form-group">
            <label>Purchase / Pack Cost (₹)</label>
            <input type="number" value={item.total_cost || ''} onChange={setField(slug, item.name, 'total_cost')} min="0" step="50" />
          </div>
          {item.cost_model === 'hourly' ? (
            <div className="form-group">
              <label>Units per Pack</label>
              <input type="number" value={item.units_per_pack || ''} onChange={setField(slug, item.name, 'units_per_pack')} min="1" />
            </div>
          ) : (
            <div className="form-group">
              <label>Recover over (sessions)</label>
              <input type="number" value={item.amort_sessions || ''} onChange={setField(slug, item.name, 'amort_sessions')} min="1" />
            </div>
          )}
        </div>
        {item.cost_model === 'hourly' && (
          <div className="form-row">
            <div className="form-group">
              <label>Hours per Unit</label>
              <input type="number" value={item.hours_per_unit || ''} onChange={setField(slug, item.name, 'hours_per_unit')} min="0.5" step="0.5" />
            </div>
            <div className="form-group">
              <label>Cost per Hour</label>
              <input type="text"
                value={item.total_cost && item.units_per_pack && item.hours_per_unit
                  ? `₹${Math.round(item.total_cost / item.units_per_pack / item.hours_per_unit * 100) / 100} / hr`
                  : '—'}
                readOnly />
            </div>
          </div>
        )}
        {item.cost_model === 'per_session' && item.total_cost && item.amort_sessions && (
          <p style={{ fontSize: '0.82rem', color: 'var(--label-3)' }}>
            {fmt(Math.round(item.total_cost / item.amort_sessions * 100) / 100)} charged per session until fully recovered
          </p>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      {saved === 'error' && <div className="alert alert-error">Failed to save — check the server.</div>}
      {saved === 'Saved' && <div className="alert alert-success">Settings saved.</div>}

      {/* Equipment tabs */}
      <div className="card">
        <div className="settings-tabs">
          {equipActivities.map(a => (
            <button
              key={a.slug}
              className={`settings-tab ${activeTab === a.slug ? 'active' : ''}`}
              onClick={() => { setActiveTab(a.slug); setSaved(''); }}
              style={activeTab === a.slug ? { borderBottomColor: a.color, color: a.color } : {}}
            >
              {a.emoji} {a.display_name}
            </button>
          ))}
        </div>

        {(equipment[activeTab] || []).map(item => renderEquipItem(activeTab, item))}

        <button className="btn btn-primary" onClick={handleSave} disabled={saving}
          style={{ width: '100%', justifyContent: 'center' }}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {/* Password change */}
      <div className="card">
        <div className="card-title">Change Password</div>
        {pwStatus === 'ok'       && <div className="alert alert-success">Password updated.</div>}
        {pwStatus === 'mismatch' && <div className="alert alert-error">New passwords do not match.</div>}
        {pwStatus === 'wrong'    && <div className="alert alert-error">Current password is incorrect.</div>}
        {pwStatus === 'short'    && <div className="alert alert-error">New password must be at least 4 characters.</div>}
        <div className="form-group">
          <label>Current Password</label>
          <input type="password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
          </div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
          onClick={async () => {
            setPwStatus('');
            if (pw.next !== pw.confirm) return setPwStatus('mismatch');
            if (pw.next.length < 4) return setPwStatus('short');
            try {
              await changePassword(pw.current, pw.next);
              setPw({ current: '', next: '', confirm: '' });
              setPwStatus('ok');
            } catch { setPwStatus('wrong'); }
          }}>
          Update Password
        </button>
      </div>
    </div>
  );
}
