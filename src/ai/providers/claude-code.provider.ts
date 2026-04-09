import { Injectable } from '@nestjs/common';
import { AiProviderKey } from '../enums/ai-provider-key.enum';
import {
  AiProviderCapabilities,
  IAiProvider,
} from '../interfaces/ai-provider.interface';
import { AiGenerateRequest } from '../interfaces/ai-generate-request.interface';
import { AiGenerateResult } from '../interfaces/ai-generate-result.interface';
import { ToolExecutorService } from '../services/tool-executor.service';
import {
  MAX_BODY_SIZE,
  parseStructuredResponse,
} from './parse-structured-response';

@Injectable()
export class ClaudeCodeProvider implements IAiProvider {
  readonly key = AiProviderKey.CLAUDE_CODE_CLI;

  private readonly cliPath: string;

  constructor(private readonly toolExecutor: ToolExecutorService) {
    this.cliPath = process.env.CLAUDE_CLI_PATH ?? 'claude';
  }

  get capabilities(): AiProviderCapabilities {
    return {
      available: true,
      transport: 'cli',
      supportsChat: true,
      supportsPresetActions: true,
      // Structured JSON output from CLI is less reliable; provider degrades to
      // advice-only when parsing fails — still report support here so the caller
      // can request it and receive a best-effort result.
      supportsStructuredProposal: true,
      supportsStreaming: false,
    };
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const body = request.body
      ? request.body.slice(0, MAX_BODY_SIZE)
      : null;

    const prompt = flattenPrompt(request, body);
    const wantsStructured =
      request.expectedOutput === 'BODY_PROPOSAL_OR_ADVICE';

    let rawText: string;
    try {
      // Pass prompt via stdin; use --print for non-interactive output
      rawText = await this.toolExecutor.execute(
        this.cliPath,
        ['--print'],
        prompt,
        { timeoutMs: 60_000 },
      );
    } catch (error) {
      throw new Error(
        `Claude Code CLI execution failed: ${(error as Error).message}`,
      );
    }

    const parsed =
      wantsStructured
        ? parseStructuredResponse(rawText)
        : { assistantMessage: rawText };

    return {
      assistantMessage: parsed.assistantMessage,
      // If structured JSON could not be parsed, degrade gracefully to advice-only
      proposal: parsed.proposal,
      rawMetadata: { transport: 'cli', provider: 'claude-code' },
    };
  }
}

/**
 * Flattens all canonical prompt components into a single string with stable
 * section delimiters for CLI consumption.
 */
function flattenPrompt(
  request: AiGenerateRequest,
  body: string | null,
): string {
  const sections: string[] = [];

  if (request.systemPrompt) {
    sections.push(`=== SYSTEM ===\n${request.systemPrompt}`);
  }

  if (body !== null) {
    sections.push(`=== NOTE BODY ===\n${body}`);
  }

  if (request.history.length > 0) {
    const historyText = request.history
      .map((h) => `${h.role.toUpperCase()}: ${h.content}`)
      .join('\n');
    sections.push(`=== CONVERSATION HISTORY ===\n${historyText}`);
  }

  sections.push(`=== USER MESSAGE ===\n${request.userMessage}`);

  return sections.join('\n\n');
}
