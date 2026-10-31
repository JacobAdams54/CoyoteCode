import "dotenv/config";
import { resolve } from "node:path";

import { runAgent } from "./agent.js";
import { createModelFromEnvironment } from "./model.js";
import {
  createEditFileTool,
  createFilesTool,
  createListFilesTool,
  ToolRegistry,
  createReadFileTool,
} from "./tools.js";
import type { Message } from "./types.js";

const DEFAULT_TASK = "Summarize the readme file";

function printMessage(msg: Message): void {
  switch (msg.role) {
    case "user":
      console.log(`\n[USER]\n${msg.content}`);
      break;

    case "assistant":
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const call of msg.toolCalls) {
          console.log(
            `\n[ASSISTANT → TOOL]\nTool: ${call.name}\nArguments: ${JSON.stringify(call.arguments, null, 2)}`,
          );
        }
      }
      if (msg.content) {
        console.log(`\n[ASSISTANT]\n${msg.content}`);
      }
      break;

    case "tool":
      console.log(
        `\n[TOOL → ASSISTANT]\nTool: ${msg.toolName}\nResult: ${msg.content}`,
      );
      break;
  }
}

async function main(): Promise<void> {
  const task = process.argv.slice(2).join(" ").trim() || DEFAULT_TASK;
  const workspaceRoot = resolve(process.cwd(), "sample-project");

  const tools = new ToolRegistry();
  tools.register(createListFilesTool(workspaceRoot));
  tools.register(createFilesTool(workspaceRoot));
  tools.register(createReadFileTool(workspaceRoot));
  tools.register(createEditFileTool(workspaceRoot));

  const model = createModelFromEnvironment();

  console.log("Coyote Code");
  console.log(`Workspace: ${workspaceRoot}`);
  console.log(
    `Tools: ${tools
      .list()
      .map((t) => t.name)
      .join(", ")}`,
  );

  const result = await runAgent({ task, model, tools, maxTurns: 4 });

  for (const msg of result.messages) {
    printMessage(msg);
  }

  console.log(`\nTurns taken: ${result.turns}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`\nCoyote Code failed: ${message}`);
  process.exitCode = 1;
});
