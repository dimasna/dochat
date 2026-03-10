import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "../api-client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("apiClient", () => {
  it("returns parsed JSON on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1", name: "Test" }),
    });

    const result = await apiClient<{ id: string; name: string }>("/api/test");
    expect(result).toEqual({ id: "1", name: "Test" });
  });

  it("sets Content-Type header to application/json by default", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await apiClient("/api/test");

    expect(mockFetch).toHaveBeenCalledWith("/api/test", {
      headers: { "Content-Type": "application/json" },
    });
  });

  it("merges custom headers with defaults", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await apiClient("/api/test", {
      headers: { Authorization: "Bearer token" },
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/test", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
    });
  });

  it("passes method and body through", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await apiClient("/api/test", {
      method: "POST",
      body: JSON.stringify({ key: "value" }),
    });

    expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    expect(mockFetch.mock.calls[0][1].body).toBe('{"key":"value"}');
  });

  it("throws with error field from JSON error response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ error: "Not found" }),
    });

    await expect(apiClient("/api/test")).rejects.toThrow("Not found");
  });

  it("throws with message field from JSON error response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ message: "Bad request" }),
    });

    await expect(apiClient("/api/test")).rejects.toThrow("Bad request");
  });

  it("throws with raw text when response is not JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: async () => "Internal Server Error",
    });

    await expect(apiClient("/api/test")).rejects.toThrow("Internal Server Error");
  });

  it("prefers error over message field in JSON response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ error: "Specific error", message: "General message" }),
    });

    await expect(apiClient("/api/test")).rejects.toThrow("Specific error");
  });
});
