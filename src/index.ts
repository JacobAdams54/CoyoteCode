import "dotenv/config";

import { resolve } from "node:path";

import { runAgent } from "./agent/agent-loop.js";
import { GeminiModel } from "./model/gemini-model.js";
import type { AgentEvent } from "./model/model-types.js";
import { createListFilesTool } from "./tools/list-files.js";
import { ToolRegistry } from "./tools/tool-registry.js";

const DEFAULT_TASK = "What files and directories are in this project?";

/**
 * Prints the provider-neutral event history produced by the agent loop.
 *
 * The trace makes the model → tool → result → model cycle visible during the
 * demonstration.
 */
function printEvent(event: AgentEvent): void {
  switch (event.type) {
    case "user":
      console.log("\n[USER]");
      console.log(event.content);
      return;

    case "tool_call":
      console.log("\n[MODEL → TOOL]");
      console.log(`Tool: ${event.call.name}`);
      console.log(
        `Arguments: ${JSON.stringify(event.call.arguments, null, 2)}`,
      );
      return;

    case "tool_result":
      console.log("\n[TOOL → MODEL]");
      console.log(`Tool: ${event.toolName}`);

      if (event.success) {
        console.log("Status: success");
        console.log(JSON.stringify(event.output, null, 2));
      } else {
        console.log("Status: failure");
        console.log(event.error);
      }

      return;

    case "final":
      console.log("\n[FINAL RESPONSE]");
      console.log(event.content);
      return;
  }
}

/**
 * Creates and runs the complete Lab 1 agent.
 */
async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add it to your local .env file.",
    );
  }

  /*
   * Additional command-line arguments become the user's task.
   *
   * Example:
   * npm run dev -- "List the files in src."
   */
  const commandLineTask = process.argv.slice(2).join(" ").trim();
  const task = commandLineTask || DEFAULT_TASK;

  /*
   * Restrict filesystem tools to the controlled sample project.
   */
  const workspaceRoot = resolve(process.cwd(), "sample-project");

  /*
   * The model receives only the tool schema. It never receives the executable
   * function directly.
   */
  const tools = new ToolRegistry();

  /*
   * TODO 6:
   *
   * 1. Import createListFilesTool from "./tools/list-files.js".
   * 2. Create a list_files tool restricted to workspaceRoot.
   * 3. Register it with the ToolRegistry.
   */

  const configuredModel = process.env.GEMINI_MODEL?.trim();

  const model = new GeminiModel({
    apiKey,
    ...(configuredModel ? { model: configuredModel } : {}),
  });

  console.log("Coyote Code — Lab 1");
  console.log(`Workspace: ${workspaceRoot}`);
  console.log(
    `Tools: ${tools
      .list()
      .map((tool) => tool.name)
      .join(", ")}`,
  );

  const result = await runAgent({
    task,
    model,
    tools,
    maxModelTurns: 4,
  });

  for (const event of result.events) {
    printEvent(event);
  }

  console.log(`\nModel turns: ${result.modelTurns}`);
}

/*
 * Keep startup failures controlled. Setting exitCode allows Node to finish
 * normal cleanup while still reporting failure to the terminal.
 */
main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown application error";

  console.error("\nCoyote Code failed:");
  console.error(message);

  process.exitCode = 1;
});
