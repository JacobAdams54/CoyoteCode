import { readdir, realpath, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { ToolDefinition } from "./tool-types.js";

interface ListFilesInput {
  path: string;
}

interface ListFilesEntry {
  name: string;
  type: "file" | "directory" | "symbolic_link" | "other";
}

interface ListFilesOutput {
  path: string;
  entries: ListFilesEntry[];
}

/**
 * Returns true when targetPath is either the workspace root itself or a path
 * contained inside it.
 *
 * Using path.relative() avoids unsafe string-prefix checks. For example,
 * "/workspace-other" must not count as being inside "/workspace".
 */
function isPathInside(rootPath: string, targetPath: string): boolean {
  const relativePath = relative(rootPath, targetPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${sep}`) &&
      relativePath !== ".." &&
      !isAbsolute(relativePath))
  );
}

/**
 * Validates model-generated input before any filesystem operation occurs.
 */
function parseListFilesInput(input: unknown): ListFilesInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("list_files input must be an object.");
  }

  const values = input as Record<string, unknown>;
  const keys = Object.keys(values);

  /*
   * The schema says additional properties are not allowed. Runtime validation
   * must enforce the same rule because model output is untrusted.
   */
  const unexpectedKey = keys.find((key) => key !== "path");

  if (unexpectedKey) {
    throw new Error(
      `list_files received an unexpected property: ${unexpectedKey}`,
    );
  }

  if (typeof values.path !== "string") {
    throw new Error("list_files path must be a string.");
  }

  const requestedPath = values.path.trim();

  if (!requestedPath) {
    throw new Error("list_files path cannot be empty.");
  }

  if (isAbsolute(requestedPath)) {
    throw new Error("list_files does not allow absolute paths.");
  }

  return {
    path: requestedPath,
  };
}

/**
 * Converts a filesystem directory entry into a stable provider-neutral value.
 */
function getEntryType(entry: Dirent<string>): ListFilesEntry["type"] {
  if (entry.isFile()) {
    return "file";
  }

  if (entry.isDirectory()) {
    return "directory";
  }

  if (entry.isSymbolicLink()) {
    return "symbolic_link";
  }

  return "other";
}

/**
 * Creates a read-only tool restricted to one workspace directory.
 *
 * The workspace root is supplied by trusted application code. The model only
 * controls the relative path passed to execute().
 */
export function createListFilesTool(workspaceRoot: string): ToolDefinition {
  return {
    name: "list_files",

    description:
      "Lists files and directories immediately inside a relative workspace path.",

    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            'Relative directory path inside the workspace, such as "." or "src".',
        },
      },
      required: ["path"],
      additionalProperties: false,
    },

    async execute(input: unknown): Promise<ListFilesOutput> {
      const { path: requestedPath } = parseListFilesInput(input);

      /*
       * realpath() resolves the configured root before it is used as the
       * security boundary. This produces a canonical absolute path.
       */
      const canonicalRoot = await realpath(resolve(workspaceRoot));

      /*
       * Reject obvious lexical traversal before touching the requested target.
       *
       * resolve("/workspace", "../secret") becomes "/secret", which is outside
       * the permitted root.
       */
      const candidatePath = resolve(canonicalRoot, requestedPath);

      if (!isPathInside(canonicalRoot, candidatePath)) {
        throw new Error(
          "list_files cannot access paths outside the workspace.",
        );
      }

      /*
       * Lexical containment is insufficient because a path inside the
       * workspace could be a symbolic link pointing outside it.
       */
      let canonicalTarget: string;

      try {
        canonicalTarget = await realpath(candidatePath);
      } catch (error: unknown) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          throw new Error(`list_files path does not exist: ${requestedPath}`);
        }

        throw error;
      }

      if (!isPathInside(canonicalRoot, canonicalTarget)) {
        throw new Error(
          "list_files cannot follow symbolic links outside the workspace.",
        );
      }

      const targetStats = await stat(canonicalTarget);

      if (!targetStats.isDirectory()) {
        throw new Error(`list_files path is not a directory: ${requestedPath}`);
      }

      const directoryEntries = await readdir(canonicalTarget, {
        withFileTypes: true,
      });

      const entries: ListFilesEntry[] = directoryEntries
        .map((entry) => ({
          name: entry.name,
          type: getEntryType(entry),
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

      /*
       * Return a relative path instead of exposing the machine's absolute
       * filesystem location to the model or UI.
       */
      const outputPath = relative(canonicalRoot, canonicalTarget) || ".";

      return {
        path: outputPath,
        entries,
      };
    },
  };
}
