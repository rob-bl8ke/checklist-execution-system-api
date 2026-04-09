import { Injectable } from '@nestjs/common';
import { AiProviderKey } from '../enums/ai-provider-key.enum';
import {
  AiProviderCapabilities,
  IAiProvider,
} from '../interfaces/ai-provider.interface';
import { AiGenerateRequest } from '../interfaces/ai-generate-request.interface';
import { AiGenerateResult } from '../interfaces/ai-generate-result.interface';
import {
  MAX_BODY_SIZE,
  parseStructuredResponse,
} from './parse-structured-response';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';

@Injectable()
export class AnthropicProvider implements IAiProvider {
  readonly key = AiProviderKey.ANTHROPIC_API;

  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  get capabilities(): AiProviderCapabilities {
    if (!this.apiKey) {
      return {
        available: false,
        transport: 'api',
        supportsChat: true,
        supportsPresetActions: true,
        supportsStructuredProposal: true,
        supportsStreaming: false,
        unavailableReason: 'ANTHROPIC_API_KEY environment variable is not set',
      };
    }
    return {
      available: true,
      transport: 'api',
      supportsChat: true,
      supportsPresetActions: true,
      supportsStructuredProposal: true,
      supportsStreaming: false,
    };
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const model = DEFAULT_MODEL;
    const systemPrompt =
      request.systemPrompt ?? 'You are a helpful assistant.';
    const body = request.body
      ? request.body.slice(0, MAX_BODY_SIZE)
      : null;

    const messages: Array<{ role: string; content: string }> = [
      ...request.history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: buildUserTurn(request, body) },
    ];

    const payload: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    };

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Anthropic API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
      model?: string;
      stop_reason?: string;
    };

    const rawText = data.content?.[0]?.text ?? '';
    const parsed =
      request.expectedOutput === 'BODY_PROPOSAL_OR_ADVICE'
        ? parseStructuredResponse(rawText)
        : { assistantMessage: rawText };

    return {
      assistantMessage: parsed.assistantMessage,
      proposal: parsed.proposal,
      rawMetadata: {
        model: data.model ?? model,
        stopReason: data.stop_reason ?? null,
        inputTokens: data.usage?.input_tokens ?? null,
        outputTokens: data.usage?.output_tokens ?? null,
      },
    };
  }
}

function buildUserTurn(
  request: AiGenerateRequest,
  body: string | null,
): string {
  const parts: string[] = [];
  if (body !== null) {
    parts.push(`Note body:\n${body}`);
  }
  parts.push(request.userMessage);
  return parts.join('\n\n');
}
