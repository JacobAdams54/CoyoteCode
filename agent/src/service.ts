import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import dotenv from "dotenv";

import { runAgent } from "./agent.js";
import { createModelFromEnvironment } from "./model.js";
import {
  createEditFileTool,
  createFilesTool,
  createFileMetadataTool,
  createListFilesTool,
  createReadFileTool,
  searchPhraseTool,
  ToolRegistry,
} from "./tools.js";

// Resolve paths relative to this file rather than the shell's
// current working directory.
const agentDirectory = fileURLToPath(new URL("../", import.meta.url));

const defaultWorkspaceRoot = resolve(agentDirectory, "sample-project");

// Load the agent's local environment configuration.
dotenv.config({
  path: resolve(agentDirectory, ".env"),
});

export async function runAgentTask(task: string): Promise<string> {
  const tools = new ToolRegistry();

  tools.register(createListFilesTool(defaultWorkspaceRoot));
  tools.register(createFilesTool(defaultWorkspaceRoot));
  tools.register(createReadFileTool(defaultWorkspaceRoot));
  tools.register(createFileMetadataTool(defaultWorkspaceRoot));
  tools.register(createEditFileTool(defaultWorkspaceRoot));
  tools.register(searchPhraseTool(defaultWorkspaceRoot));

  const model = createModelFromEnvironment();

  const result = await runAgent({
    task,
    model,
    tools,
    maxTurns: 15,
  });

  return result.finalResponse;
}
