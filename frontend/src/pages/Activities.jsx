import { useState } from 'react';
import { updateActivity, createActivity, deleteActivity } from '../api';
import { useActivities } from '../context/ActivitiesContext';

const DEFAULT_SLUGS = ['badminton', 'swimming', 'gym', 'run', 'cricket'];

export default function Activities() {
  const { activities, refresh } = useActivities();
  const [newForm, setNewForm] = useState({ display_name: '', emoji: '', color: '#6366f1' });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const toggle = async (act) => {
    await updateActivity(act.slug, { enabled: !act.enabled });
    refresh();
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setAdding(true);
    try {
      await createActivity(newForm);
      setNewForm({ display_name: '', emoji: '', color: '#6366f1' });
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create activity');
    } finally { setAdding(false); }
  };

  const handleDelete = async (act) => {
    if (!window.confirm(`Delete "${act.display_name}"? This cannot be undone.`)) return;
    try {
      await deleteActivity(act.slug);
      refresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Cannot delete this activity');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Activities</h1>
      </div>

      <div className="card">
        <div className="card-title">Manage Activities</div>
        <div className="activity-manage-list">
          {activities.map(act => (
            <div key={act.slug} className={`activity-manage-row ${!act.enabled ? 'disabled' : ''}`}>
              <div className="activity-manage-info">
                <span className="activity-manage-emoji" style={{ color: act.color }}>{act.emoji}</span>
                <span className="activity-manage-name">{act.display_name}</span>
                {!act.enabled && <span className="activity-manage-tag">Hidden</span>}
              </div>
              <div className="activity-manage-actions">
                <button
                  className={`btn btn-sm ${act.enabled ? 'btn-outline' : 'btn-primary'}`}
                  onClick={() => toggle(act)}
                >
                  {act.enabled ? 'Hide' : 'Show'}
                </button>
                {!DEFAULT_SLUGS.includes(act.slug) && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(act)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add custom activity */}
      <div className="card">
        <div className="card-title">Add Custom Activity</div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleAdd}>
          <div className="form-row">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={newForm.display_name}
                onChange={e => setNewForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="e.g. Cycling"
                required
              />
            </div>
            <div className="form-group">
              <label>Emoji</label>
              <input
                type="text"
                value={newForm.emoji}
                onChange={e => setNewForm(f => ({ ...f, emoji: e.target.value }))}
                placeholder="🚴"
                required
                maxLength={4}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Color</label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input
                type="color"
                value={newForm.color}
                onChange={e => setNewForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 48, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 2 }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--label-3)' }}>{newForm.color}</span>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={adding}>
            {adding ? 'Adding…' : '+ Add Activity'}
          </button>
        </form>
      </div>
    </div>
  );
}
