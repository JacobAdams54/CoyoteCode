import OpenAI from "openai";
import type { AssistantMessage, Message, ModelClient, ToolSummary } from "./types.js";

export class OpenAiModel implements ModelClient {
  constructor(private readonly client: OpenAI, private readonly model: string) {}

  async respond(messages: Message[], tools: ToolSummary[]): Promise<AssistantMessage> {
    const formattedTools: OpenAI.ChatCompletionTool[] = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const formattedMessages: OpenAI.ChatCompletionMessageParam[] = messages.map((m) => {
      if (m.role === "user") {
        return { role: "user", content: m.content };
      }
      if (m.role === "tool") {
        return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
      }
      if (m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: "assistant",
          content: m.content ?? null,
          tool_calls: m.toolCalls.map((tc) => (tc.raw as OpenAI.ChatCompletionMessageToolCall) ?? {
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          }),
        };
      }
      return {
        role: "assistant",
        content: m.content ?? "",
      };
    });

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: formattedMessages,
      ...(formattedTools.length > 0 ? { tools: formattedTools } : {}),
    });

    const choice = response.choices[0]?.message;
    if (!choice) {
      throw new Error("Model returned an empty response.");
    }

    const assistantMsg: AssistantMessage = { role: "assistant" };
    if (choice.content) {
      assistantMsg.content = choice.content;
    }

    if (choice.tool_calls && choice.tool_calls.length > 0) {
      assistantMsg.toolCalls = choice.tool_calls
        .filter((tc) => tc.type === "function")
        .map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments || "{}"),
          raw: tc,
        }));
    }

    return assistantMsg;
  }
}

/**
 * Creates the model client: defaults to Google Gemini via its OpenAI endpoint,
 * or connects to local models (LM Studio / Ollama).
 */
export function createModelFromEnvironment(
  env: Record<string, string | undefined> = process.env,
): OpenAiModel {
  const provider = (env.AI_PROVIDER || "google").toLowerCase();
  const modelName = env.AI_MODEL || env.GEMINI_MODEL;

  if (provider === "local" || provider === "lmstudio") {
    return new OpenAiModel(
      new OpenAI({
        baseURL: env.LMSTUDIO_BASE_URL || env.OPENAI_BASE_URL || "http://127.0.0.1:1234/v1",
        apiKey: env.LMSTUDIO_API_KEY || env.OPENAI_API_KEY || "lm-studio",
      }),
      modelName || "local-model",
    );
  }

  // Default: Google Gemini via official OpenAI-compatible endpoint
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required. Add it to your local .env file.");
  }

  return new OpenAiModel(
    new OpenAI({
      apiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    }),
    modelName || "gemini-2.5-flash",
  );
}
