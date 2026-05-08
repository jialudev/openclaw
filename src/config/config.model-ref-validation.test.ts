import { describe, expect, it } from "vitest";
import type { PluginManifestRegistry } from "../plugins/manifest-registry.js";
import { validateConfigObjectWithPlugins } from "./validation.js";

const staleOpenAICodexReason =
  "is no longer supported for ChatGPT/Codex OAuth accounts. Use openai/gpt-5.5 through the Codex runtime.";
const unsupportedOpenAICodexProReason =
  "is not supported for ChatGPT/Codex OAuth accounts. Use openai/gpt-5.5 through the Codex runtime, or use";

function createModelSuppressionRegistry(): PluginManifestRegistry {
  return {
    diagnostics: [],
    plugins: [
      {
        id: "openai",
        origin: "bundled",
        channels: [],
        providers: ["openai", "openai-codex"],
        contracts: {},
        cliBackends: [],
        skills: [],
        hooks: [],
        rootDir: "/tmp/plugins/openai",
        source: "test",
        manifestPath: "/tmp/plugins/openai/openclaw.plugin.json",
        modelCatalog: {
          suppressions: [
            {
              provider: "openai-codex",
              model: "gpt-5.3-codex-spark",
              reason:
                "gpt-5.3-codex-spark is no longer exposed by the OpenAI or Codex catalogs. Use openai/gpt-5.5.",
            },
            {
              provider: "openai-codex",
              model: "gpt-5.2-codex",
              reason: `gpt-5.2-codex ${staleOpenAICodexReason}`,
            },
            {
              provider: "openai-codex",
              model: "gpt-5.3-codex",
              reason: `gpt-5.3-codex ${staleOpenAICodexReason}`,
            },
            {
              provider: "openai-codex",
              model: "gpt-5.4-pro",
              reason:
                "gpt-5.4-pro is not supported for ChatGPT/Codex OAuth accounts. Use openai/gpt-5.5 through the Codex runtime, or use openai/gpt-5.4-pro with OpenAI API-key routing if your account has access.",
            },
            {
              provider: "openai-codex",
              model: "gpt-5.5-pro",
              reason:
                "gpt-5.5-pro is not supported for ChatGPT/Codex OAuth accounts. Use openai/gpt-5.5 through the Codex runtime, or use openai/gpt-5.5-pro with OpenAI API-key routing if your account has access.",
            },
          ],
        },
      },
    ],
  };
}

describe("config model reference validation", () => {
  it("rejects statically suppressed provider/model pairs during config validation", () => {
    const res = validateConfigObjectWithPlugins(
      {
        agents: {
          defaults: {
            model: {
              primary: "openai-codex/gpt-5.3-codex-spark",
            },
          },
        },
      },
      {
        pluginMetadataSnapshot: {
          manifestRegistry: createModelSuppressionRegistry(),
        },
      },
    );

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.issues).toContainEqual({
      path: "agents.defaults.model.primary",
      message:
        "Unknown model: openai-codex/gpt-5.3-codex-spark. gpt-5.3-codex-spark is no longer exposed by the OpenAI or Codex catalogs. Use openai/gpt-5.5.",
    });
  });

  it("accepts supported openai-codex provider/model pairs", () => {
    const res = validateConfigObjectWithPlugins(
      {
        agents: {
          defaults: {
            model: {
              primary: "openai-codex/gpt-5.4-mini",
            },
          },
        },
      },
      {
        pluginMetadataSnapshot: {
          manifestRegistry: createModelSuppressionRegistry(),
        },
      },
    );

    expect(res.ok).toBe(true);
  });

  it("rejects stale openai-codex fallback model pairs", () => {
    const res = validateConfigObjectWithPlugins(
      {
        agents: {
          defaults: {
            model: {
              primary: "openai-codex/gpt-5.4-mini",
              fallbacks: ["openai-codex/gpt-5.2-codex", "openai-codex/gpt-5.3-codex"],
            },
          },
        },
      },
      {
        pluginMetadataSnapshot: {
          manifestRegistry: createModelSuppressionRegistry(),
        },
      },
    );

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.issues).toContainEqual({
      path: "agents.defaults.model.fallbacks.0",
      message:
        "Unknown model: openai-codex/gpt-5.2-codex. gpt-5.2-codex is no longer supported for ChatGPT/Codex OAuth accounts. Use openai/gpt-5.5 through the Codex runtime.",
    });
    expect(res.issues).toContainEqual({
      path: "agents.defaults.model.fallbacks.1",
      message:
        "Unknown model: openai-codex/gpt-5.3-codex. gpt-5.3-codex is no longer supported for ChatGPT/Codex OAuth accounts. Use openai/gpt-5.5 through the Codex runtime.",
    });
  });

  it("rejects openai-codex Pro refs that require a non-OAuth route", () => {
    const res = validateConfigObjectWithPlugins(
      {
        agents: {
          defaults: {
            model: {
              primary: "openai-codex/gpt-5.4-pro",
              fallbacks: ["openai-codex/gpt-5.5-pro"],
            },
          },
        },
      },
      {
        pluginMetadataSnapshot: {
          manifestRegistry: createModelSuppressionRegistry(),
        },
      },
    );

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.issues).toContainEqual(
      expect.objectContaining({
        path: "agents.defaults.model.primary",
        message: expect.stringContaining(unsupportedOpenAICodexProReason),
      }),
    );
    expect(res.issues).toContainEqual(
      expect.objectContaining({
        path: "agents.defaults.model.fallbacks.0",
        message: expect.stringContaining(unsupportedOpenAICodexProReason),
      }),
    );
  });
});
