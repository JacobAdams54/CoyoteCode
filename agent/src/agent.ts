import type { ToolRegistry } from "./tools.js";
import type { Message, ModelClient } from "./types.js";

export interface RunAgentOptions {
  task: string;
  model: ModelClient;
  tools: ToolRegistry;
  maxTurns?: number;
}

export interface AgentRunResult {
  finalResponse: string;
  messages: readonly Message[];
  turns: number;
}

/**
 * Runs the Sense → Plan → Act loop until the model gives a final response.
 */
export async function runAgent(options: RunAgentOptions): Promise<AgentRunResult> {
  const task = options.task.trim();
  if (!task) {
    throw new Error("Task cannot be empty.");
  }

  const maxTurns = options.maxTurns ?? 6;
  const messages: Message[] = [{ role: "user", content: task }];

  for (let turns = 1; turns <= maxTurns; turns++) {
    // 1. Ask the model for the next decision
    const response = await options.model.respond(messages, options.tools.list());
    messages.push(response);

    // 2. If the model didn't call any tools, we are done!
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return {
        finalResponse: response.content ?? "",
        messages,
        turns,
      };
    }

    // 3. Execute each tool call and add the results to message history
    for (const toolCall of response.toolCalls) {
      const toolMessage = await options.tools.execute(toolCall);
      messages.push(toolMessage);
    }
  }

  throw new Error(`Agent exceeded maximum of ${maxTurns} turns.`);
}
