import { AiTargetType } from '../enums/ai-target-type.enum';
import { AiGenerateRequest } from '../interfaces/ai-generate-request.interface';

export const mockRequest = (
  overrides: Partial<AiGenerateRequest> = {},
): AiGenerateRequest => ({
  targetType: AiTargetType.NOTE,
  targetId: 1,
  title: 'Test Note',
  body: 'Some **markdown** content.',
  tags: ['test'],
  variablePrefix: null,
  variableSuffix: null,
  history: [],
  userMessage: 'Improve this note.',
  presetActionKey: null,
  expectedOutput: 'BODY_PROPOSAL_OR_ADVICE',
  systemPrompt: 'You are a helpful assistant.',
  ...overrides,
});
