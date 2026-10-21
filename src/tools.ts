import { readdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
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
    return Array.from(this.tools.values()).map(({ name, description, parameters }) => ({
      name,
      description,
      parameters,
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
  const root = resolve(workspaceRoot);
  const resolved = resolve(root, userPath);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) {
    throw new Error(`Access denied: "${userPath}" is outside the workspace.`);
  }
  return resolved;
}

export function createListFilesTool(workspaceRoot: string): ToolDefinition {
  return {
    name: "list_files",
    description: "Lists files and directories inside a relative workspace path.",
    parameters: {
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

export function createFilesTool(workspaceRoot: string): ToolDefinition {
  return {
    name: "create_files",
    description: "Creates a file inside a relative workspace directory.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: 'Relative path in the workspace (default: ".")',
        },
        filename: {
          type: "string",
          description: "Name of the file to create.",
        },
        content: {
          type: "string",
          description: "Contents to write to the file.",
        },
      },
      required: ["filename", "content"],
    },
    async execute(args: Record<string, unknown>) {
      const requestedPath = typeof args?.path === "string" ? args.path : ".";
      const targetDir = safePath(workspaceRoot, requestedPath);
      const filename = typeof args?.filename === "string" ? args.filename : "";
      if (!filename) {
        throw new Error("A filename is required.");
      }
      if (typeof args?.content !== "string") {
        throw new Error("File content must be a string.");
      }

      const filePath = safePath(targetDir, filename);
      await writeFile(filePath, args.content, "utf8");

      return {
        path: relative(resolve(workspaceRoot), filePath),
        created: true,
      };
    },
  };
}
