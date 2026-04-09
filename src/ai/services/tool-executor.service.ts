import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface ToolExecutionOptions {
  /** Timeout in milliseconds (default: 30 000). */
  timeoutMs?: number;
  /** Maximum output size in bytes (default: 2 MB). */
  maxOutputBytes?: number;
}

@Injectable()
export class ToolExecutorService {
  /**
   * Safely executes an external binary using execFile (no shell expansion).
   * Prompt text is written to the process's stdin.
   *
   * @param binaryPath  Absolute or PATH-resolved binary name.
   * @param args        Arguments array — never interpolated into a shell string.
   * @param stdin       Text fed to the process via stdin.
   * @param options     Timeout and output-size limits.
   */
  async execute(
    binaryPath: string,
    args: string[],
    stdin: string,
    options: ToolExecutionOptions = {},
  ): Promise<string> {
    const timeoutMs = options.timeoutMs ?? 30_000;
    const maxOutputBytes = options.maxOutputBytes ?? 2 * 1024 * 1024;

    const { stdout } = await execFileAsync(binaryPath, args, {
      input: stdin,
      timeout: timeoutMs,
      maxBuffer: maxOutputBytes,
      // Never use shell: always false to prevent injection
      shell: false,
    });

    return stdout;
  }
}
