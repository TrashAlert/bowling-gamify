import type { SessionId, UserId } from '@bowling-rpg/contracts';
import type { Logger } from '../logger';

export type DomainEvent = { readonly type: 'SessionIngested'; readonly userId: UserId; readonly sessionId: SessionId };

type EventOf<T extends DomainEvent['type']> = Extract<DomainEvent, { type: T }>;
type Handler<E extends DomainEvent> = (event: E) => Promise<void> | void;

/**
 * In-process domain events, published after the write they describe has
 * committed. A failing handler is logged and never fails the request that
 * published the event: the write already succeeded, and derived state can
 * always be rebuilt.
 */
export class EventBus {
  readonly #handlers = new Map<DomainEvent['type'], Handler<DomainEvent>[]>();

  constructor(private readonly log: Logger) {}

  subscribe<T extends DomainEvent['type']>(type: T, handler: Handler<EventOf<T>>): void {
    const list = this.#handlers.get(type) ?? [];
    list.push(handler as Handler<DomainEvent>);
    this.#handlers.set(type, list);
  }

  async publish(event: DomainEvent): Promise<void> {
    for (const handler of this.#handlers.get(event.type) ?? []) {
      try {
        await handler(event);
      } catch (err) {
        this.log.error({ err, event }, `Handler for ${event.type} failed`);
      }
    }
  }
}
