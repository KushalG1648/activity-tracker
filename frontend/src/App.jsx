import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ActivitiesProvider } from './context/ActivitiesContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import AddSession from './pages/AddSession';
import SessionDetail from './pages/SessionDetail';
import Settings from './pages/Settings';
import Activities from './pages/Activities';
import ActivityDashboard from './pages/ActivityDashboard';

function ProtectedRoute({ children }) {
  const { isUnlocked } = useAuth();
  return isUnlocked ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/"              element={<Dashboard />} />
          <Route path="/activities"    element={<Activities />} />
          <Route path="/sessions"      element={<Sessions />} />
          <Route path="/sessions/new"  element={<AddSession />} />
          <Route path="/sessions/:id"  element={<SessionDetail />} />
          <Route path="/badminton"     element={<ActivityDashboard slug="badminton" />} />
          <Route path="/swimming"      element={<ActivityDashboard slug="swimming" />} />
          <Route path="/gym"           element={<ActivityDashboard slug="gym" />} />
          <Route path="/run"           element={<ActivityDashboard slug="run" />} />
          <Route path="/cricket"       element={<ActivityDashboard slug="cricket" />} />
          <Route path="/settings"      element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/:slug"         element={<ActivityDashboard />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ActivitiesProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ActivitiesProvider>
    </AuthProvider>
  );
}
