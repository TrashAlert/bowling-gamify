import { router } from '../trpc';
import { syncRouter } from './sync';

/**
 * Procedures are served at /trpc/v1.<router>.<procedure>. Within v1, changes are
 * additive only; old app builds call this API for years.
 */
export const appRouter = router({
  v1: router({
    sync: syncRouter,
  }),
});

export type AppRouter = typeof appRouter;
