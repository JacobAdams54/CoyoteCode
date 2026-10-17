import { describe, expect, it } from "vitest";
import OpenAI from "openai";
import { createModelFromEnvironment, OpenAiModel } from "../src/model.js";

describe("OpenAiModel", () => {
  it("formats messages and unpacks model assistant text", async () => {
    const mockOpenAi = {
      chat: {
        completions: {
          create: async (params: any) => ({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "I found 3 files.",
                },
              },
            ],
          }),
        },
      },
    } as unknown as OpenAI;

    const model = new OpenAiModel(mockOpenAi, "test-model");
    const response = await model.respond(
      [{ role: "user", content: "List the files" }],
      [],
    );

    expect(response).toEqual({
      role: "assistant",
      content: "I found 3 files.",
    });
  });

  it("unpacks tool calls from the model response", async () => {
    const mockOpenAi = {
      chat: {
        completions: {
          create: async (params: any) => ({
            choices: [
              {
                message: {
                  role: "assistant",
                  tool_calls: [
                    {
                      id: "call-99",
                      type: "function",
                      function: {
                        name: "list_files",
                        arguments: JSON.stringify({ path: "src" }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        },
      },
    } as unknown as OpenAI;

    const model = new OpenAiModel(mockOpenAi, "test-model");
    const response = await model.respond(
      [{ role: "user", content: "Inspect src" }],
      [
        {
          name: "list_files",
          description: "List directory",
          parameters: { type: "object", properties: {} },
        },
      ],
    );

    expect(response).toEqual({
      role: "assistant",
      toolCalls: [
        {
          id: "call-99",
          name: "list_files",
          arguments: { path: "src" },
          raw: {
            id: "call-99",
            type: "function",
            function: {
              name: "list_files",
              arguments: JSON.stringify({ path: "src" }),
            },
          },
        },
      ],
    });
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
