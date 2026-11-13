import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(sourceDirectory, "..");
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(packageDirectory, ".env") });
config({ path: resolve(packageDirectory, "../.env") });

import { runAgent } from "./agent.js";
import { createModelFromEnvironment } from "./model.js";
import {
  createEditFileTool,
  createFilesTool,
  createFileMetadataTool,
  createDirectoryTool,
  createListFilesTool,
  ToolRegistry,
  createReadFileTool,
  searchPhraseTool,
} from "./tools.js";
import type { Message } from "./types.js";

const DEFAULT_TASK =
  "Create a new documentation folder, and add a simple project tree diagram to it.";

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
  tools.register(createDirectoryTool(workspaceRoot));
  tools.register(createReadFileTool(workspaceRoot));
  tools.register(createFileMetadataTool(workspaceRoot));
  tools.register(createEditFileTool(workspaceRoot));
  tools.register(searchPhraseTool(workspaceRoot));

  const model = createModelFromEnvironment();

  console.log("Coyote Code");
  console.log(`Workspace: ${workspaceRoot}`);
  console.log(
    `Tools: ${tools
      .list()
      .map((t) => t.name)
      .join(", ")}`,
  );

  const result = await runAgent({ task, model, tools, maxTurns: 12 });

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
