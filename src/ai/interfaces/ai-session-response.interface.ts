import { AiProviderKey } from '../enums/ai-provider-key.enum';

export interface AiCapabilitiesSummary {
  providerKey: AiProviderKey;
  available: boolean;
  transport: 'api' | 'cli';
  supportsChat: boolean;
  supportsPresetActions: boolean;
  supportsStructuredProposal: boolean;
  supportsStreaming: boolean;
  unavailableReason?: string;
}

export interface AiSessionData {
  id: number;
  targetType: string;
  targetId: number;
  providerKey: string;
  model: string | null;
  createdAt: string;
  updatedAt: string | null;
  clearedAt: string | null;
}

export interface AiMessageData {
  id: number;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  presetActionKey: string | null;
  createdAt: string;
}

export interface AiProposalData {
  id: number;
  status: 'PENDING' | 'APPLIED' | 'REJECTED' | 'REVERTED';
  proposalType: string;
  fieldName: string;
  currentValue: string;
  proposedValue: string;
  rationale: string | null;
  confidence: number | null;
  createdAt: string;
  appliedAt: string | null;
  revertedAt: string | null;
}

export interface AiSessionResponse {
  session: AiSessionData;
  messages: AiMessageData[];
  proposals: AiProposalData[];
  capabilitiesSummary: AiCapabilitiesSummary;
}
