import { describe, it, expect } from "vitest";
import { AuthError, getErrorStatus } from "../auth";
import { LimitError } from "../limits";

describe("AuthError", () => {
  it("defaults to status 401 with 'Unauthorized' message", () => {
    const error = new AuthError();
    expect(error.message).toBe("Unauthorized");
    expect(error.status).toBe(401);
  });

  it("accepts custom message and status", () => {
    const error = new AuthError("Forbidden", 403);
    expect(error.message).toBe("Forbidden");
    expect(error.status).toBe(403);
  });

  it("is an instance of Error", () => {
    const error = new AuthError();
    expect(error).toBeInstanceOf(Error);
  });
});

describe("LimitError", () => {
  it("has status 403", () => {
    const error = new LimitError("Limit reached");
    expect(error.status).toBe(403);
    expect(error.message).toBe("Limit reached");
  });

  it("is an instance of Error", () => {
    const error = new LimitError("test");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("getErrorStatus", () => {
  it("returns 401 for AuthError with default status", () => {
    expect(getErrorStatus(new AuthError())).toBe(401);
  });

  it("returns 403 for AuthError with 403 status", () => {
    expect(getErrorStatus(new AuthError("Forbidden", 403))).toBe(403);
  });

  it("returns 403 for LimitError", () => {
    expect(getErrorStatus(new LimitError("limit reached"))).toBe(403);
  });

  it("returns 500 for generic Error", () => {
    expect(getErrorStatus(new Error("something broke"))).toBe(500);
  });

  it("returns 500 for non-Error values", () => {
    expect(getErrorStatus("string error")).toBe(500);
    expect(getErrorStatus(null)).toBe(500);
    expect(getErrorStatus(undefined)).toBe(500);
  });
});
