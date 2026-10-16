import type { ToolCall, ToolResult, ToolSummary } from "../tools/tool-types.js";

/**
 * The initial task submitted by the user.
 */
export interface UserEvent {
  type: "user";
  content: string;
}

/**
 * A model response requesting that the application execute a tool.
 */
export interface ModelToolCallResponse {
  type: "tool_call";
  call: ToolCall;
}

/**
 * A model response indicating that no more tools are needed.
 */
export interface ModelFinalResponse {
  type: "final";
  content: string;
}

/**
 * Every response the model may return to the agent loop.
 */
export type ModelResponse = ModelToolCallResponse | ModelFinalResponse;

/**
 * Every event that can appear in an agent run.
 *
 * The event history records the user request, model decisions, tool results,
 * and final answer in the order they occurred.
 */
export type AgentEvent =
  | UserEvent
  | ModelToolCallResponse
  | ToolResult
  | ModelFinalResponse;

/**
 * Provider-neutral input sent from the agent loop to a model adapter.
 *
 * The agent loop does not need to know how a provider represents tools,
 * conversations, or function results.
 */
export interface ModelRequest {
  events: readonly AgentEvent[];
  tools: readonly ToolSummary[];
}

/**
 * Provider-neutral result returned from a model adapter.
 */
export interface ModelTurn {
  response: ModelResponse;
}

/**
 * Provider-neutral interface used by the agent loop.
 *
 * Provider adapters implement this interface without changing the agent loop.
 */
export interface ModelClient {
  respond(request: ModelRequest): Promise<ModelTurn>;
}
