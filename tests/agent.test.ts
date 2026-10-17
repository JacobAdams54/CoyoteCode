import { describe, expect, it } from "vitest";
import { runAgent } from "../src/agent.js";
import { ToolRegistry } from "../src/tools.js";
import type { AssistantMessage, Message, ModelClient, ToolSummary } from "../src/types.js";

/**
 * Creates a mock model that returns predefined responses turn by turn.
 */
function createMockModel(responses: AssistantMessage[]): {
  model: ModelClient;
  history: Message[][];
} {
  const history: Message[][] = [];
  let turn = 0;

  const model: ModelClient = {
    async respond(messages: Message[], _tools: ToolSummary[]): Promise<AssistantMessage> {
      history.push([...messages]);
      const response = responses[turn++];
      if (!response) {
        throw new Error(`Mock model has no response for turn ${turn}`);
      }
      return response;
    },
  };

  return { model, history };
}

describe("runAgent", () => {
  it("returns immediately when the model gives a final response", async () => {
    const { model, history } = createMockModel([
      { role: "assistant", content: "Hello! Task complete." },
    ]);
    const tools = new ToolRegistry();

    const result = await runAgent({
      task: "Say hello",
      model,
      tools,
    });

    expect(result.finalResponse).toBe("Hello! Task complete.");
    expect(result.turns).toBe(1);
    expect(result.messages).toEqual([
      { role: "user", content: "Say hello" },
      { role: "assistant", content: "Hello! Task complete." },
    ]);
    expect(history.length).toBe(1);
  });

  it("executes a tool call and passes the result back to the model", async () => {
    const { model, history } = createMockModel([
      {
        role: "assistant",
        toolCalls: [{ id: "call-1", name: "echo", arguments: { msg: "ping" } }],
      },
      {
        role: "assistant",
        content: "Echo returned ping.",
      },
    ]);

    const tools = new ToolRegistry();
    tools.register({
      name: "echo",
      description: "Echoes input",
      parameters: { type: "object", properties: { msg: { type: "string" } } },
      execute: async (args) => args.msg,
    });

    const result = await runAgent({
      task: "Echo ping",
      model,
      tools,
    });

    expect(result.finalResponse).toBe("Echo returned ping.");
    expect(result.turns).toBe(2);
    expect(result.messages).toEqual([
      { role: "user", content: "Echo ping" },
      {
        role: "assistant",
        toolCalls: [{ id: "call-1", name: "echo", arguments: { msg: "ping" } }],
      },
      {
        role: "tool",
        toolCallId: "call-1",
        toolName: "echo",
        content: JSON.stringify("ping"),
      },
      {
        role: "assistant",
        content: "Echo returned ping.",
      },
    ]);
    expect(history.length).toBe(2);
  });

  it("throws when maximum turns are exceeded", async () => {
    // Model loops forever calling echo
    const { model } = createMockModel([
      { role: "assistant", toolCalls: [{ id: "1", name: "echo", arguments: {} }] },
      { role: "assistant", toolCalls: [{ id: "2", name: "echo", arguments: {} }] },
      { role: "assistant", toolCalls: [{ id: "3", name: "echo", arguments: {} }] },
    ]);

    const tools = new ToolRegistry();
    tools.register({
      name: "echo",
      description: "Echo",
      parameters: { type: "object", properties: {} },
      execute: async () => "ok",
    });

    await expect(
      runAgent({ task: "Loop", model, tools, maxTurns: 2 }),
    ).rejects.toThrow("Agent exceeded maximum of 2 turns.");
  });
});
