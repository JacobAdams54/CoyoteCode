export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  raw?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolSummary {
  name: string;
  description: string;
  parameters: ToolDefinition["parameters"];
}

export interface AssistantMessage {
  role: "assistant";
  content?: string;
  toolCalls?: ToolCall[];
}

export type Message =
  | { role: "user"; content: string }
  | AssistantMessage
  | { role: "tool"; toolCallId: string; toolName: string; content: string };

export interface ModelClient {
  respond(messages: Message[], tools: ToolSummary[]): Promise<AssistantMessage>;
}
