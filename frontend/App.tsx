
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './utils/AuthContext';

// Reset localStorage when ?reset=1 is in URL
const useResetOnParam = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === '1') {
      localStorage.clear();
      // Remove the reset param and reload
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      window.location.reload();
    }
  }, []);
};

// Auth Views
import LoginView from './views/auth/LoginView';

// Views
import WelcomeView from './views/onboarding/WelcomeView';
import InterestSelection from './views/onboarding/InterestSelection';
import AssessmentChat from './views/onboarding/AssessmentChat';
import CompanionSelection from './views/onboarding/CompanionSelection';
import NotificationPermission from './views/onboarding/NotificationPermission';
import GeneratingCourse from './views/onboarding/GeneratingCourse';
import CourseDetail from './views/learning/CourseDetail';
import KnowledgeTree from './views/learning/KnowledgeTree';
import CoursesDashboard from './views/main/CoursesDashboard';
import DiscoveryList from './views/main/DiscoveryList';
import ProfileView from './views/main/ProfileView';
import KnowledgeCard from './views/learning/KnowledgeCard';
import QuizView from './views/learning/QuizView';
import QADetailModal from './views/learning/QADetailModal';

// Game Views
import TravelBoard from './views/game/TravelBoard';
import OutfitView from './views/game/OutfitView';

// ── ProtectedRoute ─────────────────────────────────────
// Shows a loading spinner while auth is being checked, then either renders
// children or redirects to /login.

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <span className="inline-block w-10 h-10 border-4 border-gray-200 border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Wrapper component to force AssessmentChat remount on every navigation
// This prevents flash of old content when re-entering the page
const AssessmentChatWithKey: React.FC = () => {
  const location = useLocation();
  // Using location.key ensures component remounts on each navigation
  return <AssessmentChat key={location.key} />;
};

// Wrapper component to force KnowledgeCard remount on every navigation
// This prevents flash of old content when re-entering the page
const KnowledgeCardWithKey: React.FC = () => {
  const location = useLocation();
  return <KnowledgeCard key={location.key} />;
};

// Simple route wrapper for QA detail view
const QADetailRouteView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state?.data;
  
  return <QADetailModal isOpen={true} onClose={() => navigate(-1)} data={data} />;
};

// Smart root redirect: check if user has courses, then decide where to go
const RootRedirect: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [hasCourses, setHasCourses] = React.useState(false);

  React.useEffect(() => {
    const checkUserCourses = async () => {
      try {
        // Check localStorage first for quick decision
        const onboardingDone = localStorage.getItem('evo_onboarding_completed') === 'true';
        
        if (onboardingDone) {
          // User has completed onboarding before, go to dashboard
          setHasCourses(true);
          setLoading(false);
          return;
        }

        // Check backend for courses (handles cross-device login)
        const { getUserCourses } = await import('./utils/api');
        const data = await getUserCourses();
        
        if (data.courses && data.courses.length > 0) {
          // User has courses, mark onboarding as done and go to dashboard
          localStorage.setItem('evo_onboarding_completed', 'true');
          setHasCourses(true);
        } else {
          // New user, show onboarding
          setHasCourses(false);
        }
      } catch (error) {
        console.error('Failed to check user courses:', error);
        // On error, assume new user and show onboarding
        setHasCourses(false);
      } finally {
        setLoading(false);
      }
    };

    checkUserCourses();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <span className="inline-block w-10 h-10 border-4 border-gray-200 border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  if (hasCourses) {
    return <Navigate to="/courses" replace />;
  }
  
  return <WelcomeView />;
};

const App: React.FC = () => {
  useResetOnParam();
  
  return (
    <AuthProvider>
      <HashRouter>
        <div className="max-w-lg mx-auto min-h-screen bg-white shadow-xl relative overflow-x-hidden">
          <Routes>
            {/* Public route — login / signup */}
            <Route path="/login" element={<LoginView />} />

            {/* Onboarding Flow */}
            <Route path="/" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
            <Route path="/interests" element={<ProtectedRoute><InterestSelection /></ProtectedRoute>} />
            <Route path="/assessment" element={<ProtectedRoute><AssessmentChatWithKey /></ProtectedRoute>} />
            <Route path="/companion" element={<ProtectedRoute><CompanionSelection /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationPermission /></ProtectedRoute>} />
            <Route path="/generating" element={<ProtectedRoute><GeneratingCourse /></ProtectedRoute>} />
            
            {/* Main Learning Flow */}
            <Route path="/course-detail" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
            <Route path="/knowledge-tree" element={<ProtectedRoute><KnowledgeTree /></ProtectedRoute>} />
            <Route path="/knowledge-card" element={<ProtectedRoute><KnowledgeCardWithKey /></ProtectedRoute>} />
            <Route path="/quiz" element={<ProtectedRoute><QuizView /></ProtectedRoute>} />
            <Route path="/qa-detail" element={<ProtectedRoute><QADetailRouteView /></ProtectedRoute>} />
            
            {/* Game Flow */}
            <Route path="/game" element={<ProtectedRoute><TravelBoard /></ProtectedRoute>} />
            <Route path="/game/outfit" element={<ProtectedRoute><OutfitView /></ProtectedRoute>} />
            
            {/* Main Navigation Tabs */}
            <Route path="/courses" element={<ProtectedRoute><CoursesDashboard /></ProtectedRoute>} />
            {/* Keep /dashboard as alias for backward compatibility */}
            <Route path="/dashboard" element={<Navigate to="/courses" replace />} />
            <Route path="/discovery/:category" element={<ProtectedRoute><DiscoveryList /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfileView /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
