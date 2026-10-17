# Coyote Code: code map

This map starts at [`src/index.ts`](../src/index.ts) and follows the modules
that make one model/tool run possible.

## Responsibilities and boundaries

### [`src/types.ts`](../src/types.ts): core data contracts

- **Purpose:** Defines the industry-standard agent types: `ToolDefinition`, `ToolCall`,
  `ToolSummary`, `Message` (`user` | `assistant` | `tool`), and `ModelClient`.
- **Why it matters:** Students can open this single file to understand the shapes of all
  messages and tools without navigating nested type files.

### [`src/index.ts`](../src/index.ts): application entry point

- **Purpose:** Loads environment configuration, accepts the task from the command line
  (or uses the built-in default), creates the tool registry and model, and starts one agent run.
  It also prints the message history trace.
- **Input:** `GEMINI_API_KEY` (or local model config), current working directory, and command-line arguments.
  The controlled workspace is `sample-project` below the current working directory.
- **Output:** Console output for the workspace, registered tools, each message in the trace,
  the final response, and the number of turns.

### [`src/agent.ts`](../src/agent.ts): orchestration loop

- **Purpose:** Coordinates the model-decision/tool-execution cycle until the model returns
  a final answer or the turn limit is exceeded.
- **Input:** `RunAgentOptions`: task, `ModelClient`, `ToolRegistry`, and optional `maxTurns` (default 6).
- **Output:** `AgentRunResult` with the final response text, ordered `messages`, and number of turns.
- **Calls:** On each turn, calls `model.respond(messages, tools.list())`. If the response contains
  tool calls, dispatches each to `tools.execute()` and appends the result messages; if final, returns.

### [`src/tools.ts`](../src/tools.ts): tool registry and filesystem tools

- **Purpose:** Provides both the `ToolRegistry` (the application allowlist and dispatch boundary)
  and `createListFilesTool` (a read-only filesystem tool restricted to the workspace).
- **Registry:** Stores trusted `ToolDefinition` instances. Exposes `list()` (parameters only, no executable code)
  and `execute()` (dispatches model calls and returns structured tool messages).
- **List Files Tool:** Lists entries in a directory using a clean 5-line `safePath` workspace check.

### [`src/model.ts`](../src/model.ts): OpenAI model client and factory

- **Purpose:** Implements `ModelClient` using the official `openai` SDK, and provides
  `createModelFromEnvironment()` to initialize Google Gemini (default) or Local LLM / LM Studio.

## Call walkthrough

```text
index.ts
  -> runAgent (agent.ts)
       -> OpenAiModel.respond (model.ts — model decides)
       -> ToolRegistry.execute (tools.ts — application dispatches)
            -> list_files.execute (tools.ts — filesystem work)
       -> OpenAiModel.respond (model.ts — uses tool result)
  -> printMessage / console (index.ts)
```

## Adding another tool

Define a new tool function matching the `ToolDefinition` interface in [`src/tools.ts`](../src/tools.ts):
provide a `name`, `description`, `parameters`, and an `execute(args)` function. Then register it in
[`src/index.ts`](../src/index.ts):

```ts
tools.register(createNewTool(workspaceRoot));
```

The agent loop and model client will automatically expose its parameters to the model and dispatch calls to it.
