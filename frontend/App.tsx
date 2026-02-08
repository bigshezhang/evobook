
import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth, initAuthListener } from './utils/AuthContext';
import { storeInviteCode, processPendingInvite } from './utils/inviteHandler';
import { getUserCourses } from './utils/api';
import { useAppStore, resetAllStores } from './utils/stores';
import { ROUTES } from './utils/routes';
import SuccessFeedbackPill from './components/SuccessFeedbackPill';
import { lazyWithPreload } from './utils/lazyImport';

// ── Lazy-loaded view components ─────────────────────────
// Auth
const LoginView = lazyWithPreload(() => import('./views/auth/LoginView'));

// Onboarding
const WelcomeView = lazyWithPreload(() => import('./views/onboarding/WelcomeView'));
const InterestSelection = lazyWithPreload(() => import('./views/onboarding/InterestSelection'));
const AssessmentChat = lazyWithPreload(() => import('./views/onboarding/AssessmentChat'));
const CompanionSelection = lazyWithPreload(() => import('./views/onboarding/CompanionSelection'));
const NotificationPermission = lazyWithPreload(() => import('./views/onboarding/NotificationPermission'));
const GeneratingCourse = lazyWithPreload(() => import('./views/onboarding/GeneratingCourse'));

// Learning
const CourseDetail = lazyWithPreload(() => import('./views/learning/CourseDetail'));
const KnowledgeTree = lazyWithPreload(() => import('./views/learning/KnowledgeTree'));
const KnowledgeCard = lazyWithPreload(() => import('./views/learning/KnowledgeCard'));
const QuizView = lazyWithPreload(() => import('./views/learning/QuizView'));
const QuizHistoryList = lazyWithPreload(() => import('./views/learning/QuizHistoryList'));
const QuizAttemptDetail = lazyWithPreload(() => import('./views/learning/QuizAttemptDetail'));
const QADetailModal = lazyWithPreload(() => import('./views/learning/QADetailModal'));

// Main
const CoursesDashboard = lazyWithPreload(() => import('./views/main/CoursesDashboard'));
const DiscoveryList = lazyWithPreload(() => import('./views/main/DiscoveryList'));
const ProfileView = lazyWithPreload(() => import('./views/main/ProfileView'));

// Game
const GameLayout = lazyWithPreload(() => import('./views/game/GameLayout'));
const TravelBoard = lazyWithPreload(() => import('./views/game/TravelBoard'));
const OutfitView = lazyWithPreload(() => import('./views/game/OutfitView'));

// ── Initialize auth listener once at module level ──────
initAuthListener();

// ── Loading fallback for Suspense ────────────────────────
const PageLoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center h-screen bg-white">
    <span className="inline-block w-10 h-10 border-4 border-gray-200 border-t-secondary rounded-full animate-spin" />
  </div>
);

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

  // Handle reset parameter - clears all stores and navigates to root
  useEffect(() => {
    const resetParam = searchParams.get('reset');
    if (resetParam === '1') {
      resetAllStores();
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
      <Suspense fallback={<PageLoadingSpinner />}>
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

          {/* Game Flow - nested routes share GameLayout to avoid GameHeader remount */}
          <Route path="/game" element={<ProtectedRoute><GameLayout /></ProtectedRoute>}>
            <Route index element={<TravelBoard />} />
            <Route path="outfit" element={<OutfitView />} />
          </Route>

          {/* Main Navigation Tabs */}
          <Route path={ROUTES.COURSES} element={<ProtectedRoute><CoursesDashboard /></ProtectedRoute>} />
          <Route path={`${ROUTES.DISCOVERY}/:category`} element={<ProtectedRoute><DiscoveryList /></ProtectedRoute>} />
          <Route path={ROUTES.PROFILE} element={<ProtectedRoute><ProfileView /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to={ROUTES.ROOT} />} />
        </Routes>
      </Suspense>

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
        // Check store first for quick decision
        const onboardingDone = useAppStore.getState().onboardingCompleted;

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
          useAppStore.getState().setOnboardingCompleted(true);
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
  useEffect(() => {
    // iOS Safari fullscreen optimization
    const setupIOSFullscreen = () => {
      // 1. Prevent pull-to-refresh
      document.body.addEventListener('touchmove', (e) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }, { passive: false });

      // 2. Scroll to top to hide address bar
      const hideAddressBar = () => {
        if (window.scrollY === 0) {
          window.scrollTo(0, 1);
        }
      };

      // 3. Hide address bar after page load
      window.addEventListener('load', hideAddressBar);
      document.addEventListener('DOMContentLoaded', hideAddressBar);

      // 4. iOS device detection and viewport height setup
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        const setViewportHeight = () => {
          const vh = window.innerHeight * 0.01;
          document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        setViewportHeight();
        window.addEventListener('resize', setViewportHeight);
        window.addEventListener('orientationchange', setViewportHeight);

        return () => {
          window.removeEventListener('resize', setViewportHeight);
          window.removeEventListener('orientationchange', setViewportHeight);
        };
      }
    };

    const cleanup = setupIOSFullscreen();
    return cleanup;
  }, []);

  return (
    <BrowserRouter>
      <div className="max-w-lg mx-auto min-h-screen bg-white shadow-xl relative overflow-x-hidden">
        <AppInternals />
      </div>
    </BrowserRouter>
  );
};

export default App;
