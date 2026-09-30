import { describe, expect, it } from "vitest";

import { runAgent } from "../src/agent/agent-loop.js";
import type {
  ModelClient,
  ModelRequest,
  ModelTurn,
} from "../src/model/model-types.js";
import { ToolRegistry } from "../src/tools/tool-registry.js";

function createSequenceModel(turns: readonly ModelTurn[]): {
  model: ModelClient;
  requests: ModelRequest[];
} {
  const requests: ModelRequest[] = [];
  let currentTurn = 0;

  const model: ModelClient = {
    async respond(request): Promise<ModelTurn> {
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

describe("Lab 1 agent loop", () => {
  it("records the user task and returns a final response", async () => {
    const { model } = createSequenceModel([
      {
        id: "interaction-1",
        response: {
          type: "final",
          content: "Task complete.",
        },
      },
    ]);

    const result = await runAgent({
      task: "Inspect the project.",
      model,
      tools: new ToolRegistry(),
    });

    expect(result).toEqual({
      finalResponse: "Task complete.",
      modelTurns: 1,
      events: [
        {
          type: "user",
          content: "Inspect the project.",
        },
        {
          type: "final",
          content: "Task complete.",
        },
      ],
    });
  });

  it("executes a requested tool and returns the result to the model", async () => {
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
          content: "The tool returned Hello.",
        },
      },
    ]);

    const result = await runAgent({
      task: "Use the echo tool.",
      model,
      tools: createEchoRegistry(),
    });

    expect(result.finalResponse).toBe("The tool returned Hello.");

    expect(requests[1]?.previousTurnId).toBe("interaction-1");

    expect(requests[1]?.events).toContainEqual({
      type: "tool_result",
      toolCallId: "call-1",
      toolName: "echo",
      success: true,
      output: {
        message: "Hello",
      },
    });
  });

  it("passes an event-history snapshot to each model turn", async () => {
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
          content: "Finished.",
        },
      },
    ]);

    await runAgent({
      task: "Use the echo tool.",
      model,
      tools: createEchoRegistry(),
    });

    /*
     * The first request must retain only the event history that existed
     * during the first model turn.
     */
    expect(requests[0]?.events).toEqual([
      {
        type: "user",
        content: "Use the echo tool.",
      },
    ]);

    expect(requests[1]?.events).toHaveLength(3);
  });

  it("stops after the configured model-turn limit", async () => {
    const { model } = createSequenceModel([
      {
        id: "interaction-1",
        response: {
          type: "tool_call",
          call: {
            id: "call-1",
            name: "echo",
            arguments: {
              message: "Again",
            },
          },
        },
      },
      {
        id: "interaction-2",
        response: {
          type: "tool_call",
          call: {
            id: "call-2",
            name: "echo",
            arguments: {
              message: "Again",
            },
          },
        },
      },
    ]);

    await expect(
      runAgent({
        task: "Keep using tools.",
        model,
        tools: createEchoRegistry(),
        maxModelTurns: 2,
      }),
    ).rejects.toThrow("Agent exceeded the maximum of 2 model turns.");
  });
});
