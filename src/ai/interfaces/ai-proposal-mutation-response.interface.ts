export interface AiProposalMutationResult {
  id: number;
  status: 'PENDING' | 'APPLIED' | 'REJECTED' | 'REVERTED';
  appliedAt: string | null;
  revertedAt: string | null;
}

export interface AiNoteVersionSnapshot {
  id: number;
  versionNumber: number;
  createdAt: string;
}

export interface AiProposalMutationResponse {
  proposal: AiProposalMutationResult;
  target: { targetType: 'NOTE'; targetId: number };
  noteVersion?: AiNoteVersionSnapshot;
}
