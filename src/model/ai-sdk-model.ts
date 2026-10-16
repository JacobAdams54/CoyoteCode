import {
  generateText,
  jsonSchema,
  isStepCount,
  tool,
  type LanguageModel,
  type ModelMessage,
  type ProviderMetadata,
  type ToolSet,
} from "ai";

import type { AgentEvent, ModelClient, ModelRequest, ModelTurn } from "./model-types.js";
import type { ToolSummary } from "../tools/tool-types.js";

interface AiSdkToolCall {
  toolCallId: string;
  toolName: string;
  input: unknown;
  providerMetadata?: ProviderMetadata;
}

interface AiSdkGeneration {
  text: string;
  toolCalls: readonly AiSdkToolCall[];
  finishReason?: string;
}

/**
 * Converts CoyoteCode's event history to the AI SDK message format.
 *
 * Tool definitions intentionally do not have execute functions. The custom
 * agent loop remains the only code allowed to execute registered tools.
 */
export function createAiSdkMessages(
  events: readonly AgentEvent[],
): ModelMessage[] {
  return events.map((event): ModelMessage => {
    switch (event.type) {
      case "user":
        return { role: "user", content: event.content };
      case "tool_call": {
        return {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: event.call.id,
              toolName: event.call.name,
              input: event.call.arguments,
              ...(event.call.providerMetadata
                ? {
                    providerOptions:
                      event.call.providerMetadata as ProviderMetadata,
                  }
                : {}),
            },
          ],
        };
      }
      case "tool_result":
        return {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              output: {
                type: "text",
                value: event.success
                  ? JSON.stringify({ success: true, output: event.output })
                  : JSON.stringify({ success: false, error: event.error }),
              },
            },
          ],
        };
      case "final":
        return {
          role: "assistant",
          content: event.content,
        };
    }
  });
}

function createAiSdkTools(tools: readonly ToolSummary[]): ToolSet {
  return Object.fromEntries(
    tools.map((toolSummary) => [
      toolSummary.name,
      tool({
        description: toolSummary.description,
        inputSchema: jsonSchema(toolSummary.inputSchema),
      }),
    ]),
  );
}

/**
 * Translates one AI SDK generation into CoyoteCode's provider-neutral turn.
 */
export function translateAiSdkGeneration(
  generation: AiSdkGeneration,
): ModelTurn {
  if (generation.toolCalls.length > 1) {
    throw new Error(
      "AI SDK returned multiple tool calls, but CoyoteCode supports only one.",
    );
  }

  const toolCall = generation.toolCalls[0];

  if (toolCall) {
    if (!toolCall.toolCallId || !toolCall.toolName) {
      throw new Error("AI SDK returned an incomplete tool call.");
    }

    return {
      response: {
        type: "tool_call",
        call: {
          id: toolCall.toolCallId,
          name: toolCall.toolName,
          arguments: toolCall.input,
          ...(toolCall.providerMetadata
            ? { providerMetadata: toolCall.providerMetadata }
            : {}),
        },
      },
    };
  }

  const finalContent = generation.text.trim();

  if (!finalContent) {
    throw new Error(
      "AI SDK returned neither a tool call nor a final response. " +
        `Finish reason: ${generation.finishReason ?? "unknown"}`,
    );
  }

  return {
    response: {
      type: "final",
      content: finalContent,
    },
  };
}

/**
 * AI SDK implementation of CoyoteCode's provider-neutral ModelClient.
 *
 * Each respond call performs one model generation. Tool execution stays in
 * CoyoteCode's ToolRegistry and agent loop.
 */
export class AiSdkModel implements ModelClient {
  constructor(private readonly model: LanguageModel) {}

  async respond(request: ModelRequest): Promise<ModelTurn> {
    const generation = await generateText({
      model: this.model,
      messages: createAiSdkMessages(request.events),
      tools: createAiSdkTools(request.tools),
      toolChoice: "auto",
      stopWhen: isStepCount(1),
    });

    return translateAiSdkGeneration(generation);
  }
}
