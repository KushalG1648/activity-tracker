import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  return (
    <AuthContext.Provider value={{
      isUnlocked,
      unlock: () => setIsUnlocked(true),
      lock:   () => setIsUnlocked(false),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
