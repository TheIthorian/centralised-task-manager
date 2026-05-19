import { describe, it, expect } from "vitest";
import { ConnectorRegistry } from "./registry.js";
import type { TaskConnector } from "./types.js";

function makeStubConnector(source: string): TaskConnector {
  return {
    source,
    getAuthUrl: () => "",
    exchangeCode: async () => ({ accessToken: "", refreshToken: "", expiresAt: new Date() }),
    refreshToken: async (t) => t,
    fetchTasks: async () => [],
    createTask: async () => ({
      sourceId: "",
      title: "",
      description: null,
      status: "open",
      priority: null,
      dueDate: null,
      tags: [],
    }),
    updateTask: async () => ({
      sourceId: "",
      title: "",
      description: null,
      status: "open",
      priority: null,
      dueDate: null,
      tags: [],
    }),
    completeTask: async () => undefined,
    deleteTask: async () => undefined,
  };
}

describe("ConnectorRegistry", () => {
  it("registers and retrieves a connector by source", () => {
    const registry = new ConnectorRegistry();
    const connector = makeStubConnector("todoist");
    registry.register(connector);
    expect(registry.get("todoist")).toBe(connector);
  });

  it("throws when getting an unregistered source", () => {
    const registry = new ConnectorRegistry();
    expect(() => registry.get("unknown")).toThrow("No connector registered for source: unknown");
  });

  it("lists all registered sources", () => {
    const registry = new ConnectorRegistry();
    registry.register(makeStubConnector("todoist"));
    registry.register(makeStubConnector("google_tasks"));
    expect(registry.list()).toEqual(["todoist", "google_tasks"]);
  });

  it("overwrites a connector when registered twice with same source", () => {
    const registry = new ConnectorRegistry();
    const first = makeStubConnector("todoist");
    const second = makeStubConnector("todoist");
    registry.register(first);
    registry.register(second);
    expect(registry.get("todoist")).toBe(second);
  });
});
