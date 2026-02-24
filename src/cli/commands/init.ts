import { defineCommand } from "citty";
import { intro, outro, text, select, spinner, isCancel } from "@clack/prompts";
import { resolve } from "path";
import { existsSync, mkdirSync } from "fs";
import { scaffoldUserProject } from "../../flutter/project.js";
import { logger } from "../utils/logger.js";

export const initCmd = defineCommand({
  meta: {
    name: "init",
    description: "Scaffold a new flutter.tsx project",
  },
  args: {
    name: {
      type: "positional",
      description: "Project name / directory",
      required: false,
    },
    bundleId: {
      type: "string",
      description: "Bundle ID (e.g. com.example.myapp) — skips prompt when provided",
    },
    target: {
      type: "string",
      description: "Default target platform: web | ios | android | macos — skips prompt when provided",
    },
  },
  async run({ args }) {
    intro("flutter.tsx — new project");

    // Project name
    const projectName: string = args.name
      ? String(args.name)
      : (() => {
          throw new Error("Project name is required");
        })();

    const defaultBundleId = `com.example.${projectName.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

    // Bundle ID — skip prompt if --bundleId flag given
    let bundleId: string;
    if (args.bundleId) {
      bundleId = String(args.bundleId);
    } else {
      const result = await text({
        message: "Bundle ID:",
        placeholder: defaultBundleId,
        initialValue: defaultBundleId,
      });
      if (isCancel(result)) process.exit(0);
      bundleId = String(result);
    }

    // Target platform — skip prompt if --target flag given
    let target: string;
    if (args.target) {
      target = String(args.target);
    } else {
      const result = await select({
        message: "Default target platform:",
        options: [
          { value: "web", label: "Web (fastest to start)" },
          { value: "ios", label: "iOS" },
          { value: "android", label: "Android" },
          { value: "macos", label: "macOS" },
        ],
      });
      if (isCancel(result)) process.exit(0);
      target = String(result);
    }

    const projectDir = resolve(projectName);

    if (existsSync(projectDir)) {
      logger.warn(`Directory ${projectDir} already exists. Files may be overwritten.`);
    }

    const s = spinner();
    s.start(`Scaffolding ${projectName}...`);

    try {
      mkdirSync(projectDir, { recursive: true });
      await scaffoldUserProject(projectDir, { name: projectName, bundleId, target });
      s.stop(`Project created at ${projectDir}`);
    } catch (err) {
      s.stop("Failed to scaffold project");
      logger.error(err);
      process.exit(1);
    }

    outro(
      [
        `Next steps:`,
        `  cd ${projectName}`,
        `  bun install`,
        `  bun run dev`,
      ].join("\n")
    );
  },
});
