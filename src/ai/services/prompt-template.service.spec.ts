import { PromptTemplateService } from './prompt-template.service';
import {
  BASE_SYSTEM_PROMPT,
  PRESET_INSTRUCTIONS,
  STRUCTURED_OUTPUT_INSTRUCTION,
  ADVICE_ONLY_PRESETS,
  MAX_HISTORY_MESSAGES,
} from '../prompts/prompt.constants';
import { AiTargetType } from '../enums/ai-target-type.enum';
import { AiGenerateRequest } from '../interfaces/ai-generate-request.interface';

function makeRequest(
  overrides: Partial<AiGenerateRequest> = {},
): AiGenerateRequest {
  return {
    targetType: AiTargetType.NOTE,
    targetId: 1,
    title: 'Test Note',
    body: '# Test\nContent here.',
    tags: ['alpha', 'beta'],
    variablePrefix: null,
    variableSuffix: null,
    history: [],
    userMessage: 'Improve this note.',
    presetActionKey: null,
    expectedOutput: 'BODY_PROPOSAL_OR_ADVICE',
    ...overrides,
  };
}

describe('PromptTemplateService', () => {
  let service: PromptTemplateService;

  beforeEach(() => {
    service = new PromptTemplateService();
  });

  describe('assemble — system prompt', () => {
    it('includes the base system prompt', () => {
      const { systemPrompt } = service.assemble(makeRequest());
      expect(systemPrompt).toContain(
        'You are the Notes Assistant for the Checklist Execution System',
      );
    });

    it('uses a custom system prompt when provided', () => {
      const { systemPrompt } = service.assemble(
        makeRequest(),
        'Custom instructions only.',
      );
      expect(systemPrompt).toContain('Custom instructions only.');
      expect(systemPrompt).not.toContain('Notes Assistant');
    });

    it('appends structured-output instruction for BODY_PROPOSAL_OR_ADVICE', () => {
      const { systemPrompt } = service.assemble(makeRequest());
      expect(systemPrompt).toContain('Return exactly one JSON object');
    });

    it('omits structured-output instruction for ADVICE_ONLY', () => {
      const { systemPrompt } = service.assemble(
        makeRequest({ expectedOutput: 'ADVICE_ONLY' }),
      );
      expect(systemPrompt).not.toContain('Return exactly one JSON object');
    });

    it('includes preset instruction for known preset keys', () => {
      const { systemPrompt } = service.assemble(
        makeRequest({ presetActionKey: 'improve-note' }),
      );
      expect(systemPrompt).toContain(PRESET_INSTRUCTIONS['improve-note']);
    });

    it('includes note context with title and tags', () => {
      const { systemPrompt } = service.assemble(makeRequest());
      expect(systemPrompt).toContain('Test Note');
      expect(systemPrompt).toContain('alpha');
      expect(systemPrompt).toContain('beta');
    });

    it('includes note body in context', () => {
      const { systemPrompt } = service.assemble(makeRequest());
      expect(systemPrompt).toContain('# Test\nContent here.');
    });

    it('includes variable delimiters when set', () => {
      const { systemPrompt } = service.assemble(
        makeRequest({ variablePrefix: '@{', variableSuffix: '}' }),
      );
      expect(systemPrompt).toContain('@{');
      expect(systemPrompt).toContain('}');
    });
  });

  describe('suggest-tags preset — advice-only enforcement', () => {
    it('never appends structured-output instruction for suggest-tags', () => {
      const { systemPrompt } = service.assemble(
        makeRequest({
          presetActionKey: 'suggest-tags',
          expectedOutput: 'BODY_PROPOSAL_OR_ADVICE',
        }),
      );
      expect(systemPrompt).not.toContain('Return exactly one JSON object');
    });

    it('suggest-tags is in the ADVICE_ONLY_PRESETS set', () => {
      expect(ADVICE_ONLY_PRESETS.has('suggest-tags')).toBe(true);
    });
  });

  describe('history truncation', () => {
    it('passes through history shorter than the limit unchanged', () => {
      const history = [
        { role: 'user' as const, content: 'first' },
        { role: 'assistant' as const, content: 'reply' },
      ];
      const result = service.truncateHistory(history);
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('first');
    });

    it(`truncates to the most recent ${MAX_HISTORY_MESSAGES} messages`, () => {
      const history = Array.from({ length: MAX_HISTORY_MESSAGES + 5 }, (_, i) => ({
        role: 'user' as const,
        content: `message-${i}`,
      }));
      const result = service.truncateHistory(history);
      expect(result).toHaveLength(MAX_HISTORY_MESSAGES);
      const lastExpectedContent = `message-${MAX_HISTORY_MESSAGES + 4}`;
      expect(result[result.length - 1].content).toBe(lastExpectedContent);
    });

    it('is deterministic — same input produces identical output', () => {
      const history = [
        { role: 'user' as const, content: 'msg1' },
        { role: 'assistant' as const, content: 'resp1' },
      ];
      const r1 = service.truncateHistory(history);
      const r2 = service.truncateHistory(history);
      expect(r1).toEqual(r2);
    });
  });

  describe('assemble — determinism', () => {
    it('produces identical output for identical inputs', () => {
      const req = makeRequest({ presetActionKey: 'review-code' });
      const r1 = service.assemble(req);
      const r2 = service.assemble(req);
      expect(r1.systemPrompt).toBe(r2.systemPrompt);
      expect(r1.userMessage).toBe(r2.userMessage);
    });
  });

  describe('assemble — user message passthrough', () => {
    it('passes userMessage through unchanged', () => {
      const { userMessage } = service.assemble(
        makeRequest({ userMessage: 'Please clarify section 2.' }),
      );
      expect(userMessage).toBe('Please clarify section 2.');
    });
  });

  describe('canonical prompt constants', () => {
    it('BASE_SYSTEM_PROMPT contains all required lines', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('Notes Assistant');
      expect(BASE_SYSTEM_PROMPT).toContain('note body only');
      expect(BASE_SYSTEM_PROMPT).toContain('confidence is low, prefer advice-only');
      expect(BASE_SYSTEM_PROMPT).toContain('JSON only with no markdown fences');
    });

    it('STRUCTURED_OUTPUT_INSTRUCTION contains all required lines', () => {
      expect(STRUCTURED_OUTPUT_INSTRUCTION).toContain('advice_only');
      expect(STRUCTURED_OUTPUT_INSTRUCTION).toContain('body_proposal');
      expect(STRUCTURED_OUTPUT_INSTRUCTION).toContain('proposedBody');
      expect(STRUCTURED_OUTPUT_INSTRUCTION).toContain('only mutable field is the note body');
    });

    it.each(['improve-note', 'review-code', 'fix-markdown', 'suggest-tags'])(
      'PRESET_INSTRUCTIONS has entry for %s',
      (key) => {
        expect(PRESET_INSTRUCTIONS[key]).toBeTruthy();
      },
    );
  });
});
