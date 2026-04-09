import { parseStructuredResponse, MAX_BODY_SIZE } from './parse-structured-response';

describe('parseStructuredResponse', () => {
  it('returns advice-only for plain text (not JSON)', () => {
    const result = parseStructuredResponse('Just some advice text.');
    expect(result.assistantMessage).toBe('Just some advice text.');
    expect(result.proposal).toBeUndefined();
  });

  it('parses advice_only mode correctly', () => {
    const raw = JSON.stringify({
      mode: 'advice_only',
      assistantMessage: 'Consider adding headings.',
      proposal: null,
    });
    const result = parseStructuredResponse(raw);
    expect(result.assistantMessage).toBe('Consider adding headings.');
    expect(result.proposal).toBeUndefined();
  });

  it('parses body_proposal mode correctly', () => {
    const raw = JSON.stringify({
      mode: 'body_proposal',
      assistantMessage: 'Here is an improved version.',
      proposal: {
        proposedBody: '# Improved Note\nContent here.',
        rationale: 'Better structure.',
        confidence: 0.9,
      },
    });
    const result = parseStructuredResponse(raw);
    expect(result.assistantMessage).toBe('Here is an improved version.');
    expect(result.proposal).toBeDefined();
    expect(result.proposal!.proposalType).toBe('REPLACE_BODY');
    expect(result.proposal!.proposedBody).toBe('# Improved Note\nContent here.');
    expect(result.proposal!.rationale).toBe('Better structure.');
    expect(result.proposal!.confidence).toBe(0.9);
  });

  it('clamps confidence to 0..1 range', () => {
    const raw = JSON.stringify({
      mode: 'body_proposal',
      assistantMessage: 'Improved.',
      proposal: { proposedBody: 'new body', rationale: '', confidence: 1.5 },
    });
    const result = parseStructuredResponse(raw);
    expect(result.proposal!.confidence).toBe(1);
  });

  it('extracts JSON from markdown fences', () => {
    const inner = JSON.stringify({
      mode: 'advice_only',
      assistantMessage: 'Fenced advice.',
      proposal: null,
    });
    const raw = `\`\`\`json\n${inner}\n\`\`\``;
    const result = parseStructuredResponse(raw);
    expect(result.assistantMessage).toBe('Fenced advice.');
  });

  it('ignores proposal when proposedBody is empty', () => {
    const raw = JSON.stringify({
      mode: 'body_proposal',
      assistantMessage: 'Nothing useful.',
      proposal: { proposedBody: '   ', rationale: '', confidence: 0.5 },
    });
    const result = parseStructuredResponse(raw);
    expect(result.proposal).toBeUndefined();
  });

  it('falls back to raw text as assistantMessage when assistantMessage is missing', () => {
    const raw = JSON.stringify({ mode: 'advice_only', proposal: null });
    const result = parseStructuredResponse(raw);
    expect(result.assistantMessage).toBe(raw);
  });
});

describe('MAX_BODY_SIZE', () => {
  it('equals 50 KB', () => {
    expect(MAX_BODY_SIZE).toBe(50 * 1024);
  });
});
