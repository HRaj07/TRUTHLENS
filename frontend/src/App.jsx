import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { InterviewProvider } from './context/InterviewContext';

// Pages
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import InterviewerDashboard from './pages/InterviewerDashboard';
import CandidateDashboard from './pages/CandidateDashboard';
import InterviewRoom from './pages/InterviewRoom';
import AnalyticsReport from './pages/AnalyticsReport';
import NotFound from './pages/NotFound';

/**
 * ProtectedRoute Component
 * Redirects to /auth if user is not authenticated.
 * Optional role check.
 */
const ProtectedRoute = ({ children, role }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-neon-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'interviewer' ? '/dashboard/interviewer' : '/dashboard/candidate'} replace />;
  }

  return children;
};

function AppRoutes() {
  const { user, isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route 
        path="/auth" 
        element={
          isAuthenticated ? (
            <Navigate to={user.role === 'interviewer' ? '/dashboard/interviewer' : '/dashboard/candidate'} replace />
          ) : (
            <AuthPage />
          )
        } 
      />
      <Route 
        path="/signup" 
        element={
          isAuthenticated ? (
            <Navigate to={user.role === 'interviewer' ? '/dashboard/interviewer' : '/dashboard/candidate'} replace />
          ) : (
            <AuthPage />
          )
        } 
      />
      <Route 
        path="/login" 
        element={
          isAuthenticated ? (
            <Navigate to={user.role === 'interviewer' ? '/dashboard/interviewer' : '/dashboard/candidate'} replace />
          ) : (
            <AuthPage />
          )
        } 
      />

      {/* Protected Interviewer Routes */}
      <Route 
        path="/dashboard/interviewer" 
        element={
          <ProtectedRoute role="interviewer">
            <InterviewerDashboard />
          </ProtectedRoute>
        } 
      />

      {/* Protected Candidate Routes */}
      <Route 
        path="/dashboard/candidate" 
        element={
          <ProtectedRoute role="candidate">
            <CandidateDashboard />
          </ProtectedRoute>
        } 
      />

      {/* Shared Interview Room */}
      <Route 
        path="/room/:code" 
        element={
          <ProtectedRoute>
            <InterviewProvider>
              <InterviewRoom />
            </InterviewProvider>
          </ProtectedRoute>
        } 
      />

      {/* Report View */}
      <Route 
        path="/report/:sessionCode" 
        element={
          <ProtectedRoute>
            <AnalyticsReport />
          </ProtectedRoute>
        } 
      />

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
