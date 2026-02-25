import { defineCommand } from "citty";
import { join } from "path";
import { existsSync, mkdirSync, rmSync } from "fs";
import * as p from "@clack/prompts";

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? "~";
const FSX_DIR = join(HOME, ".fsx");
const INSTALL_DIR = join(FSX_DIR, "flutter");
export const FLUTTER_BIN = join(INSTALL_DIR, "bin", "flutter");

const RELEASES_BASE =
  "https://storage.googleapis.com/flutter_infra_release/releases";

function platformKey(): string {
  switch (process.platform) {
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

interface Release {
  url: string;
  version: string;
  archive: string;
}

async function fetchLatestRelease(): Promise<Release> {
  const key = platformKey();
  const res = await fetch(`${RELEASES_BASE}/releases_${key}.json`);
  if (!res.ok)
    throw new Error(`Failed to fetch Flutter releases: ${res.status}`);
  const data = (await res.json()) as {
    base_url: string;
    current_release: { stable: string };
    releases: { hash: string; channel: string; version: string; archive: string }[];
  };
  const stableHash = data.current_release.stable;
  const release = data.releases.find(
    (r) => r.hash === stableHash && r.channel === "stable"
  );
  if (!release) throw new Error("Could not find stable Flutter release");
  return {
    url: `${data.base_url}/${release.archive}`,
    version: release.version,
    archive: release.archive,
  };
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  const total = Number(res.headers.get("content-length") ?? 0);
  const writer = Bun.file(dest).writer();
  const reader = res.body!.getReader();
  let downloaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    writer.write(value);
    downloaded += value.length;
    if (total > 0) {
      const pct = Math.round((downloaded / total) * 100);
      process.stdout.write(`\r  Downloading Flutter SDK... ${pct}%`);
    }
  }
  await writer.end();
  process.stdout.write("\n");
}

async function extract(archivePath: string, destParent: string): Promise<void> {
  mkdirSync(destParent, { recursive: true });
  if (archivePath.endsWith(".zip")) {
    const proc = Bun.spawn(["unzip", "-q", "-o", archivePath, "-d", destParent], {
      stderr: "pipe",
    });
    const code = await proc.exited;
    if (code !== 0) throw new Error("unzip failed");
  } else {
    // .tar.xz (Linux)
    const proc = Bun.spawn(["tar", "xf", archivePath, "-C", destParent], {
      stderr: "pipe",
    });
    const code = await proc.exited;
    if (code !== 0) throw new Error("tar extraction failed");
  }
}

export const installCmd = defineCommand({
  meta: {
    name: "install",
    description: "Download and install the Flutter SDK",
  },
  args: {
    force: {
      type: "boolean",
      description: "Re-install even if Flutter is already present",
      default: false,
    },
  },
  async run({ args }) {
    p.intro("fsx install");

    // Already installed?
    const already = existsSync(FLUTTER_BIN);
    if (already && !args.force) {
      p.note(FLUTTER_BIN, "Flutter is already installed");
      p.log.info(
        "Run `fsx install --force` to reinstall, or `flutter upgrade` to update."
      );
      p.outro("Nothing to do.");
      return;
    }

    // Fetch release metadata
    const s = p.spinner();
    s.start("Fetching latest stable Flutter release info...");
    let release: Release;
    try {
      release = await fetchLatestRelease();
      s.stop(`Flutter ${release.version} (${platformKey()})`);
    } catch (err) {
      s.stop("Failed to fetch release info");
      p.log.error(String(err));
      process.exit(1);
    }

    // Download archive
    const tmpArchive = join(FSX_DIR, release.archive.split("/").pop()!);
    mkdirSync(FSX_DIR, { recursive: true });
    try {
      await downloadFile(release.url, tmpArchive);
    } catch (err) {
      p.log.error(`Download error: ${err}`);
      process.exit(1);
    }

    // Remove existing install if --force
    if (already && args.force && existsSync(INSTALL_DIR)) {
      rmSync(INSTALL_DIR, { recursive: true, force: true });
    }

    // Extract (archive contains a `flutter/` dir → lands at ~/.fsx/flutter)
    s.start("Extracting...");
    try {
      await extract(tmpArchive, FSX_DIR);
      s.stop("Extracted");
    } catch (err) {
      s.stop("Extraction failed");
      p.log.error(String(err));
      process.exit(1);
    }

    // Clean up archive
    rmSync(tmpArchive, { force: true });

    // PATH instructions
    const binDir = join(INSTALL_DIR, "bin");
    p.note(
      [
        `Add the following to your shell profile (~/.zshrc, ~/.bashrc, etc.):`,
        ``,
        `  export PATH="$PATH:${binDir}"`,
        ``,
        `Then restart your terminal or run:  source ~/.zshrc`,
      ].join("\n"),
      "One more step"
    );

    p.outro(`Flutter ${release.version} installed at ${INSTALL_DIR}`);
  },
});
