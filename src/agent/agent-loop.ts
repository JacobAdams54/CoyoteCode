import type { AgentEvent, ModelClient } from "../model/model-types.js";
import type { ToolRegistry } from "../tools/tool-registry.js";

const DEFAULT_MAX_MODEL_TURNS = 6;

/**
 * Dependencies and limits required to run one agent task.
 */
export interface RunAgentOptions {
  task: string;
  model: ModelClient;
  tools: ToolRegistry;

  /**
   * Maximum number of times the agent may call the model.
   *
   * This prevents repeated tool calls from creating an infinite loop or
   * consuming an uncontrolled amount of model quota.
   */
  maxModelTurns?: number;
}

/**
 * Information returned after the model produces its final response.
 */
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
   * The event log is the provider-neutral record of the complete run.
   * Gemini-specific interaction objects do not belong here.
   */
  const events: AgentEvent[] = [
    {
      type: "user",
      content: task,
    },
  ];

  let previousTurnId: string | undefined;

  for (let modelTurns = 1; modelTurns <= maxModelTurns; modelTurns += 1) {
    const turn = await options.model.respond({
      events: [...events],
      tools: options.tools.list(),

      /*
       * Gemini does not need a previous interaction ID on the initial turn.
       * Later turns use it to associate tool results with the interaction that
       * requested them.
       */
      ...(previousTurnId ? { previousTurnId } : {}),
    });

    /*
     * Save the model response before acting on it. This preserves the exact
     * order of decisions and observations for debugging and future UI traces.
     */
    events.push(turn.response);

    if (turn.response.type === "final") {
      return {
        finalResponse: turn.response.content,
        events,
        modelTurns,
      };
    }

    /*
     * The ToolRegistry performs the allowlist lookup and converts tool
     * exceptions into structured failure results.
     */
    const toolResult = await options.tools.execute(turn.response.call);

    events.push(toolResult);

    /*
     * The next Gemini request continues from the interaction that produced
     * this tool call.
     */
    previousTurnId = turn.id;
  }

  throw new Error(
    `Agent exceeded the maximum of ${maxModelTurns} model turns.`,
  );
}
