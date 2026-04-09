import { AiBodyProposal } from '../interfaces/ai-generate-result.interface';

export interface ParsedProviderResponse {
  assistantMessage: string;
  proposal?: AiBodyProposal;
}

/** Maximum note body size injected into prompts (50 KB). */
export const MAX_BODY_SIZE = 50 * 1024;

/**
 * Attempts to parse the raw model output as the canonical structured JSON shape.
 *
 * Expected format:
 * {
 *   "mode": "advice_only" | "body_proposal",
 *   "assistantMessage": string,
 *   "proposal": { "proposedBody": string, "rationale": string, "confidence": number | null } | null
 * }
 *
 * Falls back to advice-only using the raw text as the assistant message when:
 *  - The text is not valid JSON
 *  - After one attempt to strip markdown fences
 *  - The proposal body is empty after trimming
 */
export function parseStructuredResponse(raw: string): ParsedProviderResponse {
  const json = tryParseJson(raw) ?? tryExtractFencedJson(raw);

  if (!json) {
    return { assistantMessage: raw };
  }

  const msg =
    typeof json.assistantMessage === 'string' && json.assistantMessage.trim()
      ? json.assistantMessage
      : raw;

  if (
    json.mode === 'body_proposal' &&
    json.proposal?.proposedBody?.trim()
  ) {
    const confidence =
      typeof json.proposal.confidence === 'number'
        ? Math.min(1, Math.max(0, json.proposal.confidence))
        : 0;

    return {
      assistantMessage: msg,
      proposal: {
        proposalType: 'REPLACE_BODY',
        proposedBody: json.proposal.proposedBody.trim(),
        rationale: json.proposal.rationale ?? '',
        confidence,
      },
    };
  }

  return { assistantMessage: msg };
}

function tryParseJson(text: string): Record<string, unknown> | null {
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

function tryExtractFencedJson(text: string): Record<string, unknown> | null {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    return tryParseJson(fenceMatch[1]);
  }
  // Also try to find a bare JSON object if no fences
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    return tryParseJson(braceMatch[0]);
  }
  return null;
}
