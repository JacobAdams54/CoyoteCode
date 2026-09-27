import type {
  ToolCall,
  ToolDefinition,
  ToolResult,
  ToolSummary,
} from "./tool-types.js";

/**
 * The application's allowlist and dispatch point for agent tools.
 *
 * A model may request any tool name, but only tools registered here are
 * permitted to execute.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  /**
   * Makes a trusted application function available under a unique name.
   *
   * Duplicate names are rejected because one name must always resolve to one
   * predictable implementation.
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }

    this.tools.set(tool.name, tool);
  }

  /**
   * Returns tool descriptions without exposing executable functions.
   *
   * This information can eventually be displayed in the UI or included in a
   * model request.
   */
  list(): ToolSummary[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  /**
   * Dispatches a model-generated request to a registered tool.
   *
   * Every outcome becomes a structured result so the agent loop has one
   * consistent success and failure protocol.
   */
  async execute(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.name);

    // Model-generated tool names are untrusted until they match the allowlist.
    if (!tool) {
      return {
        type: "tool_result",
        toolCallId: call.id,
        toolName: call.name,
        success: false,
        error: `Unknown tool: ${call.name}`,
      };
    }

    try {
      const output = await tool.execute(call.arguments);

      return {
        type: "tool_result",
        toolCallId: call.id,
        toolName: call.name,
        success: true,
        output,
      };
    } catch (error: unknown) {
      /*
       * A failed tool should not crash the complete agent. Convert the thrown
       * value into a stable error result that other layers can process.
       */
      const message =
        error instanceof Error ? error.message : "Unknown tool error";

      return {
        type: "tool_result",
        toolCallId: call.id,
        toolName: call.name,
        success: false,
        error: message,
      };
    }
  }
}
