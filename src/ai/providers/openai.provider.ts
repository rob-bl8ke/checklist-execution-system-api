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

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

@Injectable()
export class OpenAIProvider implements IAiProvider {
  readonly key = AiProviderKey.OPENAI_API;

  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
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
        unavailableReason: 'OPENAI_API_KEY environment variable is not set',
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

    const wantsStructured =
      request.expectedOutput === 'BODY_PROPOSAL_OR_ADVICE';

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...request.history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: buildUserTurn(request, body) },
    ];

    const payload: Record<string, unknown> = {
      model,
      messages,
      max_tokens: 4096,
    };

    if (wantsStructured) {
      payload.response_format = { type: 'json_object' };
    }

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey!}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string }; finish_reason?: string }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
      model?: string;
    };

    const rawText = data.choices?.[0]?.message?.content ?? '';
    const parsed = wantsStructured
      ? parseStructuredResponse(rawText)
      : { assistantMessage: rawText };

    return {
      assistantMessage: parsed.assistantMessage,
      proposal: parsed.proposal,
      rawMetadata: {
        model: data.model ?? model,
        finishReason: data.choices?.[0]?.finish_reason ?? null,
        promptTokens: data.usage?.prompt_tokens ?? null,
        completionTokens: data.usage?.completion_tokens ?? null,
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
