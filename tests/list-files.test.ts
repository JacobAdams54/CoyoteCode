import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createListFilesTool } from "../src/tools/list-files.js";

describe("list_files", () => {
  let temporaryRoot: string;
  let workspaceRoot: string;
  let outsideRoot: string;

  beforeEach(async () => {
    /*
     * Every test receives an isolated filesystem so it does not depend on the
     * developer's repository contents or leave files behind.
     */
    temporaryRoot = await mkdtemp(join(tmpdir(), "coyote-code-list-files-"));

    workspaceRoot = join(temporaryRoot, "workspace");
    outsideRoot = join(temporaryRoot, "outside");

    await mkdir(join(workspaceRoot, "src"), {
      recursive: true,
    });

    await mkdir(outsideRoot, {
      recursive: true,
    });

    await writeFile(join(workspaceRoot, "README.md"), "# Test workspace\n");

    await writeFile(
      join(workspaceRoot, "src", "index.ts"),
      'console.log("hello");\n',
    );

    await writeFile(
      join(outsideRoot, "secret.txt"),
      "This file must not be accessible.\n",
    );
  });

  afterEach(async () => {
    /*
     * force allows cleanup to succeed even if a test failed before completing
     * its filesystem setup.
     */
    await rm(temporaryRoot, {
      recursive: true,
      force: true,
    });
  });

  it("lists files and directories in the workspace root", async () => {
    const tool = createListFilesTool(workspaceRoot);

    const result = await tool.execute({
      path: ".",
    });

    expect(result).toEqual({
      path: ".",
      entries: [
        {
          name: "README.md",
          type: "file",
        },
        {
          name: "src",
          type: "directory",
        },
      ],
    });
  });

  it("lists files inside a nested workspace directory", async () => {
    const tool = createListFilesTool(workspaceRoot);

    const result = await tool.execute({
      path: "src",
    });

    expect(result).toEqual({
      path: "src",
      entries: [
        {
          name: "index.ts",
          type: "file",
        },
      ],
    });
  });

  it("rejects path traversal outside the workspace", async () => {
    const tool = createListFilesTool(workspaceRoot);

    await expect(
      tool.execute({
        path: "../outside",
      }),
    ).rejects.toThrow("list_files cannot access paths outside the workspace.");
  });

  it("rejects absolute paths", async () => {
    const tool = createListFilesTool(workspaceRoot);

    await expect(
      tool.execute({
        path: outsideRoot,
      }),
    ).rejects.toThrow("list_files does not allow absolute paths.");
  });

  it("rejects symbolic links that escape the workspace", async () => {
    /*
     * The link itself is inside the workspace, but its real target is outside.
     * A lexical path check alone would fail to block this.
     */
    await symlink(outsideRoot, join(workspaceRoot, "escape"), "dir");

    const tool = createListFilesTool(workspaceRoot);

    await expect(
      tool.execute({
        path: "escape",
      }),
    ).rejects.toThrow(
      "list_files cannot follow symbolic links outside the workspace.",
    );
  });

  it("rejects a path that refers to a file", async () => {
    const tool = createListFilesTool(workspaceRoot);

    await expect(
      tool.execute({
        path: "README.md",
      }),
    ).rejects.toThrow("list_files path is not a directory: README.md");
  });

  it("rejects a path that does not exist", async () => {
    const tool = createListFilesTool(workspaceRoot);

    await expect(
      tool.execute({
        path: "missing",
      }),
    ).rejects.toThrow("list_files path does not exist: missing");
  });

  it.each([
    {
      name: "null",
      input: null,
      expectedError: "list_files input must be an object.",
    },
    {
      name: "an array",
      input: [],
      expectedError: "list_files input must be an object.",
    },
    {
      name: "a missing path",
      input: {},
      expectedError: "list_files path must be a string.",
    },
    {
      name: "a non-string path",
      input: {
        path: 42,
      },
      expectedError: "list_files path must be a string.",
    },
    {
      name: "an empty path",
      input: {
        path: "   ",
      },
      expectedError: "list_files path cannot be empty.",
    },
    {
      name: "an unexpected property",
      input: {
        path: ".",
        recursive: true,
      },
      expectedError: "list_files received an unexpected property: recursive",
    },
  ])(
    "rejects invalid input containing $name",
    async ({ input, expectedError }) => {
      const tool = createListFilesTool(workspaceRoot);

      await expect(tool.execute(input)).rejects.toThrow(expectedError);
    },
  );
});
