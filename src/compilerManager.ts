import * as cp from "child_process";
import * as crypto from "crypto";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

/** Release platform id as used in `alya-<tag>-<platform>.*` archives. */
export type AssetPlatform =
  | "x86_64-windows"
  | "arm64-windows"
  | "x86_64-linux"
  | "arm64-linux"
  | "x86_64-macos"
  | "arm64-macos";

export interface PlatformMapping {
  platform: AssetPlatform;
  archive: "zip" | "tar.gz";
}

/**
 * Maps Node's platform/arch to a compiler release asset. Returns null for
 * unsupported combinations (caller falls back to manual install).
 */
export function resolvePlatform(
  platform: string,
  arch: string
): PlatformMapping | null {
  if (platform === "win32" && arch === "x64") {
    return { platform: "x86_64-windows", archive: "zip" };
  }
  if (platform === "win32" && arch === "arm64") {
    return { platform: "arm64-windows", archive: "zip" };
  }
  if (platform === "linux" && arch === "x64") {
    return { platform: "x86_64-linux", archive: "tar.gz" };
  }
  if (platform === "linux" && arch === "arm64") {
    return { platform: "arm64-linux", archive: "tar.gz" };
  }
  if (platform === "darwin" && arch === "x64") {
    return { platform: "x86_64-macos", archive: "tar.gz" };
  }
  if (platform === "darwin" && arch === "arm64") {
    return { platform: "arm64-macos", archive: "tar.gz" };
  }
  return null;
}

