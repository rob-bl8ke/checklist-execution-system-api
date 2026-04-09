import { CopilotProvider } from './copilot.provider';
import { ToolExecutorService } from '../services/tool-executor.service';
import { mockRequest } from './test-helpers';

describe('CopilotProvider', () => {
  let provider: CopilotProvider;
  let toolExecutor: jest.Mocked<ToolExecutorService>;

  beforeEach(() => {
    toolExecutor = { execute: jest.fn() } as jest.Mocked<ToolExecutorService>;
    provider = new CopilotProvider(toolExecutor);
  });

  describe('capabilities', () => {
    it('reports supportsStructuredProposal: false', () => {
      expect(provider.capabilities.supportsStructuredProposal).toBe(false);
    });

    it('reports transport: cli', () => {
      expect(provider.capabilities.transport).toBe('cli');
    });

    it('includes an unavailableReason explaining the limitation', () => {
      expect(provider.capabilities.unavailableReason).toContain(
        'interactive-first',
      );
    });
  });

  describe('generate', () => {
    it('always returns advice-only regardless of expectedOutput', async () => {
      toolExecutor.execute.mockResolvedValueOnce('Copilot advice response.');

      const result = await provider.generate(mockRequest());

      expect(result.assistantMessage).toBe('Copilot advice response.');
      expect(result.proposal).toBeUndefined();
    });

    it('trims whitespace from output', async () => {
      toolExecutor.execute.mockResolvedValueOnce('  trimmed response  \n');
      const result = await provider.generate(mockRequest());
      expect(result.assistantMessage).toBe('trimmed response');
    });

    it('uses gh copilot explain command', async () => {
      toolExecutor.execute.mockResolvedValueOnce('ok');
      await provider.generate(mockRequest());

      expect(toolExecutor.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['copilot', 'explain']),
        '',
        expect.any(Object),
      );
    });

    it('throws when CLI execution fails', async () => {
      toolExecutor.execute.mockRejectedValueOnce(new Error('not installed'));
      await expect(provider.generate(mockRequest())).rejects.toThrow(
        'Copilot CLI execution failed: not installed',
      );
    });
  });
});
