import { describe, expect, it } from "vitest";

import {
  createAiSdkMessages,
  translateAiSdkGeneration,
} from "../src/model/ai-sdk-model.js";

describe("createAiSdkMessages", () => {
  it("preserves tool calls and results as AI SDK messages", () => {
    expect(
      createAiSdkMessages([
        { type: "user", content: "List files." },
        {
          type: "tool_call",
          call: {
            id: "call-1",
            name: "list_files",
            arguments: { path: "." },
            providerMetadata: { google: { thoughtSignature: "sig-1" } },
          },
        },
        {
          type: "tool_result",
          toolCallId: "call-1",
          toolName: "list_files",
          success: true,
          output: ["README.md"],
        },
      ]),
    ).toEqual([
      { role: "user", content: "List files." },
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "list_files",
            input: { path: "." },
            providerOptions: { google: { thoughtSignature: "sig-1" } },
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
            output: {
              type: "text",
              value: JSON.stringify({
                success: true,
                output: ["README.md"],
              }),
            },
          },
        ],
      },
    ]);
  });
});

describe("translateAiSdkGeneration", () => {
  it("translates a final response", () => {
    expect(
      translateAiSdkGeneration({
        text: "  Done.  ",
        toolCalls: [],
      }),
    ).toEqual({
      response: { type: "final", content: "Done." },
    });
  });

  it("translates one tool call", () => {
    expect(
      translateAiSdkGeneration({
        text: "",
        toolCalls: [
          {
            toolCallId: "call-1",
            toolName: "list_files",
            input: { path: "." },
            providerMetadata: { google: { thoughtSignature: "sig-1" } },
          },
        ],
      }),
    ).toEqual({
      response: {
        type: "tool_call",
        call: {
          id: "call-1",
          name: "list_files",
          arguments: { path: "." },
          providerMetadata: { google: { thoughtSignature: "sig-1" } },
        },
      },
    });
  });

  it("rejects multiple tool calls", () => {
    expect(() =>
      translateAiSdkGeneration({
        text: "",
        toolCalls: [
          { toolCallId: "call-1", toolName: "one", input: {} },
          { toolCallId: "call-2", toolName: "two", input: {} },
        ],
      }),
    ).toThrow("AI SDK returned multiple tool calls");
  });

  it("rejects an empty generation", () => {
    expect(() =>
      translateAiSdkGeneration({
        text: " ",
        toolCalls: [],
        finishReason: "length",
      }),
    ).toThrow(
      "AI SDK returned neither a tool call nor a final response. Finish reason: length",
    );
  });
});
