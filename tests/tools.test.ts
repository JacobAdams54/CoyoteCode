import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  createFileMetadataTool,
  createFilesTool,
  createListFilesTool,
  createReadFileTool,
  ToolRegistry,
} from "../src/tools.js";

describe("ToolRegistry", () => {
  it("registers and lists tool summaries", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "echo",
      description: "Echo tool",
      parameters: { type: "object", properties: { text: { type: "string" } } },
      execute: async (args) => args.text,
    });

    expect(registry.list()).toEqual([
      {
        name: "echo",
        description: "Echo tool",
        parameters: { type: "object", properties: { text: { type: "string" } } },
      },
    ]);
  });

  it("executes a registered tool and returns a tool message", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "echo",
      description: "Echo tool",
      parameters: { type: "object", properties: {} },
      execute: async (args) => `Echo: ${args.msg}`,
    });

    const result = await registry.execute({
      id: "call-1",
      name: "echo",
      arguments: { msg: "hi" },
    });

    expect(result).toEqual({
      role: "tool",
      toolCallId: "call-1",
      toolName: "echo",
      content: JSON.stringify("Echo: hi"),
    });
  });

  it("returns an error message when tool is unregistered", async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute({
      id: "call-2",
      name: "missing_tool",
      arguments: {},
    });

    expect(result).toEqual({
      role: "tool",
      toolCallId: "call-2",
      toolName: "missing_tool",
      content: JSON.stringify({ error: "Unknown tool: missing_tool" }),
    });
  });
});

describe("list_files tool", () => {
  const workspaceRoot = resolve(process.cwd(), "sample-project");

  it("lists entries inside the workspace", async () => {
    const tool = createListFilesTool(workspaceRoot);
    const entries = (await tool.execute({ path: "." })) as Array<{ name: string; type: string }>;

    expect(entries.some((e) => e.name === "package.json")).toBe(true);
    expect(entries.some((e) => e.name === "src" && e.type === "directory")).toBe(true);
  });

  it("blocks path traversal outside the workspace", async () => {
    const tool = createListFilesTool(workspaceRoot);
    await expect(tool.execute({ path: "../.." })).rejects.toThrow("outside the workspace");
  });
});

describe("create_files tool", () => {
  it("creates a file in the requested workspace directory", async () => {
    const workspaceRoot = await mkdtemp(resolve(tmpdir(), "coyote-code-"));

    try {
      const tool = createFilesTool(workspaceRoot);
      const result = await tool.execute({
        path: ".",
        filename: "notes.txt",
        content: "hello",
      });

      expect(result).toEqual({ path: "notes.txt", created: true });
      await expect(readFile(resolve(workspaceRoot, "notes.txt"), "utf8")).resolves.toBe("hello");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("blocks creating a file outside the workspace", async () => {
    const workspaceRoot = await mkdtemp(resolve(tmpdir(), "coyote-code-"));

    try {
      const tool = createFilesTool(workspaceRoot);
      await expect(
        tool.execute({
          path: ".",
          filename: "../outside.txt",
          content: "not allowed",
        }),
      ).rejects.toThrow("outside the workspace");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});

describe("read_files tool", () => {
  it("reads a file inside the workspace", async () => {
    const workspaceRoot = await mkdtemp(resolve(tmpdir(), "coyote-code-"));

    try {
      const createTool = createFilesTool(workspaceRoot);
      await createTool.execute({
        path: ".",
        filename: "notes.txt",
        content: "hello",
      });

      const readTool = createReadFileTool(workspaceRoot);
      await expect(readTool.execute({ path: "notes.txt" })).resolves.toEqual({
        path: "notes.txt",
        content: "hello",
      });
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("blocks reading outside the workspace", async () => {
    const workspaceRoot = await mkdtemp(resolve(tmpdir(), "coyote-code-"));

    try {
      const tool = createReadFileTool(workspaceRoot);

      await expect(
        tool.execute({ path: "../../etc/passwd" }),
      ).rejects.toThrow("outside the workspace");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("rejects directories", async () => {
    const workspaceRoot = resolve(process.cwd(), "sample-project");
    const tool = createReadFileTool(workspaceRoot);

    await expect(tool.execute({ path: "src" })).rejects.toThrow(
      "is not a file",
    );
  });
});

describe("get_file_metadata tool", () => {
  it("returns file metadata without reading the file", async () => {
    const workspaceRoot = await mkdtemp(resolve(tmpdir(), "coyote-code-"));

    try {
      const createTool = createFilesTool(workspaceRoot);
      await createTool.execute({
        path: ".",
        filename: "notes.txt",
        content: "hello",
      });

      const tool = createFileMetadataTool(workspaceRoot);
      const result = await tool.execute({ path: "notes.txt" });

      expect(result).toMatchObject({
        path: "notes.txt",
        type: "file",
        size: 5,
      });
      expect(result).toHaveProperty("modifiedAt");
      expect(typeof (result as { modifiedAt: unknown }).modifiedAt).toBe("string");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("returns directory metadata", async () => {
    const workspaceRoot = resolve(process.cwd(), "sample-project");
    const tool = createFileMetadataTool(workspaceRoot);

    await expect(tool.execute({ path: "src" })).resolves.toMatchObject({
      path: "src",
      type: "directory",
    });
  });

  it("blocks metadata requests outside the workspace", async () => {
    const workspaceRoot = await mkdtemp(resolve(tmpdir(), "coyote-code-"));

    try {
      const tool = createFileMetadataTool(workspaceRoot);
      await expect(tool.execute({ path: "../outside.txt" })).rejects.toThrow(
        "outside the workspace",
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
