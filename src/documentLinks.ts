import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

/**
 * Import path links for Alya files.
 *
 * Underlines the module path in `import "..."` / `from "..." import ...`
 * statements; Ctrl+Click opens the resolved file. Resolution mirrors the
 * compiler (`parser::resolve_stmt_imports_ext_with_rewrites`):
 * relative paths against the importing file, `std/...` against nearby
 * `stdlib/` roots, bare names against installed packages
 * (`.alya/packages/<name>` or path dependencies via `alya.toml`).
 * Embedded-stdlib modules have no on-disk file and produce no link.
 */

export interface FileProbe {
  isFile(p: string): boolean;
  readFile(p: string): string | undefined;
  listDir(p: string): string[];
}

export const nodeProbe: FileProbe = {
  isFile: (p) => {
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  },
  readFile: (p) => {
    try {
      return fs.readFileSync(p, "utf8");
    } catch {
      return undefined;
    }
  },
  listDir: (p) => {
    try {
      return fs.readdirSync(p);
    } catch {
      return [];
    }
  },
};

export interface ImportOnLine {
  /** Module path text as written (without quotes). */
  path: string;
  /** Start offset of the path text within the line. */
  pathStart: number;
  /** End offset (exclusive) of the path text within the line. */
  pathEnd: number;
}

/** Finds a quoted module path on an `import` / `from ... import` line. */
export function findImportOnLine(lineText: string): ImportOnLine | undefined {
  const trimmed = lineText.trimStart();
  const isImport =
    trimmed.startsWith("import ") || trimmed.startsWith("import\t");
  const isFrom = trimmed.startsWith("from ") || trimmed.startsWith("from\t");
  if (!isImport && !isFrom) {
    return undefined;
  }
  for (let i = 0; i < lineText.length; i++) {
    const q = lineText[i];
    if (q !== '"' && q !== "'") {
      continue;
    }
    const end = lineText.indexOf(q, i + 1);
    if (end < 0) {
      return undefined;
    }
    return { path: lineText.slice(i + 1, end), pathStart: i + 1, pathEnd: end };
  }
  return undefined;
}

/** Compiler alias table for `std/` module names. */
export function canonicalStdModule(name: string): string {
  switch (name) {
    case "rand":
      return "math";
    case "color":
    case "term":
    case "ansi":
      return "console";
    case "glob":
      return "path";
    case "thread":
    case "threads":
    case "concurrency":
      return "sync";
    case "bench":
      return "test";
    default:
      return name;
  }
}

function tryFile(probe: FileProbe, candidate: string): string | undefined {
  if (probe.isFile(candidate)) {
    return candidate;
  }
  const withExt = candidate.endsWith(".alya")
    ? undefined
    : candidate + ".alya";
  if (withExt !== undefined && probe.isFile(withExt)) {
    return withExt;
  }
  return undefined;
}

