import { Injectable } from '@nestjs/common';
import { AiProviderKey } from '../enums/ai-provider-key.enum';
import {
  AiProviderCapabilities,
  IAiProvider,
} from '../interfaces/ai-provider.interface';
import { AiGenerateRequest } from '../interfaces/ai-generate-request.interface';
import { AiGenerateResult } from '../interfaces/ai-generate-result.interface';
import { ToolExecutorService } from '../services/tool-executor.service';
import { MAX_BODY_SIZE } from './parse-structured-response';

@Injectable()
export class CopilotProvider implements IAiProvider {
  readonly key = AiProviderKey.COPILOT_CLI;

  private readonly ghPath: string;

  constructor(private readonly toolExecutor: ToolExecutorService) {
    this.ghPath = process.env.COPILOT_CLI_PATH ?? 'gh';
  }

  get capabilities(): AiProviderCapabilities {
    // `gh copilot suggest` is interactive-first; non-interactive invocation is
    // unreliable for structured JSON output, so supportsStructuredProposal is
    // false.  The adapter always returns advice-only.
    return {
      available: true,
      transport: 'cli',
      supportsChat: false,
      supportsPresetActions: false,
      supportsStructuredProposal: false,
      supportsStreaming: false,
      unavailableReason:
        'Copilot CLI (gh copilot) is interactive-first and does not reliably support non-interactive structured output. Prefer an API provider for structured proposals.',
    };
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const body = request.body
      ? request.body.slice(0, MAX_BODY_SIZE)
      : null;

    const prompt = buildExplainQuery(request, body);

    let rawText: string;
    try {
      rawText = await this.toolExecutor.execute(
        this.ghPath,
        ['copilot', 'explain', prompt],
        '',
        { timeoutMs: 60_000 },
      );
    } catch (error) {
      throw new Error(
        `Copilot CLI execution failed: ${(error as Error).message}`,
      );
    }

    // Always advice-only — no structured proposal for Copilot CLI
    return {
      assistantMessage: rawText.trim(),
      rawMetadata: {
        transport: 'cli',
        provider: 'copilot',
        mode: 'advice_only',
      },
    };
  }
}

function buildExplainQuery(
  request: AiGenerateRequest,
  body: string | null,
): string {
  const parts: string[] = [];
  if (body !== null) {
    parts.push(`Note:\n${body}`);
  }
  parts.push(request.userMessage);
  return parts.join('\n\n');
}
