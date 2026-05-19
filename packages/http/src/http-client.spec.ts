import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpClient } from "./index.js";
import { ExternalServiceError } from "@ctm/errors";

describe("HttpClient", () => {
  const client = new HttpClient({ baseUrl: "https://api.example.com" });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends GET to the correct URL and returns parsed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "1", name: "test" }),
      }),
    );

    const result = await client.get<{ id: string; name: string }>("/items/1");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/items/1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result).toEqual({ id: "1", name: "test" });
  });

  it("sends POST with JSON body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: "2" }),
      }),
    );

    await client.post("/items", { name: "new item" });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/items",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "new item" }),
      }),
    );
  });

  it("returns undefined for 204 No Content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      }),
    );

    const result = await client.delete("/items/1");
    expect(result).toBeUndefined();
  });

  it("throws ExternalServiceError on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve("Too Many Requests"),
      }),
    );

    await expect(client.get("/items")).rejects.toThrow(ExternalServiceError);
    await expect(client.get("/items")).rejects.toThrow("429");
  });

  it("merges default headers with per-request headers", async () => {
    const authedClient = new HttpClient({
      baseUrl: "https://api.example.com",
      headers: { Authorization: "Bearer tok" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      }),
    );

    await authedClient.get("/me", { "X-Request-Id": "abc" });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer tok",
          "X-Request-Id": "abc",
        }),
      }),
    );
  });
});
