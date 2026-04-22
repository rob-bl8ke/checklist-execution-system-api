import { Injectable } from '@nestjs/common';
import { AiGenerateResult, AiBodyProposal } from '../interfaces/ai-generate-result.interface';

interface RawProposalShape {
  proposedBody?: unknown;
  rationale?: unknown;
  confidence?: unknown;
}

interface RawResponseShape {
  mode?: unknown;
  assistantMessage?: unknown;
  proposal?: RawProposalShape | null;
}

/**
 * Normalizes raw provider output (API JSON or CLI text) into a stable
 * `AiGenerateResult` shape.
 *
 * Normalization steps:
 *  1. Parse raw text as JSON.
 *  2. On failure, attempt one recovery pass: strip markdown code fences
 *     and try again (some models wrap JSON in ```json...```).
 *  3. If still invalid, downgrade to advice-only using the raw text as
 *     the `assistantMessage`.
 *  4. Always validate:
 *     - `assistantMessage` is non-empty (fall back to raw text).
 *     - `proposedBody` is non-empty after trim (else discard proposal).
 *     - `confidence` is clamped to `0..1`.
 *  5. When `expectedOutput` is `'ADVICE_ONLY'`, no proposal is returned
 *     regardless of what the model produced.
 */
@Injectable()
export class ResponseNormalizerService {
  normalize(
    rawOutput: string,
    expectedOutput: 'ADVICE_ONLY' | 'BODY_PROPOSAL_OR_ADVICE' | null,
    rawMetadata: Record<string, unknown> = {},
  ): AiGenerateResult {
    const parsed = this.tryParseJson(rawOutput) ?? this.tryExtractFencedJson(rawOutput);

    if (!parsed) {
      // Unparseable — downgrade to advice-only using raw text
      return {
        assistantMessage: rawOutput || 'No response from provider.',
        rawMetadata,
      };
    }

    const typed = parsed as RawResponseShape;

    const assistantMessage =
      typeof typed.assistantMessage === 'string' && typed.assistantMessage.trim()
        ? typed.assistantMessage
        : rawOutput || 'No response from provider.';

    // For ADVICE_ONLY requests, never surface a proposal even if the model produced one
    if (expectedOutput !== 'BODY_PROPOSAL_OR_ADVICE') {
      return { assistantMessage, rawMetadata };
    }

    const proposal = this.extractProposal(typed, rawOutput);

    return {
      assistantMessage,
      ...(proposal ? { proposal } : {}),
      rawMetadata,
    };
  }

  private extractProposal(
    typed: RawResponseShape,
    rawOutput: string,
  ): AiBodyProposal | null {
    if (typed.mode !== 'body_proposal' || typed.proposal == null) {
      return null;
    }

    const raw = typed.proposal as RawProposalShape;

    if (typeof raw.proposedBody !== 'string' || !raw.proposedBody.trim()) {
      // Empty proposal body — discard and return advice-only
      return null;
    }

    const confidence =
      typeof raw.confidence === 'number'
        ? Math.min(1, Math.max(0, raw.confidence))
        : 0;

    return {
      proposalType: 'REPLACE_BODY',
      proposedBody: raw.proposedBody.trim(),
      rationale: typeof raw.rationale === 'string' ? raw.rationale : '',
      confidence,
    };
  }

  private tryParseJson(text: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(text.trim());
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  private tryExtractFencedJson(text: string): Record<string, unknown> | null {
    // One recovery pass: strip markdown code fences
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      return this.tryParseJson(fenceMatch[1]);
    }
    // Also try bare JSON object extraction
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      return this.tryParseJson(braceMatch[0]);
    }
    return null;
  }
}
