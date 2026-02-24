import { defineCommand } from "citty";
import { join, resolve } from "path";
import chokidar from "chokidar";
import { readConfig } from "../utils/config.js";
import { ensureFlutterProject } from "../../flutter/project.js";
import { transpileFile, transpileAll } from "../../transpiler/index.js";
import { FlutterRunner } from "../../flutter/runner.js";
import { logger } from "../utils/logger.js";

export const devCmd = defineCommand({
  meta: {
    name: "dev",
    description: "Watch TSX sources, transpile to Dart, and run Flutter",
  },
  args: {
    target: {
      type: "string",
      description: "Flutter target device (web, ios, android, macos, linux)",
      default: "",
    },
    root: {
      type: "string",
      description: "Project root directory",
      default: process.cwd(),
    },
  },
  async run({ args }) {
    const root = resolve(args.root ?? process.cwd());
    const config = readConfig(root);
    const target = (args.target as string) || config.target || "web";

    const flutterDir = join(root, ".fsx", "flutter");
    const srcDir = join(root, "src");
    const outDir = join(root, config.outDir ?? ".fsx/flutter/lib");

    logger.info(`Starting flutter.tsx dev server`);
    logger.info(`Target: ${target}`);

    // 1. Ensure flutter project
    logger.start("Preparing Flutter project...");
    try {
      await ensureFlutterProject(flutterDir, config);
      logger.success("Flutter project ready");
    } catch (err) {
      logger.error("Failed to prepare Flutter project:", err);
      process.exit(1);
    }

    // 2. Initial transpile
    logger.start("Transpiling TSX → Dart...");
    try {
      const files = await transpileAll(srcDir, outDir);
      logger.success(`Transpiled ${files.length} file(s)`);
    } catch (err) {
      logger.error("Transpile error:", err);
    }

    // 3. Start flutter runner
    const runner = new FlutterRunner(flutterDir, target);
    try {
      await runner.start();
    } catch (err) {
      logger.error("Failed to start Flutter:", err);
      process.exit(1);
    }

    // 4. Watch for changes
    const watchPatterns = (config.watch ?? ["src/**/*.tsx"]).map((p) =>
      join(root, p)
    );

    const watcher = chokidar.watch(watchPatterns, {
      ignoreInitial: true,
      persistent: true,
    });

    watcher.on("change", async (filePath: string) => {
      logger.info(`Changed: ${filePath.replace(root + "/", "")}`);
      try {
        await transpileFile(filePath, outDir);
        await runner.hotReload();
        logger.success("Hot reload sent");
      } catch (err) {
        logger.error("Transpile/reload error:", err);
      }
    });

    watcher.on("add", async (filePath: string) => {
      logger.info(`Added: ${filePath.replace(root + "/", "")}`);
      try {
        await transpileFile(filePath, outDir);
        await runner.hotRestart();
      } catch (err) {
        logger.error("Transpile error:", err);
      }
    });

    // 5. Graceful shutdown
    const shutdown = async () => {
      logger.info("\nShutting down...");
      await watcher.close();
      await runner.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    logger.success(`Watching ${watchPatterns.length} pattern(s). Press Ctrl+C to stop.`);
  },
});
