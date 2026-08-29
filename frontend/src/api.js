import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Activities
export const getActivities    = ()           => api.get('/activities').then(r => r.data);
export const createActivity   = (data)       => api.post('/activities', data).then(r => r.data);
export const updateActivity   = (slug, data) => api.put(`/activities/${slug}`, data).then(r => r.data);
export const deleteActivity   = (slug)       => api.delete(`/activities/${slug}`).then(r => r.data);

// Equipment (scoped by activity slug)
export const getEquipment    = (slug)             => api.get(`/equipment/${slug}`).then(r => r.data);
export const updateEquipment = (slug, name, data) => api.put(`/equipment/${slug}/${name}`, data).then(r => r.data);

// Sessions
export const getSessions   = (activitySlug) =>
  api.get('/sessions', { params: activitySlug ? { activity: activitySlug } : {} }).then(r => r.data);
export const getSession    = (id)   => api.get(`/sessions/${id}`).then(r => r.data);
export const createSession = (data) => api.post('/sessions', data).then(r => r.data);
export const deleteSession = (id)   => api.delete(`/sessions/${id}`).then(r => r.data);

// Stats
export const getStats         = ()    => api.get('/stats').then(r => r.data);
export const getActivityStats = (slug) => api.get(`/stats/${slug}`).then(r => r.data);

// Activity expenses
export const getExpenses    = (slug)        => api.get(`/expenses/${slug}`).then(r => r.data);
export const createExpense  = (slug, data)  => api.post(`/expenses/${slug}`, data).then(r => r.data);
export const deleteExpense  = (id)          => api.delete(`/expenses/${id}`).then(r => r.data);

// Auth
export const verifyPassword = (password)      => api.post('/auth/verify',  { password }).then(r => r.data.ok);
export const changePassword = (current, next) => api.put('/auth/password', { current, next }).then(r => r.data);

// Formatters
export const fmt = (n) =>
  n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const r2 = (n) => Math.round(n * 100) / 100;

export const fmtDuration = (minutes) => {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

export const fmtPace = (secPerKm) => {
  if (!secPerKm) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
};

export const fmtElapsed = (seconds) => {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};
