import { describe, expect, it } from "vitest";

import { ToolRegistry } from "../src/tools/tool-registry.js";
import type { ToolDefinition } from "../src/tools/tool-types.js";

/**
 * Creates a simple deterministic tool for testing registry behavior.
 *
 * It returns exactly what it receives, making failures easy to attribute to
 * the registry rather than the tool implementation.
 */
function createEchoTool(): ToolDefinition {
  return {
    name: "echo",
    description: "Returns the provided input",
    execute: async (input: unknown) => input,
  };
}

/**
 * These tests define the registry's behavioral contract.
 *
 * Later implementations can change internally as long as these externally
 * visible guarantees remain true.
 */
describe("ToolRegistry", () => {
  it("executes a registered tool", async () => {
    const registry = new ToolRegistry();
    registry.register(createEchoTool());

    const result = await registry.execute({
      id: "call-1",
      name: "echo",
      arguments: {
        message: "Hello",
      },
    });

    expect(result).toEqual({
      type: "tool_result",
      toolCallId: "call-1",
      toolName: "echo",
      success: true,
      output: {
        message: "Hello",
      },
    });
  });

  it("rejects requests for unregistered tools", async () => {
    const registry = new ToolRegistry();

    /*
     * The model can generate arbitrary tool names. Only names in the
     * application-controlled allowlist may execute.
     */
    const result = await registry.execute({
      id: "call-2",
      name: "delete_everything",
      arguments: {},
    });

    expect(result).toEqual({
      type: "tool_result",
      toolCallId: "call-2",
      toolName: "delete_everything",
      success: false,
      error: "Unknown tool: delete_everything",
    });
  });

  it("rejects duplicate tool names", () => {
    const registry = new ToolRegistry();
    const echoTool = createEchoTool();

    registry.register(echoTool);

    /*
     * Silently replacing an existing implementation could unexpectedly
     * change agent behavior or bypass assumptions made elsewhere.
     */
    expect(() => registry.register(echoTool)).toThrow(
      'Tool "echo" is already registered.',
    );
  });

  it("converts tool exceptions into structured failures", async () => {
    const registry = new ToolRegistry();

    registry.register({
      name: "broken_tool",
      description: "Always fails",
      execute: async () => {
        throw new Error("Tool execution failed");
      },
    });

    /*
     * Tool failures become data that can be logged, displayed, and returned
     * to the model instead of terminating the agent process.
     */
    const result = await registry.execute({
      id: "call-3",
      name: "broken_tool",
      arguments: {},
    });

    expect(result).toEqual({
      type: "tool_result",
      toolCallId: "call-3",
      toolName: "broken_tool",
      success: false,
      error: "Tool execution failed",
    });
  });

  it("lists metadata without exposing executable functions", () => {
    const registry = new ToolRegistry();
    registry.register(createEchoTool());

    /*
     * Models and interfaces need descriptive metadata, not direct references
     * to trusted application functions.
     */
    expect(registry.list()).toEqual([
      {
        name: "echo",
        description: "Returns the provided input",
      },
    ]);
  });
});
