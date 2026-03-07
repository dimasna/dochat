import { EventEmitter } from "events";

export interface OrgEvent {
  type:
    | "kb:status"
    | "kb:source:status"
    | "agent:status"
    | "conversation:message"
    | "conversation:status";
  id: string;
  status: string;
  kbId?: string; // For kb:source:status events, the parent KB ID
  conversationId?: string; // For conversation events
  message?: { id: string; role: string; content: string; createdAt: string }; // For conversation:message events
}

type Listener = (event: OrgEvent) => void;

class OrgEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  emit(orgId: string, event: OrgEvent) {
    this.emitter.emit(orgId, event);
  }

  subscribe(orgId: string, listener: Listener): () => void {
    this.emitter.on(orgId, listener);
    return () => {
      this.emitter.off(orgId, listener);
    };
  }
}

// Singleton — survives hot reloads in dev via globalThis
const globalForEventBus = globalThis as unknown as { eventBus?: OrgEventBus };
export const eventBus = globalForEventBus.eventBus ?? new OrgEventBus();
globalForEventBus.eventBus = eventBus;
