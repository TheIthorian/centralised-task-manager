import { describe, it, expect } from "vitest";
import { createLogger } from "./index.js";

describe("createLogger", () => {
  it("returns a logger with the given context name", () => {
    const logger = createLogger("test-context");
    expect(logger.bindings()).toMatchObject({ name: "test-context" });
  });

  it("returns a child logger when child() is called", () => {
    const logger = createLogger("parent");
    const child = logger.child({ requestId: "abc" });
    expect(child.bindings()).toMatchObject({ name: "parent", requestId: "abc" });
  });
});
