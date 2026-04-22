import { ToolExecutorService } from './tool-executor.service';
import { EventEmitter } from 'events';

// Mock child_process at the module level so spawn is configurable
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const childProcess = require('child_process') as { spawn: jest.Mock };

/**
 * Builds a minimal mock of the ChildProcess returned by spawn.
 */
function makeSpawnMock(exitCode: number, stdout: string, stderr = '') {
  const stdoutEmitter = new EventEmitter();
  const stderrEmitter = new EventEmitter();
  const stdinEmitter = new EventEmitter() as EventEmitter & {
    write: jest.Mock;
    end: jest.Mock;
  };
  stdinEmitter.write = jest.fn();
  stdinEmitter.end = jest.fn();

  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: typeof stdinEmitter;
    kill: jest.Mock;
  };
  proc.stdout = stdoutEmitter;
  proc.stderr = stderrEmitter;
  proc.stdin = stdinEmitter;
  proc.kill = jest.fn();

  setImmediate(() => {
    stdoutEmitter.emit('data', Buffer.from(stdout, 'utf8'));
    stderrEmitter.emit('data', Buffer.from(stderr, 'utf8'));
    proc.emit('close', exitCode);
  });

  return proc;
}

describe('ToolExecutorService', () => {
  let service: ToolExecutorService;

  beforeEach(() => {
    service = new ToolExecutorService();
    childProcess.spawn.mockReset();
  });

  it('resolves with stdout text on successful exit', async () => {
    childProcess.spawn.mockReturnValue(makeSpawnMock(0, 'CLI output here'));

    const result = await service.execute('some-bin', ['--flag'], 'stdin content');
    expect(result).toBe('CLI output here');
  });

  it('rejects on non-zero exit code', async () => {
    childProcess.spawn.mockReturnValue(makeSpawnMock(1, '', 'something went wrong'));

    await expect(service.execute('some-bin', [], '')).rejects.toThrow('code 1');
  });

  it('spawns with shell: false (no shell injection)', () => {
    childProcess.spawn.mockReturnValue(makeSpawnMock(0, ''));

    service.execute('some-bin', [], '');

    const [, , opts] = childProcess.spawn.mock.calls[0] as [
      string,
      string[],
      Record<string, unknown>,
    ];
    expect(opts.shell).toBe(false);
  });

  it('writes stdin content to child process stdin', async () => {
    const mock = makeSpawnMock(0, 'ok');
    childProcess.spawn.mockReturnValue(mock);

    await service.execute('some-bin', [], 'hello stdin');

    expect(mock.stdin.write).toHaveBeenCalledWith('hello stdin', 'utf8');
    expect(mock.stdin.end).toHaveBeenCalled();
  });

  it('caps stdin at 50 KB before writing', async () => {
    const bigInput = 'A'.repeat(51 * 1024);
    const mock = makeSpawnMock(0, 'ok');
    childProcess.spawn.mockReturnValue(mock);

    await service.execute('some-bin', [], bigInput);

    const writtenArg = mock.stdin.write.mock.calls[0][0] as string;
    expect(Buffer.byteLength(writtenArg, 'utf8')).toBeLessThanOrEqual(50 * 1024);
  });

  it('does not write stdin when empty string provided', async () => {
    const mock = makeSpawnMock(0, 'ok');
    childProcess.spawn.mockReturnValue(mock);

    await service.execute('some-bin', [], '');

    expect(mock.stdin.write).not.toHaveBeenCalled();
  });
});
