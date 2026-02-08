
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './utils/AuthContext';
import { LanguageProvider } from './utils/LanguageContext';
import { storeInviteCode, processPendingInvite } from './utils/inviteHandler';
import { getUserCourses } from './utils/api';
import { STORAGE_KEYS } from './utils/constants';
import { getSelectedCharacter } from './utils/mascotUtils';
import { CHARACTER_MAPPING } from './utils/mascotConfig';
import { ROUTES } from './utils/routes';
import SuccessFeedbackPill from './components/SuccessFeedbackPill';

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
import QuizHistoryList from './views/learning/QuizHistoryList';
import QuizAttemptDetail from './views/learning/QuizAttemptDetail';
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
    return <Navigate to={ROUTES.LOGIN} replace />;
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

// AppInternals: handles hooks that require Router and Auth context
const AppInternals: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Handle reset parameter - clears localStorage and navigates to root
  useEffect(() => {
    const resetParam = searchParams.get('reset');
    if (resetParam === '1') {
      localStorage.clear();
      navigate(ROUTES.ROOT, { replace: true });
    }
  }, [searchParams, navigate]);

  // Detect invite code in URL query params (e.g. /login?invite=CODE)
  useEffect(() => {
    const inviteCode = searchParams.get('invite');

    if (inviteCode) {
      storeInviteCode(inviteCode);
      console.log('Invite code detected and stored:', inviteCode);

      // Clean up invite param from URL after storing
      searchParams.delete('invite');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Process pending invite after authentication
  useEffect(() => {
    if (!user) return;

    const processInvite = async () => {
      const result = await processPendingInvite();
      if (result.success && result.message) {
        setToastMessage(result.message);
        setShowToast(true);
      }
    };

    const timer = setTimeout(() => {
      processInvite();
    }, 1000);

    return () => clearTimeout(timer);
  }, [user]);

  return (
    <>
      <Routes>
        {/* Public route — login / signup */}
        <Route path={ROUTES.LOGIN} element={<LoginView />} />

        {/* Onboarding Flow */}
        <Route path={ROUTES.ROOT} element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
        <Route path={ROUTES.INTERESTS} element={<ProtectedRoute><InterestSelection /></ProtectedRoute>} />
        <Route path={ROUTES.ASSESSMENT} element={<ProtectedRoute><AssessmentChatWithKey /></ProtectedRoute>} />
        <Route path={ROUTES.COMPANION} element={<ProtectedRoute><CompanionSelection /></ProtectedRoute>} />
        <Route path={ROUTES.NOTIFICATIONS} element={<ProtectedRoute><NotificationPermission /></ProtectedRoute>} />
        <Route path={ROUTES.GENERATING} element={<ProtectedRoute><GeneratingCourse /></ProtectedRoute>} />

        {/* Main Learning Flow */}
        <Route path={ROUTES.COURSE_DETAIL} element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
        <Route path={ROUTES.KNOWLEDGE_TREE} element={<ProtectedRoute><KnowledgeTree /></ProtectedRoute>} />
        <Route path={ROUTES.KNOWLEDGE_CARD} element={<ProtectedRoute><KnowledgeCardWithKey /></ProtectedRoute>} />
        <Route path={ROUTES.QUIZ} element={<ProtectedRoute><QuizView /></ProtectedRoute>} />
        <Route path={ROUTES.QUIZ_HISTORY} element={<ProtectedRoute><QuizHistoryList /></ProtectedRoute>} />
        <Route path={ROUTES.QUIZ_ATTEMPT} element={<ProtectedRoute><QuizAttemptDetail /></ProtectedRoute>} />
        <Route path={ROUTES.QA_DETAIL} element={<ProtectedRoute><QADetailRouteView /></ProtectedRoute>} />

        {/* Game Flow */}
        <Route path={ROUTES.GAME} element={<ProtectedRoute><TravelBoard /></ProtectedRoute>} />
        <Route path={ROUTES.GAME_OUTFIT} element={<ProtectedRoute><OutfitView /></ProtectedRoute>} />

        {/* Main Navigation Tabs */}
        <Route path={ROUTES.COURSES} element={<ProtectedRoute><CoursesDashboard /></ProtectedRoute>} />
        <Route path={`${ROUTES.DISCOVERY}/:category`} element={<ProtectedRoute><DiscoveryList /></ProtectedRoute>} />
        <Route path={ROUTES.PROFILE} element={<ProtectedRoute><ProfileView /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to={ROUTES.ROOT} />} />
      </Routes>

      <SuccessFeedbackPill
        isOpen={showToast}
        onClose={() => setShowToast(false)}
        message={toastMessage}
      />
    </>
  );
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
        const onboardingDone = localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED) === 'true';

        if (onboardingDone) {
          // User has completed onboarding before, go to courses
          setHasCourses(true);
          setLoading(false);
          return;
        }

        // Check backend for courses (handles cross-device login)
        const data = await getUserCourses();

        if (data.courses && data.courses.length > 0) {
          // User has courses, mark onboarding as done and go to dashboard
          localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
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
    return <Navigate to={ROUTES.COURSES} replace />;
  }

  return <WelcomeView />;
};

const App: React.FC = () => {
  // 预加载用户当前选择的角色头像（关键资源）
  useEffect(() => {
    try {
      const character = getSelectedCharacter();
      const resourceCharacter = CHARACTER_MAPPING[character];
      const avatarPath = `/compressed_output/processed_image_profile/${resourceCharacter}_profile.jpg`;
      
      // 创建 link 标签预加载头像
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = avatarPath;
      link.setAttribute('fetchpriority', 'high');
      document.head.appendChild(link);
      
      return () => {
        // 清理：移除预加载链接
        const existingLink = document.querySelector(`link[href="${avatarPath}"]`);
        if (existingLink) {
          document.head.removeChild(existingLink);
        }
      };
    } catch (error) {
      console.debug('Failed to preload avatar:', error);
    }
  }, []);

  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <div className="max-w-lg mx-auto min-h-screen bg-white shadow-xl relative overflow-x-hidden">
            <AppInternals />
          </div>
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
};

export default App;
