import { EventEmitter } from "events";
import { pgNotifyClient } from "@dochat/db";

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

// Simple dedup: track recent event fingerprints to avoid double-delivery
// when both in-memory and PG NOTIFY fire for the same event in the same process.
const DEDUP_TTL_MS = 5000;
const DEDUP_MAX = 500;

class OrgEventBus {
  private emitter = new EventEmitter();
  private recentEvents = new Map<string, number>(); // fingerprint → timestamp
  private pgListenUnsub: (() => void) | null = null;
  private pgListenActive = false;

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  /** Emit event to all subscribers (in-memory + PG NOTIFY for cross-process). */
  emit(orgId: string, event: OrgEvent) {
    const fingerprint = this.fingerprint(orgId, event);
    this.recentEvents.set(fingerprint, Date.now());
    this.pruneDedup();

    // In-memory delivery (instant, same-process)
    this.emitter.emit(orgId, event);

    // PG NOTIFY for cross-process delivery (async, fire-and-forget)
    const payload = JSON.stringify({ orgId, event });
    if (payload.length <= 7500) {
      pgNotifyClient.notify(payload).catch(() => {
        // PG NOTIFY failed — in-memory delivery already happened
      });
    } else {
      // Payload too large — send without message content, subscribers will get it from DB
      const lightweight = { ...event };
      if (lightweight.message) {
        lightweight.message = { ...lightweight.message, content: "[truncated]" };
      }
      pgNotifyClient
        .notify(JSON.stringify({ orgId, event: lightweight }))
        .catch(() => {});
    }
  }

  /** Subscribe to events for an org. Returns unsubscribe function. */
  subscribe(orgId: string, listener: Listener): () => void {
    this.emitter.on(orgId, listener);
    this.ensurePgListen();

    return () => {
      this.emitter.off(orgId, listener);
    };
  }

  /** Start PG LISTEN once (shared across all subscribers). */
  private ensurePgListen(): void {
    if (this.pgListenActive) return;
    this.pgListenActive = true;

    this.pgListenUnsub = pgNotifyClient.listen((rawPayload) => {
      try {
        const { orgId, event } = JSON.parse(rawPayload) as {
          orgId: string;
          event: OrgEvent;
        };

        // Deduplicate: skip if this event was emitted from this process
        const fingerprint = this.fingerprint(orgId, event);
        if (this.recentEvents.has(fingerprint)) {
          return;
        }

        // Deliver to in-memory subscribers for this orgId
        this.emitter.emit(orgId, event);
      } catch {
        // Invalid payload, skip
      }
    });
  }

  private fingerprint(orgId: string, event: OrgEvent): string {
    // Use event type + id + conversationId + message id for uniqueness
    return `${orgId}:${event.type}:${event.id}:${event.conversationId ?? ""}:${event.message?.id ?? ""}:${event.status}`;
  }

  private pruneDedup(): void {
    if (this.recentEvents.size <= DEDUP_MAX) return;
    const now = Date.now();
    for (const [key, ts] of this.recentEvents) {
      if (now - ts > DEDUP_TTL_MS) {
        this.recentEvents.delete(key);
      }
    }
  }
}

// Singleton — survives hot reloads in dev via globalThis
const globalForEventBus = globalThis as unknown as { eventBus?: OrgEventBus };
export const eventBus = globalForEventBus.eventBus ?? new OrgEventBus();
globalForEventBus.eventBus = eventBus;
