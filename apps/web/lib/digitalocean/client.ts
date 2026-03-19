import { DoApiError } from "./errors";

const DO_API_BASE = "https://api.digitalocean.com/v2/gen-ai";

export function getDoToken(): string {
  const token = process.env.DIGITALOCEAN_API_TOKEN;
  if (!token) throw new Error("DIGITALOCEAN_API_TOKEN not configured");
  return token;
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
  /** Skip JSON parsing (for DELETE that returns no body) */
  raw?: boolean;
  /** Override base URL (for agent chat endpoints) */
  baseUrl?: string;
  /** Override auth token (for agent access keys) */
  token?: string;
}

/**
 * Authenticated request to the DO GenAI API.
 * Throws DoApiError on non-2xx responses.
 */
export async function doFetch<T = unknown>(
  method: HttpMethod,
  path: string,
  options?: RequestOptions,
): Promise<T> {
  const base = options?.baseUrl ?? DO_API_BASE;
  const url = `${base}${path}`;
  const token = options?.token ?? getDoToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options?.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new DoApiError(res.status, text, `${method} ${path}`);
  }

  if (options?.raw || res.status === 204) return undefined as T;

  // Handle empty responses (e.g., DELETE with no body)
  try {
    return await res.json() as T;
  } catch {
    return undefined as T;
  }
}

/**
 * Best-effort request — catches errors and returns null.
 * Used for fire-and-forget DELETE operations.
 */
export async function doFetchSafe<T = unknown>(
  method: HttpMethod,
  path: string,
  options?: RequestOptions,
): Promise<T | null> {
  try {
    return await doFetch<T>(method, path, options);
  } catch (err) {
    console.error(`[doFetchSafe] ${method} ${path} failed:`, err);
    return null;
  }
}

/**
 * Returns the raw Response for endpoints that need custom status handling
 * (e.g., chat endpoint with 401/403 key refresh).
 */
export async function doFetchRaw(
  method: HttpMethod,
  url: string,
  options?: Omit<RequestOptions, "raw" | "baseUrl">,
): Promise<Response> {
  const token = options?.token ?? getDoToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(url, {
    method,
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options?.signal,
  });
}
