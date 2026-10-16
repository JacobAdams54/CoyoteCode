import { describe, expect, it } from "vitest";

import { createModelFromEnvironment } from "../src/model/model-factory.js";

describe("createModelFromEnvironment", () => {
  it.each([
    ["google", "GEMINI_API_KEY"],
    ["openai", "OPENAI_API_KEY"],
    ["anthropic", "ANTHROPIC_API_KEY"],
    ["deepseek", "DEEPSEEK_API_KEY"],
  ])("requires credentials for %s", (provider, credential) => {
    expect(() =>
      createModelFromEnvironment({
        AI_PROVIDER: provider,
      }),
    ).toThrow(`${credential} is required when AI_PROVIDER=${provider}.`);
  });

  it("creates a model for LM Studio without a cloud API key", () => {
    expect(
      createModelFromEnvironment({
        AI_PROVIDER: "lmstudio",
        AI_MODEL: "qwen2.5-coder",
      }),
    ).toBeDefined();
  });

  it("requires a Bionic base URL and API key", () => {
    expect(() =>
      createModelFromEnvironment({
        AI_PROVIDER: "bionic",
      }),
    ).toThrow("BIONIC_API_KEY is required when AI_PROVIDER=bionic.");
  });

  it("rejects unsupported providers", () => {
    expect(() =>
      createModelFromEnvironment({
        AI_PROVIDER: "unknown",
      }),
    ).toThrow("Unsupported AI_PROVIDER");
  });
});
