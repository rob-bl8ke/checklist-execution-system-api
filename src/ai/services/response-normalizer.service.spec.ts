import { ResponseNormalizerService } from './response-normalizer.service';

const meta = {};

describe('ResponseNormalizerService', () => {
  let service: ResponseNormalizerService;

  beforeEach(() => {
    service = new ResponseNormalizerService();
  });

  describe('valid JSON body_proposal', () => {
    it('returns proposal and assistantMessage', () => {
      const raw = JSON.stringify({
        mode: 'body_proposal',
        assistantMessage: 'Here is an improved note.',
        proposal: {
          proposedBody: '# Better Note\nImproved content.',
          rationale: 'Clearer structure.',
          confidence: 0.9,
        },
      });

      const result = service.normalize(raw, 'BODY_PROPOSAL_OR_ADVICE', meta);

      expect(result.assistantMessage).toBe('Here is an improved note.');
      expect(result.proposal).toBeDefined();
      expect(result.proposal!.proposedBody).toBe('# Better Note\nImproved content.');
      expect(result.proposal!.rationale).toBe('Clearer structure.');
      expect(result.proposal!.confidence).toBe(0.9);
      expect(result.proposal!.proposalType).toBe('REPLACE_BODY');
    });

    it('clamps confidence above 1 to 1', () => {
      const raw = JSON.stringify({
        mode: 'body_proposal',
        assistantMessage: 'ok',
        proposal: { proposedBody: 'body text', rationale: '', confidence: 1.5 },
      });
      const result = service.normalize(raw, 'BODY_PROPOSAL_OR_ADVICE', meta);
      expect(result.proposal!.confidence).toBe(1);
    });

    it('clamps negative confidence to 0', () => {
      const raw = JSON.stringify({
        mode: 'body_proposal',
        assistantMessage: 'ok',
        proposal: { proposedBody: 'body text', rationale: '', confidence: -0.2 },
      });
      const result = service.normalize(raw, 'BODY_PROPOSAL_OR_ADVICE', meta);
      expect(result.proposal!.confidence).toBe(0);
    });

    it('defaults confidence to 0 when not provided', () => {
      const raw = JSON.stringify({
        mode: 'body_proposal',
        assistantMessage: 'ok',
        proposal: { proposedBody: 'body text', rationale: '' },
      });
      const result = service.normalize(raw, 'BODY_PROPOSAL_OR_ADVICE', meta);
      expect(result.proposal!.confidence).toBe(0);
    });
  });

  describe('valid JSON advice_only', () => {
    it('returns advice with no proposal', () => {
      const raw = JSON.stringify({
        mode: 'advice_only',
        assistantMessage: 'Consider breaking this into sections.',
        proposal: null,
      });
      const result = service.normalize(raw, 'BODY_PROPOSAL_OR_ADVICE', meta);
      expect(result.assistantMessage).toBe('Consider breaking this into sections.');
      expect(result.proposal).toBeUndefined();
    });
  });

  describe('fenced JSON recovery pass', () => {
    it('extracts JSON from ```json fences and parses proposal', () => {
      const inner = JSON.stringify({
        mode: 'body_proposal',
        assistantMessage: 'Fence-wrapped proposal.',
        proposal: { proposedBody: 'Improved body.', rationale: 'better', confidence: 0.75 },
      });
      const raw = `Here is the result:\n\`\`\`json\n${inner}\n\`\`\``;

      const result = service.normalize(raw, 'BODY_PROPOSAL_OR_ADVICE', meta);

      expect(result.assistantMessage).toBe('Fence-wrapped proposal.');
      expect(result.proposal).toBeDefined();
      expect(result.proposal!.proposedBody).toBe('Improved body.');
    });

    it('extracts JSON from plain ``` fences', () => {
      const inner = JSON.stringify({
        mode: 'advice_only',
        assistantMessage: 'No fenced advice.',
        proposal: null,
      });
      const raw = `\`\`\`\n${inner}\n\`\`\``;

      const result = service.normalize(raw, 'BODY_PROPOSAL_OR_ADVICE', meta);
      expect(result.assistantMessage).toBe('No fenced advice.');
    });
  });

  describe('unparseable JSON — advice-only downgrade', () => {
    it('uses raw text as assistantMessage when JSON cannot be parsed', () => {
      const raw = 'This is just plain text advice from the model.';
      const result = service.normalize(raw, 'BODY_PROPOSAL_OR_ADVICE', meta);
      expect(result.assistantMessage).toBe(raw);
      expect(result.proposal).toBeUndefined();
    });

    it('uses raw text when JSON is broken after fences', () => {
      const raw = '```json\nnot valid json at all\n```';
      const result = service.normalize(raw, 'BODY_PROPOSAL_OR_ADVICE', meta);
      expect(result.proposal).toBeUndefined();
    });
  });

  describe('empty proposedBody — proposal rejected', () => {
    it('discards proposal when proposedBody is empty string', () => {
      const raw = JSON.stringify({
        mode: 'body_proposal',
        assistantMessage: 'I tried.',
        proposal: { proposedBody: '', rationale: 'x', confidence: 0.8 },
      });
      const result = service.normalize(raw, 'BODY_PROPOSAL_OR_ADVICE', meta);
      expect(result.proposal).toBeUndefined();
      expect(result.assistantMessage).toBe('I tried.');
    });

    it('discards proposal when proposedBody is whitespace-only', () => {
      const raw = JSON.stringify({
        mode: 'body_proposal',
        assistantMessage: 'I tried.',
        proposal: { proposedBody: '   ', rationale: 'x', confidence: 0.8 },
      });
      const result = service.normalize(raw, 'BODY_PROPOSAL_OR_ADVICE', meta);
      expect(result.proposal).toBeUndefined();
    });
  });

  describe('ADVICE_ONLY expectedOutput', () => {
    it('never creates a proposal even when model returns body_proposal JSON', () => {
      const raw = JSON.stringify({
        mode: 'body_proposal',
        assistantMessage: 'Here is an improved note.',
        proposal: { proposedBody: 'New body.', rationale: 'Better.', confidence: 0.9 },
      });
      const result = service.normalize(raw, 'ADVICE_ONLY', meta);
      expect(result.proposal).toBeUndefined();
      expect(result.assistantMessage).toBe('Here is an improved note.');
    });

    it('never creates a proposal when expectedOutput is null', () => {
      const raw = JSON.stringify({
        mode: 'body_proposal',
        assistantMessage: 'ok',
        proposal: { proposedBody: 'body', rationale: '', confidence: 0.5 },
      });
      const result = service.normalize(raw, null, meta);
      expect(result.proposal).toBeUndefined();
    });
  });

  describe('rawMetadata passthrough', () => {
    it('includes provided rawMetadata in the result', () => {
      const raw = JSON.stringify({
        mode: 'advice_only',
        assistantMessage: 'ok',
        proposal: null,
      });
      const metaIn = { model: 'claude-3-5-haiku', tokens: 120 };
      const result = service.normalize(raw, 'ADVICE_ONLY', metaIn);
      expect(result.rawMetadata).toEqual(metaIn);
    });

    it('defaults rawMetadata to empty object when omitted', () => {
      const raw = 'plain text';
      const result = service.normalize(raw, 'ADVICE_ONLY');
      expect(result.rawMetadata).toEqual({});
    });
  });
});
