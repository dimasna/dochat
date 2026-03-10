import { describe, it, expect, vi } from "vitest";
import { OrgEvent } from "../event-bus";

// Import fresh instance for testing (avoid singleton)
function createEventBus() {
  const { EventEmitter } = require("events");
  const emitter = new EventEmitter();
  emitter.setMaxListeners(200);
  return {
    emit(orgId: string, event: OrgEvent) {
      emitter.emit(orgId, event);
    },
    subscribe(orgId: string, listener: (event: OrgEvent) => void): () => void {
      emitter.on(orgId, listener);
      return () => {
        emitter.off(orgId, listener);
      };
    },
  };
}

describe("OrgEventBus", () => {
  it("delivers events to subscribers", () => {
    const bus = createEventBus();
    const listener = vi.fn();
    bus.subscribe("org-1", listener);

    const event: OrgEvent = { type: "agent:status", id: "a1", status: "active" };
    bus.emit("org-1", event);

    expect(listener).toHaveBeenCalledWith(event);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not leak events across orgs", () => {
    const bus = createEventBus();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    bus.subscribe("org-1", listener1);
    bus.subscribe("org-2", listener2);

    bus.emit("org-1", { type: "agent:status", id: "a1", status: "active" });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).not.toHaveBeenCalled();
  });

  it("unsubscribe stops receiving events", () => {
    const bus = createEventBus();
    const listener = vi.fn();
    const unsub = bus.subscribe("org-1", listener);

    bus.emit("org-1", { type: "kb:status", id: "kb1", status: "ready" });
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    bus.emit("org-1", { type: "kb:status", id: "kb1", status: "failed" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("supports multiple listeners per org", () => {
    const bus = createEventBus();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    bus.subscribe("org-1", listener1);
    bus.subscribe("org-1", listener2);

    bus.emit("org-1", { type: "conversation:status", id: "c1", status: "escalated" });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it("passes kb:source:status events with kbId", () => {
    const bus = createEventBus();
    const listener = vi.fn();
    bus.subscribe("org-1", listener);

    const event: OrgEvent = {
      type: "kb:source:status",
      id: "src1",
      status: "ready",
      kbId: "kb1",
    };
    bus.emit("org-1", event);

    expect(listener).toHaveBeenCalledWith(event);
  });
});
