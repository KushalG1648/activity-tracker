import { createContext, useContext, useState, useEffect } from 'react';
import { getActivities } from '../api';

const ActivitiesContext = createContext();

export function ActivitiesProvider({ children }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => getActivities().then(data => { setActivities(data); return data; });

  useEffect(() => { refresh().finally(() => setLoading(false)); }, []);

  return (
    <ActivitiesContext.Provider value={{
      activities,
      loading,
      refresh,
      enabled: activities.filter(a => a.enabled),
    }}>
      {children}
    </ActivitiesContext.Provider>
  );
}

export const useActivities = () => useContext(ActivitiesContext);
