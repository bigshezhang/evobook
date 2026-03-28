import { router, publicProcedure } from '../../trpc';

export const healthRouter = router({
  check: publicProcedure.query(() => ({
    ok: true,
    ts: new Date().toISOString(),
  })),
});
