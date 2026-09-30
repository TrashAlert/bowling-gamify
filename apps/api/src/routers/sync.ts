import { SyncSessionsInput, SyncSessionsOutput } from '@bowling-rpg/contracts';
import { ingestSessions } from '../services/session-ingest';
import { protectedProcedure, router } from '../trpc';

export const syncRouter = router({
  /** POST /trpc/v1.sync.sessions */
  sessions: protectedProcedure
    .input(SyncSessionsInput)
    .output(SyncSessionsOutput)
    .mutation(({ ctx, input }) => ingestSessions(ctx.deps, ctx.userId, input.sessions, { ip: ctx.ip })),
});
