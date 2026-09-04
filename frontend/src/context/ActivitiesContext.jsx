import { createContext, useContext, useState, useEffect } from 'react';
import { getActivities } from '../api';

const ActivitiesContext = createContext();

export function ActivitiesProvider({ children }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = () => getActivities()
    .then(data => { setActivities(data); setError(null); return data; })
    .catch(err => { setError(err.response?.data?.error || err.message || 'Failed to load activities'); return []; });

  useEffect(() => { refresh().finally(() => setLoading(false)); }, []);

  return (
    <ActivitiesContext.Provider value={{
      activities,
      loading,
      error,
      refresh,
      enabled: activities.filter(a => a.enabled),
    }}>
      {children}
    </ActivitiesContext.Provider>
  );
}

export const useActivities = () => useContext(ActivitiesContext);
