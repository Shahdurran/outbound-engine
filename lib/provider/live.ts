import Anthropic from "@anthropic-ai/sdk";
import { costOf } from "../pricing";
import type { Provider, ProviderRequest, ProviderResponse } from "./types";
import { ProviderError } from "./types";

/**
 * Live Anthropic Messages calls.
 *
 * Two things worth knowing if you are reading this next to the Anthropic docs:
 *
 *  - Assistant prefill is rejected on current models, so we cannot force JSON
 *    by prefilling "{". The JSON contract is carried by the system prompt and
 *    enforced downstream by Zod plus the one-shot repair retry in runtime.ts.
 *  - The system prompt is marked cache-ephemeral. Each sub-agent's prompt is
 *    long and byte-stable across runs, so re-runs read it from cache at ~0.1x.
 */

export const DEFAULT_MODEL = "claude-opus-5";

export function resolveModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

export class LiveProvider implements Provider {
  readonly mode = "live" as const;
  readonly model: string;
  private client: Anthropic;

  constructor(model = resolveModel()) {
    this.model = model;
    this.client = new Anthropic();
  }

  async createMessage(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens,
        thinking: { type: "adaptive" },
        output_config: { effort: request.effort },
        system: [
          {
            type: "text",
            text: request.system,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: request.tools,
        messages: request.messages,
      });

      const counts = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
      };

      return {
        content: response.content,
        stopReason: response.stop_reason,
        usage: { ...counts, costUsd: costOf(this.model, counts) },
      };
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new ProviderError(`rate limited: ${error.message}`, true);
      }
      if (error instanceof Anthropic.AuthenticationError) {
        throw new ProviderError(
          "ANTHROPIC_API_KEY is set but was rejected. Unset it to run in replay mode.",
          false,
        );
      }
      if (error instanceof Anthropic.APIConnectionError) {
        throw new ProviderError(`connection failed: ${error.message}`, true);
      }
      if (error instanceof Anthropic.APIError) {
        throw new ProviderError(`API error ${error.status}: ${error.message}`, false);
      }
      throw error;
    }
  }
}