/** Walks up from `start` looking for a directory containing `alya.toml`. */
export function findManifestDir(
  start: string,
  probe: FileProbe
): string | undefined {
  let current = path.resolve(start);
  for (;;) {
    if (probe.isFile(path.join(current, "alya.toml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

interface TomlDependency {
  kind: "path" | "remote";
  path?: string;
  major?: number;
}

/** Minimal `[dependencies]` reader: enough for path/git/version entries. */
export function readTomlDependency(
  manifestText: string,
  name: string
): TomlDependency | undefined {
  const lines = manifestText.split(/\r?\n/);
  let inDeps = false;
  for (const raw of lines) {
    const line = raw.split("#")[0].trim();
    if (line.startsWith("[")) {
      inDeps = line === "[dependencies]";
      continue;
    }
    if (!inDeps) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) {
      continue;
    }
    if (line.slice(0, eq).trim() !== name) {
      continue;
    }
    const value = line.slice(eq + 1).trim();
    const pathMatch = value.match(/path\s*=\s*"([^"]+)"/);
    if (pathMatch !== null && pathMatch[1] !== undefined) {
      return { kind: "path", path: pathMatch[1] };
    }
    // `tag = "v2..."` / `version = "2..."`, or a bare `"2.1.0"` string.
    const verMatch =
      value.match(/(?:tag|version)\s*=\s*"v?(\d+)/) ??
      value.match(/^"v?(\d+)/);
    return {
      kind: "remote",
      major:
        verMatch !== null && verMatch[1] !== undefined
          ? parseInt(verMatch[1], 10)
          : undefined,
    };
  }
  return undefined;
}

/** Reads the `entry = "..."` field of a package manifest, if present. */
export function readPackageEntry(
  manifestText: string
): string | undefined {
  for (const raw of manifestText.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const m = line.match(/^entry\s*=\s*"([^"]+)"/);
    if (m !== null && m[1] !== undefined) {
      return m[1];
    }
  }
  return undefined;
}

function resolvePackageDir(
  manifestDir: string,
  pkgName: string,
  dep: TomlDependency,
  probe: FileProbe
): string | undefined {
  if (dep.kind === "path" && dep.path !== undefined) {
    const dir = path.resolve(manifestDir, dep.path);
    return probe.isFile(path.join(dir, "alya.toml")) ||
      probe.listDir(dir).length > 0
      ? dir
      : undefined;
  }
  // Mirror the compiler: manifest dir first, then parent scopes, trying
  // `<name>-v<major>` before the plain `<name>` directory.
  let scope: string | undefined = manifestDir;
  while (scope !== undefined) {
    const pkgs = path.join(scope, ".alya", "packages");
    if (dep.major !== undefined) {
      const segregated = path.join(pkgs, `${pkgName}-v${dep.major}`);
      if (probe.listDir(segregated).length > 0) {
        return segregated;
      }
    }
    const plain = path.join(pkgs, pkgName);
    if (probe.listDir(plain).length > 0) {
      return plain;
    }
    const parent = path.dirname(scope);
    scope = parent === scope ? undefined : parent;
  }
  return undefined;
}

function resolveBareImport(
  importPath: string,
  manifestDir: string,
  probe: FileProbe
): string | undefined {
  const manifest = probe.readFile(path.join(manifestDir, "alya.toml"));
  if (manifest === undefined) {
    return undefined;
  }
  const slash = importPath.indexOf("/");
  const pkgName = slash < 0 ? importPath : importPath.slice(0, slash);
  const sub = slash < 0 ? undefined : importPath.slice(slash + 1);
  const dep = readTomlDependency(manifest, pkgName);
  if (dep === undefined) {
    return undefined;
  }
  const pkgDir = resolvePackageDir(manifestDir, pkgName, dep, probe);
  if (pkgDir === undefined) {
    return undefined;
  }
  if (sub !== undefined) {
    const clean = sub.replace(/\.alya$/, "");
    const candidates = [
      path.join(pkgDir, "src", `${clean}.alya`),
      path.join(pkgDir, "src", clean, "mod.alya"),
      path.join(pkgDir, "src", clean),
      path.join(pkgDir, `${clean}.alya`),
      path.join(pkgDir, clean, "mod.alya"),
      path.join(pkgDir, clean),
    ];
    for (const c of candidates) {
      if (probe.isFile(c)) {
        return c;
      }
    }
    return undefined;
  }
  const pkgManifest = probe.readFile(path.join(pkgDir, "alya.toml"));
  if (pkgManifest !== undefined) {
    const entry = readPackageEntry(pkgManifest);
    if (entry !== undefined) {
      const full = path.join(pkgDir, entry);
      if (probe.isFile(full)) {
        return full;
      }
    }
  }
  const fallbacks = [
    path.join(pkgDir, "src", "main.alya"),
    path.join(pkgDir, "src", "lib.alya"),
    path.join(pkgDir, "main.alya"),
    path.join(pkgDir, "lib.alya"),
    path.join(pkgDir, `${pkgName}.alya`),
    path.join(pkgDir, "src", `${pkgName}.alya`),
  ];
  for (const c of fallbacks) {
    if (probe.isFile(c)) {
      return c;
    }
  }
  return undefined;
}

/**
 * Resolves an import path string to an absolute file path, or `undefined`
 * when there is no on-disk target (missing file, embedded stdlib, unknown
 * package).
 */
export function resolveImportTarget(
  importPath: string,
  docDir: string,
  workspaceRoots: string[],
  probe: FileProbe
): string | undefined {
  const normalized = importPath.replace(/\\/g, "/");
  const isRelative =
    normalized.startsWith("./") ||
    normalized.startsWith("../") ||
    normalized.startsWith("/") ||
    path.isAbsolute(normalized);
  if (isRelative) {
    const target = path.resolve(docDir, normalized);
    return tryFile(probe, target);
  }
  if (normalized.startsWith("std/") || normalized.startsWith("std::")) {
    const clean = normalized
      .replace(/^std[/:]+/, "")
      .replace(/\.alya$/, "");
    const canonical = canonicalStdModule(clean);
    const roots = [docDir, ...workspaceRoots];
    for (const root of roots) {
      const hit = tryFile(probe, path.join(root, "stdlib", canonical));
      if (hit !== undefined) {
        return hit;
      }
    }
    return undefined;
  }
  const manifestDir = findManifestDir(docDir, probe);
  if (manifestDir === undefined) {
    return undefined;
  }
  return resolveBareImport(normalized, manifestDir, probe);
}

export class AlyaDocumentLinkProvider
  implements vscode.DocumentLinkProvider
{
  constructor(private readonly probe: FileProbe = nodeProbe) {}

  provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DocumentLink[]> {
    const docDir = path.dirname(document.uri.fsPath);
    const folders = vscode.workspace.workspaceFolders ?? [];
    const roots = folders.map((f) => f.uri.fsPath);
    const links: vscode.DocumentLink[] = [];
    for (let i = 0; i < document.lineCount; i++) {
      const text = document.lineAt(i).text;
      const found = findImportOnLine(text);
      if (found === undefined) {
        continue;
      }
      const target = resolveImportTarget(
        found.path,
        docDir,
        roots,
        this.probe
      );
      if (target === undefined) {
        continue;
      }
      links.push(
        new vscode.DocumentLink(
          new vscode.Range(i, found.pathStart, i, found.pathEnd),
          vscode.Uri.file(target)
        )
      );
    }
    return links;
  }
}
