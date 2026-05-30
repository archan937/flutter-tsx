import type { Subprocess } from 'bun';

export interface FlutterRunnerOptions {
  /** Flutter target device, e.g. "web" | "ios" | "macos" (default "web"). */
  target?: string;
  /** Path to the flutter binary (default "flutter"). */
  flutterBin?: string;
  /** Extra `--dart-define=…` flags from config/env.ts. */
  dartDefines?: string[];
}

/**
 * Manages a running `flutter run` process.
 * Sends hot-reload signals via stdin.
 *
 * We pass `-d <deviceId>` so Flutter doesn't prompt when multiple devices are connected.
 * Device ids match `flutter devices` output: chrome (web), macos, linux, windows.
 * For ios/android the id is the simulator/device id — we pass the target and let Flutter error
 * with the device list if it's not a known id.
 */
export class FlutterRunner {
  private proc: Subprocess<'pipe', 'pipe', 'pipe'> | null = null;
  private flutterDir: string;
  private target: string;
  private flutterBin: string;
  private dartDefines: string[];

  private static readonly DEVICE_IDS: Partial<Record<string, string>> = {
    web: 'chrome',
    macos: 'macos',
    linux: 'linux',
    windows: 'windows',
  };

  constructor(flutterDir: string, options: FlutterRunnerOptions = {}) {
    this.flutterDir = flutterDir;
    this.target = options.target ?? 'web';
    this.flutterBin = options.flutterBin ?? 'flutter';
    this.dartDefines = options.dartDefines ?? [];
  }

  /** Assembles the `flutter run` argv (pure — exposed for testing). */
  static buildRunArgs(
    flutterBin: string,
    target: string,
    dartDefines: string[],
  ): string[] {
    const deviceId = FlutterRunner.DEVICE_IDS[target] ?? target;
    return [flutterBin, 'run', '-d', deviceId, ...dartDefines];
  }

  /** macOS arch that Xcode actually has a destination for (avoids "Unable to find a device matching arch"). */
  private static async getMacOSArch(flutterDir: string): Promise<string> {
    if (process.platform !== 'darwin')
      return process.arch === 'x64' ? 'x86_64' : 'arm64';
    const macosDir = `${flutterDir}/macos`;
    const projectPath = `${macosDir}/Runner.xcodeproj`;
    try {
      const proc = Bun.spawn(
        [
          'xcodebuild',
          '-showdestinations',
          '-scheme',
          'Runner',
          '-project',
          projectPath,
        ],
        { cwd: macosDir, stdout: 'pipe', stderr: 'pipe' },
      );
      const out = await new Response(proc.stdout).text();
      await new Response(proc.stderr).text();
      await proc.exited;
      const macArchs = new Set<string>();
      for (const line of out.split('\n')) {
        const m =
          line.match(/platform:macOS[^}]*arch:(\w+)/i) ??
          line.match(/arch:(\w+)[^}]*platform:macOS/i);
        if (m && (m[1] === 'x86_64' || m[1] === 'arm64')) macArchs.add(m[1]);
      }
      if (macArchs.size === 1) return [...macArchs][0];
      if (macArchs.size >= 2) {
        const uname = (await FlutterRunner.unameM()) ?? 'arm64';
        const preferred = uname === 'x86_64' ? 'x86_64' : 'arm64';
        if (macArchs.has(preferred)) return preferred;
        return [...macArchs][0];
      }
    } catch {
      // fall through
    }
    return (
      (await FlutterRunner.unameM()) ??
      (process.arch === 'x64' ? 'x86_64' : 'arm64')
    );
  }

  private static async unameM(): Promise<string | null> {
    try {
      const proc = Bun.spawn(['uname', '-m'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const out = await new Response(proc.stdout).text();
      await proc.exited;
      const arch = out.trim().toLowerCase();
      if (arch === 'x86_64' || arch === 'arm64') return arch;
    } catch {
      // ignore
    }
    return null;
  }

  async start(): Promise<void> {
    if (this.proc) {
      throw new Error('FlutterRunner already started');
    }

    const args = FlutterRunner.buildRunArgs(
      this.flutterBin,
      this.target,
      this.dartDefines,
    );

    let env: Record<string, string> | undefined;
    if (this.target === 'macos') {
      env = {
        ...process.env,
        FLUTTER_XCODE_ARCHS: await FlutterRunner.getMacOSArch(this.flutterDir),
      };
    }

    const proc = Bun.spawn(args, {
      cwd: this.flutterDir,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      ...(env && { env }),
    });
    this.proc = proc;

    this.pipeOutput();

    const exitPromise = new Promise<void>((resolve) => {
      proc.exited.then((code) => {
        if (code !== 0 && code !== null) {
          console.error(`[flutter] process exited with code ${code}`);
        }
        resolve();
      });
    });

    await Promise.race([
      new Promise<void>((r) => setTimeout(r, 1000)),
      exitPromise,
    ]);
  }

  async hotReload(): Promise<void> {
    if (!this.proc?.stdin) return;
    await this.proc.stdin.write('r\n');
  }

  async hotRestart(): Promise<void> {
    if (!this.proc?.stdin) return;
    await this.proc.stdin.write('R\n');
  }

  async stop(): Promise<void> {
    if (!this.proc) return;
    try {
      if (this.proc.stdin) {
        await this.proc.stdin.write('q\n');
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {
      // ignore
    }
    this.proc.kill();
    this.proc = null;
  }

  get isRunning(): boolean {
    return this.proc !== null;
  }

  /** Xcode DVT/device tooling noise on stderr when building macOS/iOS — harmless, hide it. */
  private static readonly XCODE_NOISE =
    /DVTDeviceOperation|DVTBuildVersion|DVTAssertions|DTDKRemoteDeviceData|DTDKMobileDeviceToken|DVTiOSFrameworks/;

  private pipeOutput(): void {
    if (!this.proc) return;

    const pipeStream = async (
      stream: ReadableStream<Uint8Array> | undefined,
      prefix: string,
      filter?: (line: string) => boolean,
    ): Promise<void> => {
      if (!stream) return;
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          for (const line of text.split('\n')) {
            const t = line.trim();
            if (!t) continue;
            if (filter && !filter(t)) continue;
            process.stdout.write(`${prefix} ${line}\n`);
          }
        }
      } catch {
        // stream closed
      }
    };

    pipeStream(
      this.proc.stdout as unknown as ReadableStream<Uint8Array>,
      '[flutter]',
    );
    pipeStream(
      this.proc.stderr as unknown as ReadableStream<Uint8Array>,
      '[flutter err]',
      (line) => !FlutterRunner.XCODE_NOISE.test(line),
    );
  }
}
