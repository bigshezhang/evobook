import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { serve } from '@hono/node-server';
import { appRouter } from './root-router';
import { createContext } from './trpc';

const app = new Hono();

// 中间件
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
  }),
);

// 兼容旧前端的 health check 路径
app.get('/healthz', (c) =>
  c.json({ ok: true, ts: new Date().toISOString() }),
);

// tRPC handler — 挂载在 /trpc/*
app.use('/trpc/*', async (c) => {
  const response = await fetchRequestHandler({
    endpoint: '/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
  return response;
});

// 兼容旧 REST 路径的代理层（Phase 2 逐步添加）
// app.route('/api/v1', legacyCompatRouter);

const port = Number(process.env.API_PORT) || 8002;

console.log(`EvoBook API starting on port ${port}`);
serve({ fetch: app.fetch, port });
