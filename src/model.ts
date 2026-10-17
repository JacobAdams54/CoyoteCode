import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  generateText,
  isStepCount,
  jsonSchema,
  tool,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";
import type { AssistantMessage, Message, ModelClient, ToolSummary } from "./types.js";

/**
 * Converts standard agent messages to AI SDK ModelMessage format.
 */
export function toAiSdkMessages(messages: readonly Message[]): ModelMessage[] {
  return messages.map((msg): ModelMessage => {
    if (msg.role === "user") {
      return { role: "user", content: msg.content };
    }
    if (msg.role === "assistant") {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        return {
          role: "assistant",
          content: msg.toolCalls.map((tc) => ({
            type: "tool-call",
            toolCallId: tc.id,
            toolName: tc.name,
            input: tc.arguments,
          })),
        };
      }
      return { role: "assistant", content: msg.content ?? "" };
    }
    // msg.role === "tool"
    return {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: msg.toolCallId,
          toolName: msg.toolName,
          output: { type: "text", value: msg.content },
        },
      ],
    };
  });
}

export class AiSdkModel implements ModelClient {
  constructor(private readonly model: LanguageModel) {}

  async respond(messages: Message[], tools: ToolSummary[]): Promise<AssistantMessage> {
    const aiTools: ToolSet = Object.fromEntries(
      tools.map((t) => [
        t.name,
        tool({ description: t.description, inputSchema: jsonSchema(t.inputSchema) }),
      ]),
    );

    const result = await generateText({
      model: this.model,
      messages: toAiSdkMessages(messages),
      tools: aiTools,
      toolChoice: "auto",
      stopWhen: isStepCount(1),
    });

    if (result.toolCalls && result.toolCalls.length > 0) {
      return {
        role: "assistant",
        toolCalls: result.toolCalls.map((tc) => ({
          id: tc.toolCallId,
          name: tc.toolName,
          arguments: (tc.input as Record<string, unknown>) ?? {},
        })),
      };
    }

    return {
      role: "assistant",
      content: result.text.trim(),
    };
  }
}

/**
 * Configures the model: Google Gemini (default) or Local LLM / LM Studio.
 */
export function createModelFromEnvironment(
  env: Record<string, string | undefined> = process.env,
): AiSdkModel {
  const provider = (env.AI_PROVIDER || "google").toLowerCase();
  const modelName = env.AI_MODEL || env.GEMINI_MODEL;

  if (provider === "local" || provider === "lmstudio") {
    const baseURL = env.LMSTUDIO_BASE_URL || env.OPENAI_BASE_URL || "http://127.0.0.1:1234/v1";
    const apiKey = env.LMSTUDIO_API_KEY || env.OPENAI_API_KEY || "lm-studio";
    const openai = createOpenAI({ baseURL, apiKey });
    return new AiSdkModel(openai(modelName || "local-model"));
  }

  // Default: Google Gemini
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required. Add it to your local .env file.");
  }
  const google = createGoogleGenerativeAI({ apiKey });
  return new AiSdkModel(google(modelName || "gemini-2.5-flash"));
}
