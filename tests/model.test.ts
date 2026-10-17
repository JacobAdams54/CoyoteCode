import { describe, expect, it } from "vitest";
import { createModelFromEnvironment, toAiSdkMessages } from "../src/model.js";

describe("toAiSdkMessages", () => {
  it("converts user, assistant, and tool messages to AI SDK format", () => {
    const aiMessages = toAiSdkMessages([
      { role: "user", content: "List files" },
      {
        role: "assistant",
        toolCalls: [{ id: "call-1", name: "list_files", arguments: { path: "." } }],
      },
      {
        role: "tool",
        toolCallId: "call-1",
        toolName: "list_files",
        content: JSON.stringify(["index.ts"]),
      },
      { role: "assistant", content: "Done listing files." },
    ]);

    expect(aiMessages).toEqual([
      { role: "user", content: "List files" },
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "list_files",
            input: { path: "." },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call-1",
            toolName: "list_files",
            output: { type: "text", value: JSON.stringify(["index.ts"]) },
          },
        ],
      },
      { role: "assistant", content: "Done listing files." },
    ]);
  });
});

describe("createModelFromEnvironment", () => {
  it("requires GEMINI_API_KEY when provider is google", () => {
    expect(() =>
      createModelFromEnvironment({ AI_PROVIDER: "google", GEMINI_API_KEY: "" }),
    ).toThrow("GEMINI_API_KEY is required");
  });

  it("configures LM Studio / local without requiring a cloud key", () => {
    const model = createModelFromEnvironment({
      AI_PROVIDER: "lmstudio",
      AI_MODEL: "qwen2.5-coder",
    });
    expect(model).toBeDefined();
  });
});
