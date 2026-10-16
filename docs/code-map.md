# Coyote Code: code map

This map starts at [`src/index.ts`](../src/index.ts) and follows the modules
that make one model/tool run possible.

## Responsibilities and boundaries

### [`src/index.ts`](../src/index.ts): application entry point

- **Purpose:** Loads environment configuration, accepts the task from the
  command line (or uses the built-in default), creates the tool registry and
  AI SDK-backed model, and starts one agent run. It also prints the provider-neutral
  event history and handles startup/run failures.
- **Input:** `GEMINI_API_KEY`, optional `GEMINI_MODEL`, the current working
  directory, and command-line arguments. The controlled workspace is
  `sample-project` below the current working directory.
- **Output:** Console output for the workspace, registered tools, each event,
  the final response, and the number of model turns. `main()` returns no
  application value; failures set the process exit code to `1`.
- **Calls:** `createListFilesTool()` to build the filesystem tool,
  `ToolRegistry.register()` to allowlist it, `createModelFromEnvironment()` to configure
  the model, and `runAgent()` to execute the task. Its local `printEvent()`
  only formats events; it does not make decisions or execute tools.

### [`src/model/ai-sdk-model.ts`](../src/model/ai-sdk-model.ts): model adapter

- **Purpose:** Implements `ModelClient` with AI SDK `generateText()` for one
  model turn at a time. It translates CoyoteCode events and tool summaries into
  AI SDK messages and non-executable tool definitions.
- **Output:** A provider-neutral `ModelTurn`; tool execution remains in
  `ToolRegistry`.
- **Provider substitution:** The adapter accepts any AI SDK `LanguageModel`,
  including `google("gemini-2.5-flash")`, `openai("gpt-5")`, or
  `anthropic("claude-sonnet-4-5")`.

### [`src/model/model-factory.ts`](../src/model/model-factory.ts): model factory

- **Purpose:** Selects Google, OpenAI, Anthropic, DeepSeek, LM Studio, or
  Bionic from `AI_PROVIDER` and constructs the corresponding AI SDK
  `LanguageModel`.
- **Configuration:** `AI_MODEL` selects the model. Cloud providers use their
  provider-specific API key. LM Studio and Bionic use OpenAI-compatible
  endpoints.

### [`src/agent/agent-loop.ts`](../src/agent/agent-loop.ts): orchestration loop

- **Purpose:** Coordinates the model-decision/tool-execution cycle until the
  model returns a final answer or the model-turn limit is exceeded.
- **Input:** `RunAgentOptions`: a non-empty task, a `ModelClient`, a
  `ToolRegistry`, and an optional positive `maxModelTurns` (default `6`).
- **Output:** `AgentRunResult` with the final response text, ordered
  provider-neutral events, and the number of model turns. It throws for
  invalid options or an exceeded turn limit.
- **Calls:** On each turn, calls `model.respond()` with the current events and
  `tools.list()`. If the response is a tool call, it calls
  `tools.execute()` and appends the structured result; if it is final, it
  returns. Later model requests carry the previous model turn ID.

### [`src/tools/tool-registry.ts`](../src/tools/tool-registry.ts): tool
allowlist and dispatcher

- **Purpose:** Stores registered, trusted `ToolDefinition` implementations and
  separates model-visible descriptions from executable functions. It is the
  authorization boundary for tool names.
- **Input:** `register()` accepts a `ToolDefinition`; `list()` has no input;
  `execute()` accepts a model-produced `ToolCall` containing an ID, name, and
  unknown arguments.
- **Output:** `list()` returns `ToolSummary[]`, which contains no executable
  functions. `execute()` returns a structured successful or failed
  `ToolResult`; unknown names and thrown tool errors become failure results.
- **Calls:** `execute()` looks up the requested name and, only for a registered
  name, calls that definition’s `execute(input)` function. The registry is
  called by [`agent-loop.ts`](../src/agent/agent-loop.ts), while registration
  is performed by [`index.ts`](../src/index.ts).

### [`src/tools/list-files.ts`](../src/tools/list-files.ts): restricted
filesystem tool

- **Purpose:** Creates the read-only `list_files` tool. The returned tool lists
  immediate entries in a directory while enforcing that the requested path is
  relative, exists, is a directory, and stays inside the configured workspace
  (including after symbolic-link resolution).
- **Input:** `createListFilesTool(workspaceRoot)` receives the trusted workspace
  root. Later, the tool’s `execute()` receives untrusted model arguments of
  the form `{ path: string }`, such as `{ "path": "src" }`.
- **Output:** On success, `{ path, entries }`, where `path` is relative to the
  workspace and each entry has a name and type (`file`, `directory`,
  `symbolic_link`, or `other`). Invalid, missing, outside, or non-directory
  paths throw; the registry converts those errors into failed tool results.
- **Calls:** Uses Node filesystem/path APIs (`realpath`, `stat`, `readdir`,
  and path resolution). `index.ts` creates it; `ToolRegistry.execute()` later
  invokes its `execute()` function after the model requests `list_files`.

## Model decisions versus tool execution

The configured AI SDK model makes the decision: it receives the task/result context and tool
schemas, then chooses either a tool call or a final response. The application
executes the decision: [`ToolRegistry`](../src/tools/tool-registry.ts) checks
the allowlist and invokes the selected trusted function, while
[`list-files.ts`](../src/tools/list-files.ts) validates arguments and reads
the controlled filesystem. The model never receives the executable function.

## Call walkthrough

1. [`index.ts`](../src/index.ts) builds a `ToolRegistry`, registers the
   `list_files` definition from [`list-files.ts`](../src/tools/list-files.ts),
   creates [`AiSdkModel`](../src/model/ai-sdk-model.ts), and calls
   [`runAgent`](../src/agent/agent-loop.ts).
2. `runAgent` asks `AiSdkModel.respond()` for a decision, passing the task
   event and `ToolRegistry.list()` output.
3. If the model chooses a tool, `runAgent` passes its `ToolCall` to
   `ToolRegistry.execute()`. The registry dispatches to `list_files`, which
   returns directory data or an error.
4. `runAgent` appends that result and asks the model for the next decision. When
   the model returns final text, `runAgent` returns the event history to `index.ts`,
   which prints it.

```text
index.ts
  -> runAgent
       -> AiSdkModel.respond (model decides)
       -> ToolRegistry.execute (application dispatches)
            -> list-files.execute (filesystem work)
       -> AiSdkModel.respond (uses tool result)
  -> printEvent / console
```

## Registering another tool

A contributor should add a tool factory or definition under
[`src/tools/`](../src/tools/), following the `ToolDefinition` contract in
[`src/tools/tool-types.ts`](../src/tools/tool-types.ts): provide a unique
name, description, input schema, and an `execute(input)` function that
validates untrusted input at runtime. Then import it in
[`src/index.ts`](../src/index.ts), create it with any trusted configuration,
and call `tools.register(newTool)` after `const tools = new ToolRegistry()`.
The agent loop and AI SDK adapter will automatically expose its summary to the
model and dispatch matching calls; no model-specific registration is needed.
