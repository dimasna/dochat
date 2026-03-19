import { Client } from "pg";

type NotificationCallback = (payload: string) => void;

const CHANNEL = "org_events";
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

class PgNotifyClient {
  private client: Client | null = null;
  private listeners = new Set<NotificationCallback>();
  private connecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;

  /** Send a NOTIFY on the channel. Uses a short-lived connection to avoid blocking the LISTEN connection. */
  async notify(payload: string): Promise<void> {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      // pg escapes the payload for us via parameterized query
      await client.query(`SELECT pg_notify($1, $2)`, [CHANNEL, payload]);
    } finally {
      await client.end().catch(() => {});
    }
  }

  /** Subscribe to notifications. Returns an unsubscribe function. */
  listen(callback: NotificationCallback): () => void {
    this.listeners.add(callback);

    // Start the LISTEN connection if this is the first subscriber
    if (this.listeners.size === 1 && !this.client && !this.connecting) {
      this.connect();
    }

    return () => {
      this.listeners.delete(callback);
      // Disconnect if no more subscribers
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  private async connect(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;

    try {
      const client = new Client({ connectionString: process.env.DATABASE_URL });

      client.on("notification", (msg) => {
        if (msg.channel === CHANNEL && msg.payload) {
          for (const cb of this.listeners) {
            try {
              cb(msg.payload);
            } catch {
              // Individual listener error shouldn't affect others
            }
          }
        }
      });

      client.on("error", () => {
        this.handleDisconnect();
      });

      client.on("end", () => {
        this.handleDisconnect();
      });

      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);

      this.client = client;
      this.connecting = false;
      this.reconnectAttempt = 0;
    } catch {
      this.connecting = false;
      this.scheduleReconnect();
    }
  }

  private handleDisconnect(): void {
    this.client = null;
    if (this.listeners.size > 0 && !this.connecting) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.listeners.size > 0) {
        this.connect();
      }
    }, delay);
  }

  private disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      this.client.end().catch(() => {});
      this.client = null;
    }
    this.connecting = false;
    this.reconnectAttempt = 0;
  }
}

// Singleton via globalThis (survives hot reloads in dev)
const globalForPgNotify = globalThis as unknown as {
  pgNotifyClient?: PgNotifyClient;
};
export const pgNotifyClient =
  globalForPgNotify.pgNotifyClient ?? new PgNotifyClient();
if (process.env.NODE_ENV !== "production")
  globalForPgNotify.pgNotifyClient = pgNotifyClient;
