import { describe, expect, it } from "vitest";

import { translateGeminiInteraction } from "../src/model/gemini-model.js";

describe("translateGeminiInteraction", () => {
  it("translates Gemini text output into a final model response", () => {
    /*
     * This object represents the small portion of a Gemini response that
     * Coyote Code uses. No real API request is made.
     */
    const result = translateGeminiInteraction({
      id: "interaction-1",
      output_text: "  The repository contains five files.  ",
      steps: [],
    });

    /*
     * Gemini-specific field names should not escape the adapter. The rest of
     * Coyote Code receives the provider-neutral ModelTurn format.
     */
    expect(result).toEqual({
      id: "interaction-1",
      response: {
        type: "final",
        content: "The repository contains five files.",
      },
    });
  });

  it("translates a Gemini function call into a Coyote Code tool call", () => {
    const result = translateGeminiInteraction({
      id: "interaction-2",
      steps: [
        {
          type: "function_call",
          id: "call-1",
          name: "list_files",
          arguments: {
            path: ".",
          },
        },
      ],
    });

    expect(result).toEqual({
      id: "interaction-2",
      response: {
        type: "tool_call",
        call: {
          id: "call-1",
          name: "list_files",
          arguments: {
            path: ".",
          },
        },
      },
    });
  });

  it("uses an empty object when Gemini omits tool arguments", () => {
    const result = translateGeminiInteraction({
      id: "interaction-3",
      steps: [
        {
          type: "function_call",
          id: "call-2",
          name: "list_files",
        },
      ],
    });

    expect(result).toEqual({
      id: "interaction-3",
      response: {
        type: "tool_call",
        call: {
          id: "call-2",
          name: "list_files",
          arguments: {},
        },
      },
    });
  });

  it("rejects an interaction without an ID", () => {
    expect(() =>
      translateGeminiInteraction({
        output_text: "Finished",
      }),
    ).toThrow("Gemini returned an interaction without an ID.");
  });

  it("rejects an incomplete function call", () => {
    expect(() =>
      translateGeminiInteraction({
        id: "interaction-4",
        steps: [
          {
            type: "function_call",
            id: "call-3",
            // Missing tool name.
          },
        ],
      }),
    ).toThrow("Gemini returned an incomplete tool call.");
  });

  it("rejects multiple function calls during Lab 1", () => {
    expect(() =>
      translateGeminiInteraction({
        id: "interaction-5",
        steps: [
          {
            type: "function_call",
            id: "call-4",
            name: "list_files",
            arguments: {
              path: ".",
            },
          },
          {
            type: "function_call",
            id: "call-5",
            name: "list_files",
            arguments: {
              path: "src",
            },
          },
        ],
      }),
    ).toThrow(
      "Gemini returned multiple tool calls, but Lab 1 supports only one.",
    );
  });

  it("rejects an interaction with no usable output", () => {
    expect(() =>
      translateGeminiInteraction({
        id: "interaction-6",
        output_text: "   ",
        steps: [],
      }),
    ).toThrow("Gemini returned neither a tool call nor a final response.");
  });
});
