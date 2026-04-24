import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProviderKey } from './enums/ai-provider-key.enum';
import { AiTargetType } from './enums/ai-target-type.enum';
import { AiSession } from './entities/ai-session.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiProposal } from './entities/ai-proposal.entity';
import { ProviderCapabilitiesService } from './services/provider-capabilities.service';
import { PromptRunnerService } from './services/prompt-runner.service';
import { SendAiMessageDto } from './dto/send-ai-message.dto';
import { RunAiActionDto } from './dto/run-ai-action.dto';
import { AiSessionResponse, AiCapabilitiesSummary } from './interfaces/ai-session-response.interface';
import { AiInteractionResponse } from './interfaces/ai-interaction-response.interface';
import { AiProviderStatusResponse } from './interfaces/ai-provider-status-response.interface';
import { AiProposalMutationResponse } from './interfaces/ai-proposal-mutation-response.interface';
import { PRESET_INSTRUCTIONS } from './prompts/prompt.constants';
import { Note } from '../note/note.entity';
import { ProposalApplicationService } from './services/proposal-application.service';

const SUPPORTED_TARGET_TYPES = new Set<string>(Object.values(AiTargetType));
const SUPPORTED_ACTION_KEYS = new Set(Object.keys(PRESET_INSTRUCTIONS));

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(AiSession)
    private readonly sessionRepo: Repository<AiSession>,
    @InjectRepository(AiMessage)
    private readonly messageRepo: Repository<AiMessage>,
    @InjectRepository(AiProposal)
    private readonly proposalRepo: Repository<AiProposal>,
    @InjectRepository(Note)
    private readonly noteRepo: Repository<Note>,
    private readonly capabilities: ProviderCapabilitiesService,
    private readonly promptRunner: PromptRunnerService,
    private readonly proposalApplicationService: ProposalApplicationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Provider status
  // ---------------------------------------------------------------------------

  getProviderStatus(): AiProviderStatusResponse {
    const allCapabilities = this.capabilities.getAllCapabilities();
    const providers = Object.entries(allCapabilities).map(([key, cap]) => ({
      providerKey: key as AiProviderKey,
      available: cap.available,
      transport: cap.transport,
      supportsChat: cap.supportsChat,
      supportsPresetActions: cap.supportsPresetActions,
      supportsStructuredProposal: cap.supportsStructuredProposal,
      supportsStreaming: cap.supportsStreaming,
      supportedModels: [] as string[],
      unavailableReason: cap.unavailableReason,
    }));
    return {
      providers,
      defaultProviderKey: this.capabilities.defaultProviderKey ?? undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Session load
  // ---------------------------------------------------------------------------

  async getSession(targetType: string, targetId: number): Promise<AiSessionResponse> {
    this.validateTargetType(targetType);
    await this.requireNote(targetId);

    const session = await this.sessionRepo.findOne({
      where: { targetType, targetId },
      relations: ['messages', 'proposals'],
      order: { messages: { createdAt: 'ASC' }, proposals: { createdAt: 'ASC' } } as any,
    });

    if (!session) {
      throw new NotFoundException(`No AI session found for ${targetType}:${targetId}`);
    }

    const providerKey = session.providerKey as AiProviderKey;
    const cap = this.capabilities.getCapabilities(providerKey);
    const capabilitiesSummary = this.buildCapabilitiesSummary(providerKey, cap);

    return {
      session: this.mapSession(session),
      messages: session.messages.map(this.mapMessage),
      proposals: session.proposals.map(this.mapProposal),
      capabilitiesSummary,
    };
  }

  // ---------------------------------------------------------------------------
  // Session clear
  // ---------------------------------------------------------------------------

  async clearSession(targetType: string, targetId: number): Promise<void> {
    this.validateTargetType(targetType);
    await this.requireNote(targetId);

    const session = await this.sessionRepo.findOne({
      where: { targetType, targetId },
    });
    if (!session) return; // idempotent — nothing to clear

    session.clearedAt = new Date();
    await this.sessionRepo.save(session);
  }

  // ---------------------------------------------------------------------------
  // Send chat message
  // ---------------------------------------------------------------------------

  async sendMessage(
    targetType: string,
    targetId: number,
    dto: SendAiMessageDto,
  ): Promise<AiInteractionResponse> {
    this.validateTargetType(targetType);
    const note = await this.requireNote(targetId);

    const { session, providerKey } = await this.getOrCreateSession(
      targetType,
      targetId,
      note,
      dto.providerKey,
      dto.model,
    );

    const history = await this.buildHistory(session.id);

    let result;
    try {
      result = await this.promptRunner.run(
        {
          targetType: targetType as AiTargetType,
          targetId,
          title: note.title,
          body: note.body,
          tags: note.tags ? note.tags.map((t) => t.tag) : [],
          variablePrefix: note.variablePrefix,
          variableSuffix: note.variableSuffix,
          history,
          userMessage: dto.message,
          presetActionKey: null,
          expectedOutput: dto.expectedOutput ?? 'BODY_PROPOSAL_OR_ADVICE',
        },
        dto.providerKey,
        note.aiPrompt ?? undefined,
      );
    } catch (err: unknown) {
      this.handleProviderError(err, providerKey);
    }

    // Persist user message
    await this.messageRepo.save(
      this.messageRepo.create({ sessionId: session.id, role: 'USER', content: dto.message, presetActionKey: null }),
    );

    // Persist assistant message
    const assistantMsg = await this.messageRepo.save(
      this.messageRepo.create({ sessionId: session.id, role: 'ASSISTANT', content: result!.assistantMessage, presetActionKey: null }),
    );

    // Persist proposal if present
    let savedProposal: AiProposal | null = null;
    if (result!.proposal) {
      savedProposal = await this.proposalRepo.save(
        this.proposalRepo.create({
          sessionId: session.id,
          targetType,
          targetId,
          proposalType: result!.proposal.proposalType,
          fieldName: 'body',
          currentValue: note.body ?? '',
          proposedValue: result!.proposal.proposedBody,
          rationale: result!.proposal.rationale,
          status: 'PENDING',
          confidence: result!.proposal.confidence,
        }),
      );
    }

    const cap = this.capabilities.getCapabilities(providerKey);
    return this.buildInteractionResponse(session, result!, savedProposal, cap, providerKey);
  }

  // ---------------------------------------------------------------------------
  // Run preset action
  // ---------------------------------------------------------------------------

  async runAction(
    targetType: string,
    targetId: number,
    actionKey: string,
    dto: RunAiActionDto,
  ): Promise<AiInteractionResponse> {
    this.validateTargetType(targetType);
    if (!SUPPORTED_ACTION_KEYS.has(actionKey)) {
      throw new BadRequestException(`Unsupported action key: '${actionKey}'`);
    }
    const note = await this.requireNote(targetId);

    const { session, providerKey } = await this.getOrCreateSession(
      targetType,
      targetId,
      note,
      dto.providerKey,
      dto.model,
    );

    const history = await this.buildHistory(session.id);

    let result;
    try {
      result = await this.promptRunner.run(
        {
          targetType: targetType as AiTargetType,
          targetId,
          title: note.title,
          body: note.body,
          tags: note.tags ? note.tags.map((t) => t.tag) : [],
          variablePrefix: note.variablePrefix,
          variableSuffix: note.variableSuffix,
          history,
          userMessage: dto.userInstruction ?? '',
          presetActionKey: actionKey,
          expectedOutput: dto.expectedOutput ?? 'BODY_PROPOSAL_OR_ADVICE',
        },
        dto.providerKey,
        note.aiPrompt ?? undefined,
      );
    } catch (err: unknown) {
      this.handleProviderError(err, providerKey);
    }

    // Persist user message (the action trigger)
    await this.messageRepo.save(
      this.messageRepo.create({
        sessionId: session.id,
        role: 'USER',
        content: dto.userInstruction ?? `[preset action: ${actionKey}]`,
        presetActionKey: actionKey,
      }),
    );

    // Persist assistant message
    await this.messageRepo.save(
      this.messageRepo.create({ sessionId: session.id, role: 'ASSISTANT', content: result!.assistantMessage, presetActionKey: actionKey }),
    );

    // Persist proposal if present
    let savedProposal: AiProposal | null = null;
    if (result!.proposal) {
      savedProposal = await this.proposalRepo.save(
        this.proposalRepo.create({
          sessionId: session.id,
          targetType,
          targetId,
          proposalType: result!.proposal.proposalType,
          fieldName: 'body',
          currentValue: note.body ?? '',
          proposedValue: result!.proposal.proposedBody,
          rationale: result!.proposal.rationale,
          status: 'PENDING',
          confidence: result!.proposal.confidence,
        }),
      );
    }

    const cap = this.capabilities.getCapabilities(providerKey);
    return this.buildInteractionResponse(session, result!, savedProposal, cap, providerKey);
  }

  // ---------------------------------------------------------------------------
  // Proposal apply / revert (delegated to ProposalApplicationService)
  // ---------------------------------------------------------------------------

  applyProposal(proposalId: number): Promise<AiProposalMutationResponse> {
    return this.proposalApplicationService.applyProposal(proposalId);
  }

  revertProposal(proposalId: number): Promise<AiProposalMutationResponse> {
    return this.proposalApplicationService.revertProposal(proposalId);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private validateTargetType(targetType: string): void {
    if (!SUPPORTED_TARGET_TYPES.has(targetType)) {
      throw new BadRequestException(`Unsupported target type: '${targetType}'. Supported: ${[...SUPPORTED_TARGET_TYPES].join(', ')}`);
    }
  }

  private async requireNote(noteId: number): Promise<Note & { tags: import('../note/note-tag.entity').NoteTag[] }> {
    const note = await this.noteRepo.findOne({
      where: { id: noteId },
      relations: ['tags'],
    });
    if (!note) throw new NotFoundException(`Note ${noteId} not found`);
    return note as Note & { tags: import('../note/note-tag.entity').NoteTag[] };
  }

  private async getOrCreateSession(
    targetType: string,
    targetId: number,
    note: Note,
    providerKeyOverride?: AiProviderKey,
    modelOverride?: string,
  ): Promise<{ session: AiSession; providerKey: AiProviderKey }> {
    const providerKey: AiProviderKey =
      providerKeyOverride ??
      (note.aiProviderKey as AiProviderKey | null) ??
      this.capabilities.defaultProviderKey ??
      AiProviderKey.ANTHROPIC_API;

    let session = await this.sessionRepo.findOne({ where: { targetType, targetId } });
    if (!session) {
      session = await this.sessionRepo.save(
        this.sessionRepo.create({
          targetType,
          targetId,
          providerKey,
          model: modelOverride ?? note.aiModel ?? null,
          systemPromptSnapshot: note.aiPrompt ?? null,
        }),
      );
    }
    return { session, providerKey };
  }

  private async buildHistory(sessionId: number): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const messages = await this.messageRepo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
    return messages
      .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
      .map((m) => ({ role: m.role === 'USER' ? 'user' : 'assistant', content: m.content }));
  }

  private handleProviderError(err: unknown, providerKey: AiProviderKey): never {
    const msg = err instanceof Error ? err.message : String(err);
    if (/timeout/i.test(msg)) throw new GatewayTimeoutException(`Provider '${providerKey}' timed out`);
    if (/not available|unavailable/i.test(msg)) throw new ServiceUnavailableException(msg);
    throw new ServiceUnavailableException(`Provider '${providerKey}' error: ${msg}`);
  }

  private buildCapabilitiesSummary(providerKey: AiProviderKey, cap: import('./interfaces/ai-provider.interface').AiProviderCapabilities): AiCapabilitiesSummary {
    return {
      providerKey,
      available: cap.available,
      transport: cap.transport,
      supportsChat: cap.supportsChat,
      supportsPresetActions: cap.supportsPresetActions,
      supportsStructuredProposal: cap.supportsStructuredProposal,
      supportsStreaming: cap.supportsStreaming,
      unavailableReason: cap.unavailableReason,
    };
  }

  private buildInteractionResponse(
    session: AiSession,
    result: import('./interfaces/ai-generate-result.interface').AiGenerateResult,
    savedProposal: AiProposal | null,
    cap: import('./interfaces/ai-provider.interface').AiProviderCapabilities,
    providerKey: AiProviderKey,
  ): AiInteractionResponse {
    return {
      session: this.mapSession(session),
      assistantMessage: result.assistantMessage,
      proposal: savedProposal
        ? {
            id: savedProposal.id,
            proposalType: savedProposal.proposalType,
            fieldName: savedProposal.fieldName,
            currentValue: savedProposal.currentValue,
            proposedValue: savedProposal.proposedValue,
            rationale: savedProposal.rationale,
            confidence: savedProposal.confidence,
            status: savedProposal.status,
          }
        : null,
      finishReason: 'STOP',
      capabilitiesSummary: this.buildCapabilitiesSummary(providerKey, cap),
    };
  }

  private mapSession(session: AiSession) {
    return {
      id: session.id,
      targetType: session.targetType,
      targetId: session.targetId,
      providerKey: session.providerKey,
      model: session.model,
      createdAt: session.createdAt?.toISOString(),
      updatedAt: session.updatedAt?.toISOString() ?? null,
      clearedAt: session.clearedAt?.toISOString() ?? null,
    };
  }

  private mapMessage(message: AiMessage) {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      presetActionKey: message.presetActionKey,
      createdAt: message.createdAt?.toISOString(),
    };
  }

  private mapProposal(proposal: AiProposal) {
    return {
      id: proposal.id,
      status: proposal.status,
      proposalType: proposal.proposalType,
      fieldName: proposal.fieldName,
      rationale: proposal.rationale,
      confidence: proposal.confidence,
      createdAt: proposal.createdAt?.toISOString(),
      appliedAt: proposal.appliedAt?.toISOString() ?? null,
      revertedAt: proposal.revertedAt?.toISOString() ?? null,
    };
  }
}
