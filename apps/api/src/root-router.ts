import { router } from './trpc';
import { healthRouter } from './features/health/router';
import { profileRouter } from './features/profile/router';
import { discoveryRouter } from './features/discovery/router';
import { nodeProgressRouter } from './features/node-progress/router';
import { quizRouter } from './features/quiz/router';
import { gameRouter } from './features/game/router';
import { shopRouter } from './features/shop/router';
import { inventoryRouter } from './features/inventory/router';
import { inviteRouter } from './features/invite/router';
import { learningSessionRouter } from './features/learning-session/router';
import { courseMapRouter } from './features/course-map/router';
import { nodeContentRouter } from './features/node-content/router';
import { onboardingRouter } from './features/onboarding/router';

export const appRouter = router({
  health: healthRouter,
  profile: profileRouter,
  discovery: discoveryRouter,
  onboarding: onboardingRouter,
  courseMap: courseMapRouter,
  nodeProgress: nodeProgressRouter,
  nodeContent: nodeContentRouter,
  quiz: quizRouter,
  learningSession: learningSessionRouter,
  game: gameRouter,
  shop: shopRouter,
  inventory: inventoryRouter,
  invite: inviteRouter,
});

export type AppRouter = typeof appRouter;
