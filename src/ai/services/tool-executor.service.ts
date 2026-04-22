import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';

export interface ToolExecutionOptions {
  /** Timeout in milliseconds (default: 30 000). */
  timeoutMs?: number;
  /** Maximum output size in bytes (default: 2 MB). */
  maxOutputBytes?: number;
}

@Injectable()
export class ToolExecutorService {
  /**
   * Safely executes an external binary using spawn (no shell expansion).
   * Prompt text is written to the process's stdin.
   *
   * @param binaryPath  Absolute or PATH-resolved binary name.
   * @param args        Arguments array — never interpolated into a shell string.
   * @param stdin       Text fed to the process via stdin.
   * @param options     Timeout and output-size limits.
   */
  execute(
    binaryPath: string,
    args: string[],
    stdin: string,
    options: ToolExecutionOptions = {},
  ): Promise<string> {
    const timeoutMs = options.timeoutMs ?? 30_000;
    const maxOutputBytes = options.maxOutputBytes ?? 2 * 1024 * 1024;

    return new Promise<string>((resolve, reject) => {
      // shell: false is the default for spawn — no shell injection possible
      const child = spawn(binaryPath, args, { shell: false });

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
        reject(new Error(`Process timed out after ${timeoutMs}ms: ${binaryPath}`));
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > maxOutputBytes) {
          child.kill();
          reject(new Error(`Process output exceeded ${maxOutputBytes} bytes`));
          return;
        }
        chunks.push(chunk);
      });

      const errChunks: Buffer[] = [];
      child.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk));

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) return;
        if (code !== 0) {
          const stderr = Buffer.concat(errChunks).toString('utf8');
          reject(
            new Error(
              `Process exited with code ${code}: ${binaryPath}\n${stderr}`,
            ),
          );
          return;
        }
        resolve(Buffer.concat(chunks).toString('utf8'));
      });

      // Cap stdin at 50 KB to avoid oversized payloads to CLI tools
      const MAX_STDIN_BYTES = 50 * 1024;
      const stdinToWrite =
        stdin && Buffer.byteLength(stdin, 'utf8') > MAX_STDIN_BYTES
          ? Buffer.from(stdin, 'utf8').subarray(0, MAX_STDIN_BYTES).toString('utf8')
          : stdin;

      if (stdinToWrite) {
        child.stdin.write(stdinToWrite, 'utf8');
      }
      child.stdin.end();
    });
  }
}
