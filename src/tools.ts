import { readdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { readFile, stat } from "node:fs/promises";
import type {
  Message,
  ToolCall,
  ToolDefinition,
  ToolSummary,
} from "./types.js";

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  list(): ToolSummary[] {
    return Array.from(this.tools.values()).map(
      ({ name, description, parameters }) => ({
        name,
        description,
        parameters,
      }),
    );
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
    description:
      "Lists files and directories inside a relative workspace path.",
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

export function createReadFileTool(workspaceRoot: string): ToolDefinition {
  return {
    name: "read_files",
    description: "Reads the contents of a file inside the workspace",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to a file in the workspace",
        },
      },
      required: ["path"],
    },
    async execute(args: Record<string, unknown>) {
      if (typeof args.path !== "string" || args.path.length === 0) {
        throw new Error("A file path is required.");
      }

      const filePath = safePath(workspaceRoot, args.path);
      const fileStats = await stat(filePath);

      if (!fileStats.isFile()) {
        throw new Error(`"${args.path}" is not a file.`);
      }

      const content = await readFile(filePath, "utf8");

      return {
        path: relative(resolve(workspaceRoot), filePath),
        content,
      };
    },
  };
}

export function createFileMetadataTool(workspaceRoot: string): ToolDefinition {
  return {
    name: "get_file_metadata",
    description:
      "Returns metadata for a file or directory inside the workspace without reading its contents.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to a file or directory in the workspace",
        },
      },
      required: ["path"],
    },
    async execute(args: Record<string, unknown>) {
      if (typeof args.path !== "string" || args.path.length === 0) {
        throw new Error("A file path is required.");
      }

      const filePath = safePath(workspaceRoot, args.path);
      const fileStats = await stat(filePath);

      return {
        path: relative(resolve(workspaceRoot), filePath),
        type: fileStats.isDirectory() ? "directory" : "file",
        size: fileStats.size,
        modifiedAt: fileStats.mtime.toISOString(),
      };
    },
  };
}

export function createEditFileTool(workspaceRoot: string): ToolDefinition {
  return {
    name: "edit_file",
    description:
      "Replaces one exact occurrence of oldText with newText in a workspace file.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to a file in the workspace",
        },
        oldText: {
          type: "string",
          description: "Exact text to replace. Must appear only once.",
        },
        newText: {
          type: "string",
          description: "Text to insert in place of oldText.",
        },
      },
      required: ["path", "oldText", "newText"],
    },
    async execute(args: Record<string, unknown>) {
      if (typeof args.path !== "string" || args.path.length === 0) {
        throw new Error("A file path is required.");
      }
      if (typeof args.oldText !== "string" || args.oldText.length === 0) {
        throw new Error("oldText must be a non empty string.");
      }
      if (typeof args.newText !== "string") {
        throw new Error("newText must be a string.");
      }

      const filePath = safePath(workspaceRoot, args.path);
      const content = await readFile(filePath, "utf8");

      // Splitting on oldText gives one more piece than the number of matches 
      const parts = content.split(args.oldText);
      if (parts.length === 1) {
        throw new Error(`oldText was not found in "${args.path}".`);
      }
      if (parts.length > 2) {
        throw new Error(
          `oldText appears ${parts.length - 1} times in "${args.path}". Include more surrounding text so it matches exactly once.`,
        );
      }

      await writeFile(filePath, parts.join(args.newText), "utf8");

      return {
        path: relative(resolve(workspaceRoot), filePath),
        edited: true,
      };
    },
  };
}
