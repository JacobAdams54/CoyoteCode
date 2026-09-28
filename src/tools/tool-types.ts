/**
 * A small, provider-neutral subset of JSON Schema.
 *
 * The model uses this schema to understand which arguments a tool accepts.
 * This schema guides the model, but it does not replace runtime validation.
 */
export interface ToolInputSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * A structured request produced by the model.
 *
 * The tool name and arguments are untrusted until application code validates
 * and authorizes them.
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

/**
 * A trusted application function that the agent is allowed to request.
 */
export interface ToolDefinition {
  name: string;
  description: string;

  /**
   * Describes the expected input to the model.
   *
   * The tool's execute function must still validate the input at runtime.
   */
  inputSchema: ToolInputSchema;

  execute: (input: unknown) => Promise<unknown>;
}

/**
 * Tool information safe to expose to a model.
 */
export interface ToolSummary {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

export interface ToolSuccessResult {
  type: "tool_result";
  toolCallId: string;
  toolName: string;
  success: true;
  output: unknown;
}

export interface ToolFailureResult {
  type: "tool_result";
  toolCallId: string;
  toolName: string;
  success: false;
  error: string;
}

export type ToolResult = ToolSuccessResult | ToolFailureResult;
