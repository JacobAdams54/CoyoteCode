import { GoogleGenAI } from "@google/genai";

import type {
  AgentEvent,
  ModelClient,
  ModelRequest,
  ModelTurn,
} from "./model-types.js";
import type { ToolSummary } from "../tools/tool-types.js";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/**
 * Configuration required to create a Gemini-backed model client.
 */
export interface GeminiModelOptions {
  apiKey: string;
  model?: string;
}

/**
 * Shape Gemini expects when receiving the result of a function call.
 */
interface GeminiFunctionResultInput {
  type: "function_result";
  name: string;
  call_id: string;
  result: Array<{
    type: "text";
    text: string;
  }>;
}

/**
 * Minimal response shape needed from Gemini.
 *
 * Keeping this type small prevents Gemini-specific types from spreading
 * throughout the rest of the application.
 */
interface GeminiInteraction {
  id?: string;
  output_text?: string;
  steps?: ReadonlyArray<{
    type?: string;
    id?: string;
    name?: string;
    arguments?: unknown;
  }>;
}

/**
 * Converts Coyote Code tool descriptions into Gemini function declarations.
 *
 * Only names, descriptions, and schemas are sent. Executable functions remain
 * inside the application's ToolRegistry.
 */
function createGeminiTools(tools: readonly ToolSummary[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  }));
}

/**
 * Converts the newest agent event into the next Gemini input.
 *
 * On the first turn, Gemini receives the user's task. After a tool executes,
 * Gemini receives the structured result associated with the original call ID.
 */
function createGeminiInput(
  events: readonly AgentEvent[],
): string | GeminiFunctionResultInput[] {
  const latestEvent = events.at(-1);

  if (!latestEvent) {
    throw new Error("Cannot call Gemini without an agent event.");
  }

  if (latestEvent.type === "user") {
    return latestEvent.content;
  }

  if (latestEvent.type === "tool_result") {
    const resultBody = latestEvent.success
      ? {
          success: true,
          output: latestEvent.output,
        }
      : {
          success: false,
          error: latestEvent.error,
        };

    return [
      {
        type: "function_result",
        name: latestEvent.toolName,
        call_id: latestEvent.toolCallId,
        result: [
          {
            type: "text",
            text: JSON.stringify(resultBody),
          },
        ],
      },
    ];
  }

  throw new Error(
    `Cannot call Gemini after an event of type "${latestEvent.type}".`,
  );
}

/**
 * Converts a Gemini interaction into Coyote Code's provider-neutral format.
 *
 * Exporting this function allows it to be unit-tested without making a real
 * API request.
 */
export function translateGeminiInteraction(
  interaction: GeminiInteraction,
): ModelTurn {
  if (!interaction.id) {
    throw new Error("Gemini returned an interaction without an ID.");
  }

  const functionCalls =
    interaction.steps?.filter((step) => step.type === "function_call") ?? [];

  /*
   * Lab 1 handles one tool call at a time. Silently ignoring additional calls
   * would produce an incomplete or incorrect agent run.
   */
  if (functionCalls.length > 1) {
    throw new Error(
      "Gemini returned multiple tool calls, but Lab 1 supports only one.",
    );
  }

  const functionCall = functionCalls[0];

  if (functionCall) {
    if (!functionCall.id || !functionCall.name) {
      throw new Error("Gemini returned an incomplete tool call.");
    }

    return {
      id: interaction.id,
      response: {
        type: "tool_call",
        call: {
          id: functionCall.id,
          name: functionCall.name,
          arguments: functionCall.arguments ?? {},
        },
      },
    };
  }

  const finalContent = interaction.output_text?.trim();

  if (!finalContent) {
    throw new Error(
      "Gemini returned neither a tool call nor a final response.",
    );
  }

  return {
    id: interaction.id,
    response: {
      type: "final",
      content: finalContent,
    },
  };
}

/**
 * Gemini implementation of Coyote Code's provider-neutral ModelClient.
 */
export class GeminiModel implements ModelClient {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(options: GeminiModelOptions) {
    const apiKey = options.apiKey.trim();

    if (!apiKey) {
      throw new Error("A Gemini API key is required.");
    }

    this.client = new GoogleGenAI({ apiKey });
    this.model = options.model?.trim() || DEFAULT_MODEL;
  }

  async respond(request: ModelRequest): Promise<ModelTurn> {
    const input = createGeminiInput(request.events);
    const tools = createGeminiTools(request.tools);

    const interaction = await this.client.interactions.create({
      model: this.model,
      input,
      tools,

      /*
       * Omit this property on the first turn. Later turns use it to associate
       * tool results with the interaction that requested them.
       */
      ...(request.previousTurnId
        ? { previous_interaction_id: request.previousTurnId }
        : {}),
    });

    return translateGeminiInteraction(interaction as GeminiInteraction);
  }
}
