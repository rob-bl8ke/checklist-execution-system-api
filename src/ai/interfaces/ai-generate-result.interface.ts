export interface AiBodyProposal {
  proposalType: 'REPLACE_BODY';
  proposedBody: string;
  rationale: string;
  confidence: number;
}

export interface AiGenerateResult {
  assistantMessage: string;
  proposal?: AiBodyProposal;
  rawMetadata: Record<string, unknown>;
}
