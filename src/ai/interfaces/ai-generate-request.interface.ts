import { AiTargetType } from '../enums/ai-target-type.enum';

export interface AiGenerateRequest {
  targetType: AiTargetType;
  targetId: number;
  title: string;
  body: string | null;
  tags: string[];
  variablePrefix: string | null;
  variableSuffix: string | null;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
  presetActionKey: string | null;
  expectedOutput: string | null;
}
