import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ExternalServiceError } from "@ctm/errors";

import { HttpClient } from "./index.js";

const BASE_URL = "https://api.example.com";

describe("HttpClient", () => {
  let mock: MockAdapter;
  let client: HttpClient;

  beforeEach(() => {
    const instance = axios.create({ baseURL: BASE_URL });

    mock = new MockAdapter(instance);
    client = new HttpClient({ baseUrl: BASE_URL }, instance);
  });

  afterEach(() => {
    mock.restore();
  });

  it("sends GET to the correct path and returns parsed JSON", async () => {
    mock.onGet("/items/1").reply(200, { id: "1", name: "test" });

    const result = await client.get<{ id: string; name: string }>("/items/1");

    expect(result).toEqual({ id: "1", name: "test" });
  });

  it("sends POST with JSON body and returns parsed JSON", async () => {
    mock.onPost("/items").reply(201, { id: "2" });

    const result = await client.post<{ id: string }>("/items", { name: "new item" });

    expect(result).toEqual({ id: "2" });
  });

  it("sends PATCH with JSON body and returns parsed JSON", async () => {
    mock.onPatch("/items/1").reply(200, { id: "1", name: "updated" });

    const result = await client.patch<{ id: string; name: string }>("/items/1", {
      name: "updated",
    });

    expect(result).toEqual({ id: "1", name: "updated" });
  });

  it("returns undefined for DELETE 204 No Content", async () => {
    mock.onDelete("/items/1").reply(204);

    const result = await client.delete("/items/1");

    expect(result).toBeUndefined();
  });

  it("throws ExternalServiceError on non-2xx response", async () => {
    mock.onGet("/items").reply(429, "Too Many Requests");

    await expect(client.get("/items")).rejects.toThrow(ExternalServiceError);
    await expect(client.get("/items")).rejects.toThrow("429");
  });

  it("merges per-request headers with instance defaults", async () => {
    const instance = axios.create({
      baseURL: BASE_URL,
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
    });
    const headerMock = new MockAdapter(instance);
    const authedClient = new HttpClient({ baseUrl: BASE_URL }, instance);

    let capturedAuth: unknown;
    let capturedRequestId: unknown;

    headerMock.onGet("/me").reply((config) => {
      capturedAuth = config.headers?.["Authorization"];
      capturedRequestId = config.headers?.["X-Request-Id"];

      return [200, {}];
    });

    await authedClient.get("/me", { "X-Request-Id": "abc" });

    expect(capturedAuth).toBe("Bearer tok");
    expect(capturedRequestId).toBe("abc");

    headerMock.restore();
  });
});
