import type { AgentEvent, ModelClient } from "../model/model-types.js";
import type { ToolRegistry } from "../tools/tool-registry.js";

const DEFAULT_MAX_MODEL_TURNS = 6;

export interface RunAgentOptions {
  task: string;
  model: ModelClient;
  tools: ToolRegistry;
  maxModelTurns?: number;
}

export interface AgentRunResult {
  finalResponse: string;
  events: readonly AgentEvent[];
  modelTurns: number;
}

/**
 * Runs the model → tool → model cycle until the model returns a final answer.
 */
export async function runAgent(
  options: RunAgentOptions,
): Promise<AgentRunResult> {
  const task = options.task.trim();

  if (!task) {
    throw new Error("Agent task cannot be empty.");
  }

  const maxModelTurns = options.maxModelTurns ?? DEFAULT_MAX_MODEL_TURNS;

  if (!Number.isInteger(maxModelTurns) || maxModelTurns <= 0) {
    throw new Error("maxModelTurns must be a positive integer.");
  }

  /*
   * TODO 1:
   * Add the initial user event to the event history.
   */
  const events: AgentEvent[] = [];

  let previousTurnId: string | undefined;

  for (let modelTurns = 1; modelTurns <= maxModelTurns; modelTurns += 1) {
    const turn = await options.model.respond({
      /*
       * TODO 2:
       * Pass a snapshot instead of the mutable events array.
       */
      events,

      tools: options.tools.list(),

      ...(previousTurnId ? { previousTurnId } : {}),
    });

    /*
     * TODO 3:
     * Record the model's response in the event history.
     */

    if (turn.response.type === "final") {
      /*
       * TODO 4:
       * Return the final response, event history, and model-turn count.
       */
      throw new Error("TODO: return the completed agent result.");
    }

    /*
     * TODO 5:
     * Execute the requested tool through ToolRegistry.
     * Record the resulting observation in the event history.
     * Save turn.id so Gemini can continue the interaction.
     */
    throw new Error("TODO: execute the requested tool.");
  }

  throw new Error(
    `Agent exceeded the maximum of ${maxModelTurns} model turns.`,
  );
}
