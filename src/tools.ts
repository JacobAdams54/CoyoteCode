import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Message, ToolCall, ToolDefinition, ToolSummary } from "./types.js";

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  list(): ToolSummary[] {
    return Array.from(this.tools.values()).map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    }));
  }

  async execute(call: ToolCall): Promise<Message> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return {
        role: "tool",
        toolCallId: call.id,
        toolName: call.name,
        content: JSON.stringify({ error: `Unknown tool: ${call.name}` }),
      };
    }

    try {
      const output = await tool.execute(call.arguments);
      return {
        role: "tool",
        toolCallId: call.id,
        toolName: call.name,
        content: JSON.stringify(output),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Tool error";
      return {
        role: "tool",
        toolCallId: call.id,
        toolName: call.name,
        content: JSON.stringify({ error: message }),
      };
    }
  }
}

/**
 * Ensures a path stays inside the workspace directory.
 */
function safePath(workspaceRoot: string, userPath: string = "."): string {
  const resolved = resolve(workspaceRoot, userPath);
  if (!resolved.startsWith(resolve(workspaceRoot))) {
    throw new Error(`Access denied: "${userPath}" is outside the workspace.`);
  }
  return resolved;
}

export function createListFilesTool(workspaceRoot: string): ToolDefinition {
  return {
    name: "list_files",
    description: "Lists files and directories inside a relative workspace path.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: 'Relative path in the workspace (default: ".")',
        },
      },
    },
    async execute(args: Record<string, unknown>) {
      const requestedPath = typeof args?.path === "string" ? args.path : ".";
      const targetDir = safePath(workspaceRoot, requestedPath);

      const dirents = await readdir(targetDir, { withFileTypes: true });
      return dirents.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
      }));
    },
  };
}
