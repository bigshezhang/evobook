
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

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
import LearningChat from './views/learning/LearningChat';
import QuizView from './views/learning/QuizView';

// Game Views
import TravelBoard from './views/game/TravelBoard';
import OutfitView from './views/game/OutfitView';
import HomeShop from './views/game/HomeShop';

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-xl relative overflow-x-hidden">
        <Routes>
          {/* Onboarding Flow */}
          <Route path="/" element={<WelcomeView />} />
          <Route path="/interests" element={<InterestSelection />} />
          <Route path="/assessment" element={<AssessmentChat />} />
          <Route path="/companion" element={<CompanionSelection />} />
          <Route path="/notifications" element={<NotificationPermission />} />
          <Route path="/generating" element={<GeneratingCourse />} />
          
          {/* Main Learning Flow */}
          <Route path="/course-detail" element={<CourseDetail />} />
          <Route path="/knowledge-tree" element={<KnowledgeTree />} />
          <Route path="/knowledge-card" element={<KnowledgeCard />} />
          <Route path="/learning-chat" element={<LearningChat />} />
          <Route path="/quiz" element={<QuizView />} />
          
          {/* Game Flow */}
          <Route path="/game" element={<TravelBoard />} />
          <Route path="/game/outfit" element={<OutfitView />} />
          <Route path="/game/home" element={<HomeShop />} />
          
          {/* Main Navigation Tabs */}
          <Route path="/dashboard" element={<CoursesDashboard />} />
          <Route path="/discovery/:category" element={<DiscoveryList />} />
          <Route path="/profile" element={<ProfileView />} />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </HashRouter>
  );
};

export default App;
