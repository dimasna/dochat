/**
 * Typed fetch wrapper for API calls from client components.
 */
export async function apiClient<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let message: string;
    try {
      const json = JSON.parse(text);
      message = json.error || json.message || text;
    } catch {
      message = text;
    }
    throw new Error(message);
  }

  return res.json();
}
