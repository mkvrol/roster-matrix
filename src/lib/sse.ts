// ──────────────────────────────────────────────
// Roster Matrix — SSE Event Emitter
// In-process pub/sub for Server-Sent Events
// ──────────────────────────────────────────────

export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

type Listener = (event: SSEEvent) => void;

class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(userId: string, listener: Listener): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId)!.add(listener);

    return () => {
      const set = this.listeners.get(userId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.listeners.delete(userId);
      }
    };
  }

  emit(userId: string, event: SSEEvent): void {
    const set = this.listeners.get(userId);
    if (set) {
      set.forEach((listener) => listener(event));
    }
  }

  broadcast(event: SSEEvent): void {
    this.listeners.forEach((set) => {
      set.forEach((listener) => listener(event));
    });
  }

  getConnectedCount(): number {
    let count = 0;
    this.listeners.forEach((set) => {
      count += set.size;
    });
    return count;
  }

  getConnectedUserIds(): string[] {
    return Array.from(this.listeners.keys());
  }
}

const globalForSSE = globalThis as unknown as { eventBus: EventBus | undefined };
export const eventBus = globalForSSE.eventBus ?? new EventBus();
if (process.env.NODE_ENV !== "production") {
  globalForSSE.eventBus = eventBus;
}
