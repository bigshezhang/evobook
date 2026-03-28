
import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth, initAuthListener } from './utils/AuthContext';
import { storeInviteCode, processPendingInvite } from './utils/inviteHandler';
import { buildLearningPath } from './utils/helpers';
import { trpc } from './utils/trpc/client';
import { useAppStore, resetAllStores } from './utils/stores';
import { ROUTES } from './utils/routes';
import SuccessFeedbackPill from './components/SuccessFeedbackPill';
import { lazyWithPreload } from './utils/lazyImport';
import { TRPCProvider } from './utils/trpc/provider';

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

// 智能根路径重定向：检查用户是否有课程，决定跳转目标
const RootRedirect: React.FC = () => {
  const onboardingDone = useAppStore((s) => s.onboardingCompleted);

  // 仅在 onboarding 未完成时查询后端课程列表（处理跨设备登录）
  const { data: coursesData, isLoading: isLoadingCourses, isError: coursesError } =
    trpc.courseMap.list.useQuery(undefined, {
      enabled: !onboardingDone,
    });

  // 判断用户是否有课程（来自 store 或后端查询结果）
  const hasCourses = onboardingDone || (coursesData?.courses && coursesData.courses.length > 0);

  // 如果后端查询到有课程，同步标记 onboarding 完成
  React.useEffect(() => {
    if (!onboardingDone && coursesData?.courses && coursesData.courses.length > 0) {
      useAppStore.getState().setOnboardingCompleted(true);
    }
  }, [onboardingDone, coursesData]);

  // 仅在确认有课程时获取活跃课程 ID
  const { data: activeData, isLoading: isLoadingActive } =
    trpc.profile.getActiveCourse.useQuery(undefined, {
      enabled: !!hasCourses,
    });

  // 仍在加载中
  if (!onboardingDone && isLoadingCourses) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <span className="inline-block w-10 h-10 border-4 border-gray-200 border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  // 没有课程且不是 onboarding 完成状态 → 显示 Welcome
  if (!hasCourses) {
    return <WelcomeView />;
  }

  // 有课程但还在获取活跃课程 ID
  if (isLoadingActive) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <span className="inline-block w-10 h-10 border-4 border-gray-200 border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  // 有活跃课程 → 跳转知识树
  if (activeData?.courseMapId) {
    return <Navigate to={buildLearningPath(ROUTES.KNOWLEDGE_TREE, { cid: activeData.courseMapId })} replace />;
  }

  // 有课程但无活跃课程 → 跳转课程列表
  return <Navigate to={ROUTES.COURSES} replace />;
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
    <TRPCProvider>
      <BrowserRouter>
        <div className="max-w-lg mx-auto min-h-screen bg-white shadow-xl relative overflow-x-hidden">
          <AppInternals />
        </div>
      </BrowserRouter>
    </TRPCProvider>
  );
};

export default App;
