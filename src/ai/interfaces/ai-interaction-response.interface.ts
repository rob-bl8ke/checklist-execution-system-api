import { AiCapabilitiesSummary, AiSessionData } from './ai-session-response.interface';

export interface AiInteractionProposal {
  id?: number;
  proposalType: string;
  fieldName: string;
  currentValue: string;
  proposedValue: string;
  rationale: string | null;
  confidence: number | null;
  status: 'PENDING' | 'APPLIED' | 'REJECTED' | 'REVERTED';
}

export interface AiInteractionResponse {
  session: AiSessionData;
  assistantMessage: string;
  proposal: AiInteractionProposal | null;
  finishReason: 'STOP' | 'LENGTH' | 'ERROR' | 'UNSUPPORTED';
  capabilitiesSummary: AiCapabilitiesSummary;
}
