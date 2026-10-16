import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import { AiSdkModel } from "./ai-sdk-model.js";

export type ModelProvider =
  | "google"
  | "openai"
  | "anthropic"
  | "deepseek"
  | "lmstudio"
  | "bionic";

export interface ModelFactoryEnvironment {
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  LMSTUDIO_API_KEY?: string;
  LMSTUDIO_BASE_URL?: string;
  BIONIC_API_KEY?: string;
  BIONIC_BASE_URL?: string;
}

const DEFAULT_MODELS: Record<ModelProvider, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-5",
  anthropic: "claude-sonnet-4-5",
  deepseek: "deepseek-chat",
  lmstudio: "local-model",
  bionic: "local-model",
};

function required(
  environment: ModelFactoryEnvironment,
  name: keyof ModelFactoryEnvironment,
  provider: ModelProvider,
): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required when AI_PROVIDER=${provider}.`);
  }

  return value;
}

function optional(
  environment: ModelFactoryEnvironment,
  name: keyof ModelFactoryEnvironment,
): string | undefined {
  return environment[name]?.trim() || undefined;
}

function parseProvider(value: string | undefined): ModelProvider {
  const provider = value?.trim().toLowerCase() || "google";

  if (
    provider !== "google" &&
    provider !== "openai" &&
    provider !== "anthropic" &&
    provider !== "deepseek" &&
    provider !== "lmstudio" &&
    provider !== "bionic"
  ) {
    throw new Error(
      `Unsupported AI_PROVIDER "${provider}". ` +
        "Use google, openai, anthropic, deepseek, lmstudio, or bionic.",
    );
  }

  return provider;
}

function createLanguageModel(
  provider: ModelProvider,
  model: string,
  environment: ModelFactoryEnvironment,
): LanguageModel {
  switch (provider) {
    case "google":
      return createGoogleGenerativeAI({
        apiKey: required(environment, "GEMINI_API_KEY", provider),
      })(model);
    case "openai":
      return createOpenAI({
        apiKey: required(environment, "OPENAI_API_KEY", provider),
      })(model);
    case "anthropic":
      return createAnthropic({
        apiKey: required(environment, "ANTHROPIC_API_KEY", provider),
      })(model);
    case "deepseek":
      return createDeepSeek({
        apiKey: required(environment, "DEEPSEEK_API_KEY", provider),
      })(model);
    case "lmstudio":
      return createOpenAI({
        apiKey: optional(environment, "LMSTUDIO_API_KEY") ?? "lm-studio",
        baseURL:
          optional(environment, "LMSTUDIO_BASE_URL") ??
          "http://127.0.0.1:1234/v1",
      })(model);
    case "bionic":
      return createOpenAI({
        apiKey: required(environment, "BIONIC_API_KEY", provider),
        baseURL: required(environment, "BIONIC_BASE_URL", provider),
      })(model);
  }
}

/**
 * Creates the CoyoteCode model adapter from provider-neutral configuration.
 *
 * LM Studio and Bionic use the OpenAI-compatible AI SDK provider. The model
 * adapter and agent loop remain unchanged for every provider.
 */
export function createModelFromEnvironment(
  environment: ModelFactoryEnvironment = process.env,
): AiSdkModel {
  const provider = parseProvider(environment.AI_PROVIDER);
  const model =
    optional(environment, "AI_MODEL") ?? DEFAULT_MODELS[provider];

  return new AiSdkModel(createLanguageModel(provider, model, environment));
}
