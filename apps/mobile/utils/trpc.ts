import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@evobook/api/src/root-router';

export const trpc = createTRPCReact<AppRouter>();
