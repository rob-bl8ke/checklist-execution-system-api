import { Injectable } from '@nestjs/common';
import { AiGenerateRequest } from '../interfaces/ai-generate-request.interface';
import {
  BASE_SYSTEM_PROMPT,
  PRESET_INSTRUCTIONS,
  STRUCTURED_OUTPUT_INSTRUCTION,
  ADVICE_ONLY_PRESETS,
  MAX_HISTORY_MESSAGES,
} from '../prompts/prompt.constants';

export interface AssembledPrompt {
  /** Fully assembled system prompt ready to send to any provider. */
  systemPrompt: string;
  /** Trimmed history entries (at most MAX_HISTORY_MESSAGES). */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** The user message to append as the final human turn. */
  userMessage: string;
}

@Injectable()
export class PromptTemplateService {
  /**
   * Assembles all prompt components from an AiGenerateRequest into canonical,
   * provider-ready sections. The same inputs always produce the same output.
   */
  assemble(
    request: AiGenerateRequest,
    customSystemPrompt?: string,
  ): AssembledPrompt {
    const systemPrompt = this.buildSystemPrompt(request, customSystemPrompt);
    const history = this.truncateHistory(request.history);
    const userMessage = this.buildUserMessage(request);

    return { systemPrompt, history, userMessage };
  }

  private buildSystemPrompt(
    request: AiGenerateRequest,
    customSystemPrompt?: string,
  ): string {
    const parts: string[] = [];

    // 1. Base or custom system instructions
    parts.push(customSystemPrompt ?? BASE_SYSTEM_PROMPT);

    // 2. Optional preset instruction block
    if (request.presetActionKey) {
      const preset = PRESET_INSTRUCTIONS[request.presetActionKey];
      if (preset) {
        parts.push(preset);
      }
    }

    // 3. Note context summary
    const noteContext = this.buildNoteContext(request);
    if (noteContext) {
      parts.push(noteContext);
    }

    // 4. Structured-output instruction block — omitted for advice-only presets
    const wantsStructured =
      request.expectedOutput === 'BODY_PROPOSAL_OR_ADVICE' &&
      !(
        request.presetActionKey &&
        ADVICE_ONLY_PRESETS.has(request.presetActionKey)
      );

    if (wantsStructured) {
      parts.push(STRUCTURED_OUTPUT_INSTRUCTION);
    }

    return parts.join('\n\n---\n\n');
  }

  private buildNoteContext(request: AiGenerateRequest): string {
    const lines: string[] = ['Note context:'];

    if (request.title) {
      lines.push(`Title: ${request.title}`);
    }
    if (request.tags.length > 0) {
      lines.push(`Tags: ${request.tags.join(', ')}`);
    }
    if (request.variablePrefix && request.variableSuffix) {
      lines.push(
        `Variable delimiters: ${request.variablePrefix} ... ${request.variableSuffix}`,
      );
    }
    if (request.body) {
      lines.push(`Note body:\n${request.body}`);
    }

    return lines.length > 1 ? lines.join('\n') : '';
  }

  private buildUserMessage(request: AiGenerateRequest): string {
    return request.userMessage;
  }

  /**
   * Keeps only the most recent MAX_HISTORY_MESSAGES entries.
   * Preserves order (oldest-first within the window).
   */
  truncateHistory(
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    if (history.length <= MAX_HISTORY_MESSAGES) {
      return [...history];
    }
    return history.slice(history.length - MAX_HISTORY_MESSAGES);
  }
}
