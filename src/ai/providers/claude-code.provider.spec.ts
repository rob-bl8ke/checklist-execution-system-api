import { ClaudeCodeProvider } from './claude-code.provider';
import { ToolExecutorService } from '../services/tool-executor.service';
import { mockRequest } from './test-helpers';

describe('ClaudeCodeProvider', () => {
  let provider: ClaudeCodeProvider;
  let toolExecutor: jest.Mocked<ToolExecutorService>;

  beforeEach(() => {
    toolExecutor = { execute: jest.fn() } as jest.Mocked<ToolExecutorService>;
    provider = new ClaudeCodeProvider(toolExecutor);
  });

  describe('capabilities', () => {
    it('reports transport: cli', () => {
      expect(provider.capabilities.transport).toBe('cli');
    });

    it('reports supportsStructuredProposal: true (best-effort)', () => {
      expect(provider.capabilities.supportsStructuredProposal).toBe(true);
    });
  });

  describe('generate', () => {
    it('passes prompt via stdin and returns advice-only for plain text', async () => {
      toolExecutor.execute.mockResolvedValueOnce('CLI advice text.');

      const result = await provider.generate(
        mockRequest({ expectedOutput: 'ADVICE_ONLY' }),
      );

      expect(result.assistantMessage).toBe('CLI advice text.');
      expect(result.proposal).toBeUndefined();
      expect(toolExecutor.execute).toHaveBeenCalledWith(
        expect.any(String),
        ['--print'],
        expect.stringContaining('Improve this note.'),
        expect.objectContaining({ timeoutMs: 60_000 }),
      );
    });

    it('uses execFile via ToolExecutorService (not exec)', async () => {
      toolExecutor.execute.mockResolvedValueOnce('ok');
      await provider.generate(mockRequest());
      expect(toolExecutor.execute).toHaveBeenCalledTimes(1);
    });

    it('parses structured JSON output when returned', async () => {
      const structured = JSON.stringify({
        mode: 'body_proposal',
        assistantMessage: 'CLI improved.',
        proposal: {
          proposedBody: '# CLI body',
          rationale: 'Better.',
          confidence: 0.6,
        },
      });
      toolExecutor.execute.mockResolvedValueOnce(structured);

      const result = await provider.generate(mockRequest());
      expect(result.proposal!.proposedBody).toBe('# CLI body');
    });

    it('degrades to advice-only when structured JSON fails', async () => {
      toolExecutor.execute.mockResolvedValueOnce('not json output');

      const result = await provider.generate(mockRequest());
      expect(result.assistantMessage).toBe('not json output');
      expect(result.proposal).toBeUndefined();
    });

    it('includes system prompt section in flattened prompt', async () => {
      toolExecutor.execute.mockResolvedValueOnce('ok');
      await provider.generate(
        mockRequest({ systemPrompt: 'Custom instructions' }),
      );
      const stdin = toolExecutor.execute.mock.calls[0][2];
      expect(stdin).toContain('=== SYSTEM ===');
      expect(stdin).toContain('Custom instructions');
    });

    it('includes history in flattened prompt', async () => {
      toolExecutor.execute.mockResolvedValueOnce('ok');
      await provider.generate(
        mockRequest({ history: [{ role: 'user', content: 'prior message' }] }),
      );
      const stdin = toolExecutor.execute.mock.calls[0][2];
      expect(stdin).toContain('=== CONVERSATION HISTORY ===');
      expect(stdin).toContain('prior message');
    });

    it('throws when CLI execution fails', async () => {
      toolExecutor.execute.mockRejectedValueOnce(new Error('binary not found'));
      await expect(provider.generate(mockRequest())).rejects.toThrow(
        'Claude Code CLI execution failed: binary not found',
      );
    });
  });
});
