import { describe, it, expect, vi, beforeEach } from "vitest";
import { TodoistConnector } from "./todoist.connector.js";
import type { OAuthTokens } from "../types.js";

const config = {
  clientId: "test_client_id",
  clientSecret: "test_secret",
  redirectUri: "http://localhost:3000/connectors/oauth/callback/todoist",
};

const tokens: OAuthTokens = {
  accessToken: "test_access_token",
  refreshToken: "test_refresh_token",
  expiresAt: new Date(Date.now() + 3_600_000),
};

describe("TodoistConnector", () => {
  let connector: TodoistConnector;

  beforeEach(() => {
    connector = new TodoistConnector(config);
    vi.restoreAllMocks();
  });

  describe("getAuthUrl", () => {
    it("includes client_id, redirect_uri, scope, and state", () => {
      const url = connector.getAuthUrl("user-123");
      expect(url).toContain("client_id=test_client_id");
      expect(url).toContain("redirect_uri=");
      expect(url).toContain("state=user-123");
      expect(url).toContain("scope=task%3Aadd%2Cdata%3Aread%2Cdata%3Adelete");
    });
  });

  describe("fetchTasks", () => {
    it("maps Todoist tasks to RemoteTask shape", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve([
              {
                id: "task-1",
                content: "Buy milk",
                description: "From the supermarket",
                is_completed: false,
                priority: 2,
                due: { date: "2026-06-01" },
                labels: ["shopping", "errands"],
              },
            ]),
        }),
      );

      const tasks = await connector.fetchTasks(tokens);

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        sourceId: "task-1",
        title: "Buy milk",
        description: "From the supermarket",
        status: "open",
        priority: 2,
        tags: ["shopping", "errands"],
      });
      expect(tasks[0].dueDate).toBeInstanceOf(Date);
    });

    it('maps completed tasks to status "done"', async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve([
              {
                id: "t2",
                content: "Done task",
                description: "",
                is_completed: true,
                priority: 1,
                due: null,
                labels: [],
              },
            ]),
        }),
      );

      const tasks = await connector.fetchTasks(tokens);
      expect(tasks[0].status).toBe("done");
    });

    it("sets dueDate to null when no due date", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve([
              {
                id: "t3",
                content: "No due",
                description: "",
                is_completed: false,
                priority: 1,
                due: null,
                labels: [],
              },
            ]),
        }),
      );

      const tasks = await connector.fetchTasks(tokens);
      expect(tasks[0].dueDate).toBeNull();
    });
  });

  describe("completeTask", () => {
    it("POSTs to the close endpoint", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));
      await connector.completeTask(tokens, "task-1");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/tasks/task-1/close"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("deleteTask", () => {
    it("sends DELETE to the task endpoint", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));
      await connector.deleteTask(tokens, "task-1");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/tasks/task-1"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
