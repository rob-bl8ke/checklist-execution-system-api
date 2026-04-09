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

const GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-1.5-flash';

@Injectable()
export class GoogleProvider implements IAiProvider {
  readonly key = AiProviderKey.GOOGLE_API;

  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY;
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
        unavailableReason: 'GOOGLE_API_KEY environment variable is not set',
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

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
      ...request.history.map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      {
        role: 'user',
        parts: [{ text: buildUserTurn(request, body) }],
      },
    ];

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: 4096,
    };

    if (wantsStructured) {
      generationConfig.responseMimeType = 'application/json';
    }

    const payload: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig,
    };

    const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${this.apiKey!}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Google API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content: { parts: Array<{ text: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
      };
    };

    const rawText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = wantsStructured
      ? parseStructuredResponse(rawText)
      : { assistantMessage: rawText };

    return {
      assistantMessage: parsed.assistantMessage,
      proposal: parsed.proposal,
      rawMetadata: {
        model,
        finishReason: data.candidates?.[0]?.finishReason ?? null,
        promptTokens: data.usageMetadata?.promptTokenCount ?? null,
        candidateTokens: data.usageMetadata?.candidatesTokenCount ?? null,
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