/** Extracts `X.Y.Z` from `alya --version` output (`alya 0.0.20 (...)`). */
export function parseCompilerVersion(output: string): string | null {
  const match = output.match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

/** Normalizes a pinned version to a release tag (`0.0.21` -> `v0.0.21`). */
export function normalizeTag(version: string): string {
  const v = version.trim();
  return v.startsWith("v") ? v : `v${v}`;
}

/**
 * Asset file name inside an alya release, e.g.
 * `alya-v0.0.21-x86_64-windows.zip`.
 */
export function assetName(tag: string, mapping: PlatformMapping): string {
  return `alya-${tag}-${mapping.platform}.${mapping.archive}`;
}

/** Sibling `alya-lsp` binary next to a resolved `alya` binary path. */
export function siblingLspPath(alyaPath: string): string {
  const exe = alyaPath.endsWith(".exe");
  const base = exe ? alyaPath.slice(0, -".exe".length) : alyaPath;
  const stripped = base.endsWith("alya")
    ? base.slice(0, -"alya".length)
    : `${base}-`;
  const sibling = `${stripped}alya-lsp`;
  return exe ? `${sibling}.exe` : sibling;
}

export interface ResolvedCompiler {
  /** `alya` binary for run/build/test/lint/debug/DAP. */
  cliPath: string;
  /** Binary spawned for the LSP client (`alya-lsp`, no args). */
  lspPath: string;
  lspArgs: string[];
  source: "config" | "system" | "cache" | "download";
  version?: string;
}

/** Latest resolved CLI path, so DAP/commands can reuse it without config. */
let resolvedCliPath: string | undefined;

export function getResolvedCliPath(): string | undefined {
  return resolvedCliPath;
}

function execFileAsync(
  file: string,
  args: string[],
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.execFile(file, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        resolve(String(stdout));
      }
    });
  });
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p, fs.constants.X_OK);
    return true;
  } catch {
    try {
      await fsp.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

/** Full path of `alya` on PATH, or null when not installed. */
async function resolveOnPath(): Promise<string | null> {
  try {
    if (process.platform === "win32") {
      const out = await execFileAsync("where", ["alya"], 8000);
      const first = out.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
      return first ?? null;
    }
    const out = await execFileAsync("command", ["-v", "alya"], 8000).catch(() =>
      execFileAsync("which", ["alya"], 8000)
    );
    const first = out.trim().split("\n")[0]?.trim();
    return first ? first : null;
  } catch {
    return null;
  }
}

async function systemCompiler(): Promise<{ path: string; version: string } | null> {
  const found = await resolveOnPath();
  const probeTargets = found ? [found, "alya"] : ["alya"];
  for (const target of probeTargets) {
    try {
      const out = await execFileAsync(target, ["--version"], 8000);
      const version = parseCompilerVersion(out);
      if (version) {
        return { path: target, version };
      }
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

interface ReleaseInfo {
  tag: string;
  asset: string;
  assetUrl: string;
  shaUrl: string;
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": "vscode-alya", Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    throw new Error(`GitHub API request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function resolveRelease(
  pinned: string,
  mapping: PlatformMapping
): Promise<ReleaseInfo> {
  if (pinned !== "latest") {
    const tag = normalizeTag(pinned);
    const asset = assetName(tag, mapping);
    return {
      tag,
      asset,
      assetUrl: `https://github.com/alya-lang/alya/releases/download/${tag}/${asset}`,
      shaUrl: `https://github.com/alya-lang/alya/releases/download/${tag}/${asset}.sha256`,
    };
  }
  const info = await fetchJson("https://api.github.com/repos/alya-lang/alya/releases/latest");
  const tag = String(info.tag_name ?? "");
  if (!tag) {
    throw new Error("Latest alya release has no tag name.");
  }
  const asset = assetName(tag, mapping);
  const assets = Array.isArray(info.assets) ? info.assets : [];
  const found = assets.find((a: any) => a?.name === asset);
  const assetUrl =
    found?.browser_download_url ??
    `https://github.com/alya-lang/alya/releases/download/${tag}/${asset}`;
  return { tag, asset, assetUrl, shaUrl: `${assetUrl}.sha256` };
}

async function downloadBytes(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": "vscode-alya" } });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText} (${url})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function verifySha256(payload: Buffer, shaFile: string, asset: string): void {
  const expected = shaFile.split(/\s+/)[0]?.trim().toLowerCase();
  if (!expected || !/^[0-9a-f]{64}$/.test(expected)) {
    throw new Error(`Invalid checksum file for ${asset}.`);
  }
  const actual = crypto.createHash("sha256").update(payload).digest("hex");
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${asset}.`);
  }
}

async function extractArchive(
  archivePath: string,
  archive: "zip" | "tar.gz",
  destDir: string
): Promise<void> {
  await fsp.mkdir(destDir, { recursive: true });
  if (archive === "tar.gz") {
    await execFileAsync("tar", ["-xzf", archivePath, "-C", destDir], 120000);
    return;
  }
  // zip: bsdtar handles it on all three OSes; PowerShell is the fallback.
  try {
    await execFileAsync("tar", ["-xf", archivePath, "-C", destDir], 120000);
  } catch {
    if (process.platform !== "win32") {
      throw new Error("Failed to extract compiler archive (tar).");
    }
    await new Promise<void>((resolve, reject) => {
      cp.execFile(
        "powershell",
        ["-NoProfile", "-Command", `Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force`],
        { timeout: 120000, windowsHide: true },
        (err) => (err ? reject(err) : resolve())
      );
    });
  }
}

/** Finds `alya`/`alya-lsp` under an extracted archive dir (one level nest). */
async function findExtractedBinaries(root: string): Promise<{ alya: string; lsp: string } | null> {
  const exe = process.platform === "win32" ? ".exe" : "";
  const candidates = [root];
  try {
    const entries = await fsp.readdir(root, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        candidates.push(path.join(root, e.name));
      }
    }
  } catch {
    return null;
  }
  for (const dir of candidates) {
    const alya = path.join(dir, `alya${exe}`);
    const lsp = path.join(dir, `alya-lsp${exe}`);
    if (await fileExists(alya)) {
      return { alya, lsp: (await fileExists(lsp)) ? lsp : alya };
    }
  }
  return null;
}

/**
 * Downloads + verifies + extracts one release archive into global storage.
 * Returns the `alya` and `alya-lsp` binary paths.
 */
export async function downloadCompiler(
  storageDir: string,
  tag: string,
  mapping: PlatformMapping,
  release: ReleaseInfo
): Promise<{ alya: string; lsp: string }> {
  const destDir = path.join(storageDir, "compiler", tag, mapping.platform);
  const alyaName = `alya${process.platform === "win32" ? ".exe" : ""}`;
  const lspName = `alya-lsp${process.platform === "win32" ? ".exe" : ""}`;
  const cachedAlya = path.join(destDir, alyaName);
  const cachedLsp = path.join(destDir, lspName);
  if ((await fileExists(cachedAlya)) && (await fileExists(cachedLsp))) {
    return { alya: cachedAlya, lsp: cachedLsp };
  }

  const payload = await downloadBytes(release.assetUrl);
  const shaText = (await downloadBytes(release.shaUrl)).toString("utf8");
  verifySha256(payload, shaText, release.asset);

  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "alya-compiler-"));
  try {
    const archivePath = path.join(tmp, release.asset);
    await fsp.writeFile(archivePath, payload);
    const extracted = path.join(tmp, "out");
    await extractArchive(archivePath, mapping.archive, extracted);
    const found = await findExtractedBinaries(extracted);
    if (!found) {
      throw new Error(`Compiler archive has no alya binary (${release.asset}).`);
    }
    await fsp.mkdir(destDir, { recursive: true });
    await fsp.copyFile(found.alya, cachedAlya);
    // Archives predating the split have no separate server: fall back to
    // `alya lsp` instead of duplicating the binary.
    if (found.lsp !== found.alya) {
      await fsp.copyFile(found.lsp, cachedLsp);
    }
    if (process.platform !== "win32") {
      await fsp.chmod(cachedAlya, 0o755).catch(() => {});
      if (found.lsp !== found.alya) {
        await fsp.chmod(cachedLsp, 0o755).catch(() => {});
      }
    }
    return {
      alya: cachedAlya,
      lsp: found.lsp !== found.alya ? cachedLsp : cachedAlya,
    };
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Resolution order:
 * 1. Explicit `alya.lsp.path` override (user-managed, no download).
 * 2. System `alya` on PATH (sibling `alya-lsp` preferred for LSP).
 * 3. Previously downloaded cache.
 * 4. Fresh download (only when `autoDownload` is on).
 * Never throws: falls back to `{ alya, [lsp] }` with an error notice.
 */
export async function ensureCompiler(
  context: vscode.ExtensionContext
): Promise<ResolvedCompiler> {
  const config = vscode.workspace.getConfiguration("alya");
  const configuredLsp = config.get<string>("lsp.path") || "alya";
  const configuredArgs = config.get<string[]>("lsp.arguments") || ["lsp"];
  const autoDownload = config.get<boolean>("compiler.autoDownload") ?? true;
  const pinned = config.get<string>("compiler.version") || "latest";

  // 1. Explicit user override wins for the LSP client.
  if (configuredLsp !== "alya") {
    const sys = await systemCompiler().catch(() => null);
    resolvedCliPath = sys?.path ?? "alya";
    return {
      cliPath: resolvedCliPath,
      lspPath: configuredLsp,
      lspArgs: configuredArgs,
      source: "config",
      version: sys?.version,
    };
  }

  // 2. System compiler.
  const sys = await systemCompiler().catch(() => null);
  if (sys) {
    const sibling = sys.path.includes(path.sep) ? siblingLspPath(sys.path) : null;
    if (sibling && (await fileExists(sibling))) {
      resolvedCliPath = sys.path;
      return {
        cliPath: sys.path,
        lspPath: sibling,
        lspArgs: [],
        source: "system",
        version: sys.version,
      };
    }
    resolvedCliPath = sys.path;
    return {
      cliPath: sys.path,
      lspPath: sys.path,
      lspArgs: ["lsp"],
      source: "system",
      version: sys.version,
    };
  }

  const mapping = resolvePlatform(process.platform, process.arch);
  const storage = context.globalStorageUri.fsPath;
  // 3. Previously downloaded cache (any version).
  if (mapping) {
    const cacheRoot = path.join(storage, "compiler");
    try {
      const tags = await fsp.readdir(cacheRoot).catch(() => [] as string[]);
      // Prefer the pinned tag, else the newest cached entry.
      const ordered = [...tags].sort().reverse();
      const preferred = pinned !== "latest" ? normalizeTag(pinned) : undefined;
      const candidates = preferred
        ? [preferred, ...ordered.filter((t) => t !== preferred)]
        : ordered;
      for (const tag of candidates) {
        const dir = path.join(cacheRoot, tag, mapping.platform);
        const exe = process.platform === "win32" ? ".exe" : "";
        const alya = path.join(dir, `alya${exe}`);
        const lsp = path.join(dir, `alya-lsp${exe}`);
        if (await fileExists(alya)) {
          resolvedCliPath = alya;
          return {
            cliPath: alya,
            lspPath: (await fileExists(lsp)) ? lsp : alya,
            lspArgs: (await fileExists(lsp)) ? [] : ["lsp"],
            source: "cache",
            version: tag,
          };
        }
      }
    } catch {
      // Fall through to download / error.
    }
  }

  // 4. Fresh download.
  if (autoDownload && mapping) {
    try {
      const release = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Alya compiler" },
        async (progress) => {
          progress.report({ message: "Resolving release..." });
          const rel = await resolveRelease(pinned, mapping);
          progress.report({ message: `Downloading ${rel.asset}...` });
          return rel;
        }
      );
      const bins = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Alya compiler" },
        async (progress) => {
          progress.report({ message: `Installing ${release.asset}...` });
          return downloadCompiler(storage, release.tag, mapping, release);
        }
      );
      resolvedCliPath = bins.alya;
      return {
        cliPath: bins.alya,
        lspPath: bins.lsp,
        lspArgs: bins.lsp !== bins.alya ? [] : ["lsp"],
        source: "download",
        version: release.tag,
      };
    } catch (e) {
      void vscode.window.showErrorMessage(
        vscode.l10n.t(
          "Alya compiler not found and auto-download failed: {0}. Install it manually or set alya.lsp.path.",
          String(e instanceof Error ? e.message : e)
        )
      );
    }
  } else if (!mapping) {
    void vscode.window.showErrorMessage(
      vscode.l10n.t(
        "Alya compiler not found and this platform ({0}/{1}) has no prebuilt binary. Install alya manually and set alya.lsp.path.",
        process.platform,
        process.arch
      )
    );
  } else {
    void vscode.window.showErrorMessage(
      vscode.l10n.t(
        "Alya compiler not found on PATH. Install it, enable alya.compiler.autoDownload, or set alya.lsp.path."
      )
    );
  }

  resolvedCliPath = "alya";
  return { cliPath: "alya", lspPath: "alya", lspArgs: ["lsp"], source: "system" };
}
