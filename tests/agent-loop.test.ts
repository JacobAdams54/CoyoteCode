import { describe, expect, it } from "vitest";

import { runAgent } from "../src/agent/agent-loop.js";
import type {
  ModelClient,
  ModelRequest,
  ModelTurn,
} from "../src/model/model-types.js";
import { ToolRegistry } from "../src/tools/tool-registry.js";

/**
 * Creates a deterministic model that returns predefined turns.
 *
 * This tests the real agent loop without making network requests or depending
 * on Gemini's behavior.
 */
function createSequenceModel(turns: readonly ModelTurn[]): {
  model: ModelClient;
  requests: ModelRequest[];
} {
  const requests: ModelRequest[] = [];
  let currentTurn = 0;

  const model: ModelClient = {
    async respond(request: ModelRequest): Promise<ModelTurn> {
      /*
       * Store the request so tests can verify what the loop sent to the model
       * after each tool call.
       */
      requests.push(request);

      const turn = turns[currentTurn];

      if (!turn) {
        throw new Error(
          `Fake model has no response for turn ${currentTurn + 1}.`,
        );
      }

      currentTurn += 1;
      return turn;
    },
  };

  return {
    model,
    requests,
  };
}

/**
 * Creates a small registry used to verify tool dispatch.
 */
function createEchoRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: "echo",
    description: "Returns the provided input.",

    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
        },
      },
      required: ["message"],
      additionalProperties: false,
    },

    execute: async (input: unknown) => input,
  });

  return registry;
}

describe("runAgent", () => {
  it("returns immediately when the model produces a final response", async () => {
    const { model, requests } = createSequenceModel([
      {
        id: "interaction-1",
        response: {
          type: "final",
          content: "Task complete.",
        },
      },
    ]);

    const tools = new ToolRegistry();

    const result = await runAgent({
      task: "Explain the repository.",
      model,
      tools,
    });

    expect(result).toEqual({
      finalResponse: "Task complete.",
      modelTurns: 1,
      events: [
        {
          type: "user",
          content: "Explain the repository.",
        },
        {
          type: "final",
          content: "Task complete.",
        },
      ],
    });

    expect(requests).toEqual([
      {
        events: [
          {
            type: "user",
            content: "Explain the repository.",
          },
        ],
        tools: [],
      },
    ]);
  });

  it("executes a requested tool and returns its result to the model", async () => {
    const { model, requests } = createSequenceModel([
      {
        id: "interaction-1",
        response: {
          type: "tool_call",
          call: {
            id: "call-1",
            name: "echo",
            arguments: {
              message: "Hello",
            },
          },
        },
      },
      {
        id: "interaction-2",
        response: {
          type: "final",
          content: "The echo tool returned Hello.",
        },
      },
    ]);

    const tools = createEchoRegistry();

    const result = await runAgent({
      task: "Use the echo tool.",
      model,
      tools,
    });

    expect(result).toEqual({
      finalResponse: "The echo tool returned Hello.",
      modelTurns: 2,
      events: [
        {
          type: "user",
          content: "Use the echo tool.",
        },
        {
          type: "tool_call",
          call: {
            id: "call-1",
            name: "echo",
            arguments: {
              message: "Hello",
            },
          },
        },
        {
          type: "tool_result",
          toolCallId: "call-1",
          toolName: "echo",
          success: true,
          output: {
            message: "Hello",
          },
        },
        {
          type: "final",
          content: "The echo tool returned Hello.",
        },
      ],
    });

    expect(requests).toHaveLength(2);

    /*
     * The first request contains only the user task and has no previous
     * provider interaction.
     */
    expect(requests[0]).toEqual({
      events: [
        {
          type: "user",
          content: "Use the echo tool.",
        },
      ],
      tools: [
        {
          name: "echo",
          description: "Returns the provided input.",
          inputSchema: {
            type: "object",
            properties: {
              message: {
                type: "string",
              },
            },
            required: ["message"],
            additionalProperties: false,
          },
        },
      ],
    });

    /*
     * The second request contains the tool call and result. It continues from
     * the Gemini interaction that originally requested the tool.
     */
    expect(requests[1]).toEqual({
      events: [
        {
          type: "user",
          content: "Use the echo tool.",
        },
        {
          type: "tool_call",
          call: {
            id: "call-1",
            name: "echo",
            arguments: {
              message: "Hello",
            },
          },
        },
        {
          type: "tool_result",
          toolCallId: "call-1",
          toolName: "echo",
          success: true,
          output: {
            message: "Hello",
          },
        },
      ],
      tools: [
        {
          name: "echo",
          description: "Returns the provided input.",
          inputSchema: {
            type: "object",
            properties: {
              message: {
                type: "string",
              },
            },
            required: ["message"],
            additionalProperties: false,
          },
        },
      ],
      previousTurnId: "interaction-1",
    });
  });

  it("returns an unknown-tool failure to the model instead of crashing", async () => {
    const { model, requests } = createSequenceModel([
      {
        id: "interaction-1",
        response: {
          type: "tool_call",
          call: {
            id: "call-2",
            name: "delete_everything",
            arguments: {},
          },
        },
      },
      {
        id: "interaction-2",
        response: {
          type: "final",
          content: "That tool is not available.",
        },
      },
    ]);

    const result = await runAgent({
      task: "Delete everything.",
      model,
      tools: new ToolRegistry(),
    });

    expect(result.finalResponse).toBe("That tool is not available.");

    expect(requests[1]?.events).toContainEqual({
      type: "tool_result",
      toolCallId: "call-2",
      toolName: "delete_everything",
      success: false,
      error: "Unknown tool: delete_everything",
    });
  });

  it("stops when the model-turn limit is reached", async () => {
    let toolExecutions = 0;

    const registry = new ToolRegistry();

    registry.register({
      name: "repeat",
      description: "Requests another model turn.",

      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },

      execute: async () => {
        toolExecutions += 1;

        return {
          repeated: true,
        };
      },
    });

    const { model } = createSequenceModel([
      {
        id: "interaction-1",
        response: {
          type: "tool_call",
          call: {
            id: "call-1",
            name: "repeat",
            arguments: {},
          },
        },
      },
      {
        id: "interaction-2",
        response: {
          type: "tool_call",
          call: {
            id: "call-2",
            name: "repeat",
            arguments: {},
          },
        },
      },
    ]);

    await expect(
      runAgent({
        task: "Repeat forever.",
        model,
        tools: registry,
        maxModelTurns: 2,
      }),
    ).rejects.toThrow("Agent exceeded the maximum of 2 model turns.");

    expect(toolExecutions).toBe(2);
  });

  it("rejects an empty task", async () => {
    const { model } = createSequenceModel([]);

    await expect(
      runAgent({
        task: "   ",
        model,
        tools: new ToolRegistry(),
      }),
    ).rejects.toThrow("Agent task cannot be empty.");
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects invalid maxModelTurns value %s",
    async (maxModelTurns) => {
      const { model } = createSequenceModel([]);

      await expect(
        runAgent({
          task: "Inspect the repository.",
          model,
          tools: new ToolRegistry(),
          maxModelTurns,
        }),
      ).rejects.toThrow("maxModelTurns must be a positive integer.");
    },
  );
});
