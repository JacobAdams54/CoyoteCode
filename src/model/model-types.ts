import type { ToolCall, ToolResult } from "../tools/tool-types.js";

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
 * Every response the model is allowed to return to the agent loop.
 */
export type ModelResponse = ModelToolCallResponse | ModelFinalResponse;

/**
 * Every event that can appear in an agent run.
 *
 * Keeping a complete event history allows the model, UI, and debugging tools
 * to understand how the run reached its current state.
 */
export type AgentEvent =
  | UserEvent
  | ModelToolCallResponse
  | ToolResult
  | ModelFinalResponse;

/**
 * Provider-neutral interface for communicating with a model.
 *
 * The mock model implements this interface now. A real model provider can
 * implement the same contract in a later workshop.
 */
export interface ModelClient {
  respond(events: readonly AgentEvent[]): Promise<ModelResponse>;
}
