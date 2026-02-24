import type { Subprocess } from "bun";

/**
 * Manages a running `flutter run` process.
 * Sends hot-reload signals via stdin.
 */
export class FlutterRunner {
  private proc: Subprocess<"pipe", "pipe", "pipe"> | null = null;
  private flutterDir: string;
  private target: string;

  constructor(flutterDir: string, target = "web") {
    this.flutterDir = flutterDir;
    this.target = target;
  }

  async start(): Promise<void> {
    if (this.proc) {
      throw new Error("FlutterRunner already started");
    }

    const args = ["flutter", "run", "-d", this.target];

    this.proc = Bun.spawn(args, {
      cwd: this.flutterDir,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    // Pipe flutter output to our stdout
    this.pipeOutput();

    // Wait a bit to detect immediate failures
    const exitPromise = new Promise<void>((resolve) => {
      this.proc!.exited.then((code) => {
        if (code !== 0 && code !== null) {
          console.error(`[flutter] process exited with code ${code}`);
        }
        resolve();
      });
    });

    // Brief startup check (1s)
    await Promise.race([
      new Promise<void>((r) => setTimeout(r, 1000)),
      exitPromise,
    ]);
  }

  /**
   * Sends a hot-reload signal to the running flutter process.
   */
  async hotReload(): Promise<void> {
    if (!this.proc?.stdin) return;
    await this.proc.stdin.write("r\n");
  }

  /**
   * Sends a hot-restart signal.
   */
  async hotRestart(): Promise<void> {
    if (!this.proc?.stdin) return;
    await this.proc.stdin.write("R\n");
  }

  /**
   * Stops the flutter process.
   */
  async stop(): Promise<void> {
    if (!this.proc) return;
    try {
      if (this.proc.stdin) {
        await this.proc.stdin.write("q\n");
        // Give it a moment to quit gracefully
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {
      // Ignore errors during shutdown
    }
    this.proc.kill();
    this.proc = null;
  }

  get isRunning(): boolean {
    return this.proc !== null;
  }

  private pipeOutput(): void {
    if (!this.proc) return;

    const pipeStream = async (
      stream: ReadableStream<Uint8Array> | undefined,
      prefix: string
    ) => {
      if (!stream) return;
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          for (const line of text.split("\n")) {
            if (line.trim()) process.stdout.write(`${prefix} ${line}\n`);
          }
        }
      } catch {
        // Stream closed
      }
    };

    pipeStream(this.proc.stdout as unknown as ReadableStream<Uint8Array>, "[flutter]");
    pipeStream(this.proc.stderr as unknown as ReadableStream<Uint8Array>, "[flutter err]");
  }
}
