import { describe, it, expect } from "bun:test";
import * as path from "node:path";
import {
  findImportOnLine,
  canonicalStdModule,
  findManifestDir,
  readTomlDependency,
  readPackageEntry,
  resolveImportTarget,
  AlyaDocumentLinkProvider,
  type FileProbe,
} from "../src/documentLinks";

// OS-portable fixture root: absolute on any platform (`path.resolve`
// yields `C:\...` on Windows, `/...` elsewhere).
const ROOT = path.resolve("link-fixture");
const P = (...segs: string[]) => path.join(ROOT, ...segs);
// Normalizes separators for assertions (`C:\a` and `C:/a` compare equal).
const N = (p: string | undefined) =>
  p === undefined ? undefined : p.replace(/\\/g, "/");
const NS = (...segs: string[]) => N(path.join(...segs)) as string;

function fakeProbe(files: Record<string, string>): FileProbe {
  const norm = (p: string) => p.replace(/\\/g, "/");
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(files)) {
    map.set(norm(k), v);
  }
  const dirs = new Set<string>();
  for (const k of map.keys()) {
    let d = k.slice(0, k.lastIndexOf("/"));
    while (d.length > 0 && !dirs.has(d)) {
      dirs.add(d);
      d = d.slice(0, d.lastIndexOf("/"));
    }
  }
  return {
    isFile: (p) => map.has(norm(p)),
    readFile: (p) => map.get(norm(p)),
    listDir: (p) => {
      const prefix = norm(p) + "/";
      const out: string[] = [];
      const seen = new Set<string>();
      for (const k of [...map.keys(), ...dirs]) {
        if (k.startsWith(prefix)) {
          const rest = k.slice(prefix.length);
          const head = rest.split("/")[0];
          if (head !== undefined && head.length > 0 && !seen.has(head)) {
            seen.add(head);
            out.push(head);
          }
        }
      }
      return out;
    },
  };
}

describe("findImportOnLine", () => {
  it("finds quoted paths on import lines", () => {
    expect(findImportOnLine(`import "../src/lib.alya" as pkg`)).toEqual({
      path: "../src/lib.alya",
      pathStart: 8,
      pathEnd: 23,
    });
  });

  it("finds quoted paths on from-import lines", () => {
    expect(findImportOnLine(`from "std/fs" import x`)).toEqual({
      path: "std/fs",
      pathStart: 6,
      pathEnd: 12,
    });
  });

  it("supports single quotes and indentation", () => {
    expect(findImportOnLine(`  import 'cache' as c`)).toEqual({
      path: "cache",
      pathStart: 10,
      pathEnd: 15,
    });
  });

  it("ignores non-import lines and unquoted paths", () => {
    expect(findImportOnLine(`say "hello"`)).toBeUndefined();
    expect(findImportOnLine(`import cache`)).toBeUndefined();
    expect(findImportOnLine(`# import "x"`)).toBeUndefined();
  });
});

describe("canonicalStdModule", () => {
  it("mirrors the compiler alias table", () => {
    expect(canonicalStdModule("rand")).toBe("math");
    expect(canonicalStdModule("term")).toBe("console");
    expect(canonicalStdModule("glob")).toBe("path");
    expect(canonicalStdModule("threads")).toBe("sync");
    expect(canonicalStdModule("bench")).toBe("test");
    expect(canonicalStdModule("fs")).toBe("fs");
  });
});

describe("manifest helpers", () => {
  const manifest = [
    "[package]",
    `name = "app"`,
    "",
    "[dependencies]",
    `cache = { git = "https://github.com/alya-lang/cache", branch = "main" }`,
    `local = { path = "../libs/local" }`,
    `ver = "2.1.0"`,
  ].join("\n");

  it("reads path and remote dependencies", () => {
    expect(readTomlDependency(manifest, "local")).toEqual({
      kind: "path",
      path: "../libs/local",
    });
    expect(readTomlDependency(manifest, "cache")).toEqual({
      kind: "remote",
      major: undefined,
    });
    expect(readTomlDependency(manifest, "ver")).toEqual({
      kind: "remote",
      major: 2,
    });
    expect(readTomlDependency(manifest, "missing")).toBeUndefined();
  });

  it("reads package entry fields", () => {
    expect(readPackageEntry("[package]\nentry = \"src/lib.alya\"\n")).toBe(
      "src/lib.alya"
    );
    expect(readPackageEntry("[package]\nname = \"x\"\n")).toBeUndefined();
  });

  it("walks up to find alya.toml", () => {
    const probe = fakeProbe({
      [P("proj", "alya.toml")]: "",
      [P("proj", "src", "a.alya")]: "",
    });
    expect(N(findManifestDir(P("proj", "src"), probe))).toBe(
      NS(ROOT, "proj")
    );
    expect(findManifestDir(P("nope", "deep"), probe)).toBeUndefined();
  });
});

describe("resolveImportTarget", () => {
  const F = (rel: string, content: string): [string, string] => [
    N(P(...rel.split("/"))) as string,
    content,
  ];
  const files: Record<string, string> = Object.fromEntries([
    F("proj/alya.toml", `[package]\nname = "app"\n[dependencies]\ncache = { git = "https://x", branch = "main" }\nver = "2.1.0"\nloc = { path = "../libs/loc" }\n`),
    F("proj/src/main.alya", ""),
    F("proj/src/helper.alya", ""),
    F("proj/src/stdlib/fs.alya", ""),
    F("proj/.alya/packages/cache/alya.toml", `[package]\nname = "cache"\nentry = "src/lib.alya"\n`),
    F("proj/.alya/packages/cache/src/lib.alya", ""),
    F("proj/.alya/packages/cache/src/extra.alya", ""),
    F("proj/.alya/packages/ver-v2/alya.toml", `[package]\nname = "ver"\n`),
    F("proj/.alya/packages/ver-v2/src/lib.alya", ""),
    F("libs/loc/alya.toml", `[package]\nname = "loc"\n`),
    F("libs/loc/src/main.alya", ""),
  ]);
  const probe = fakeProbe(files);
  const SRC = P("proj", "src");

  it("resolves relative paths with extension fallback", () => {
    expect(N(resolveImportTarget("./helper", SRC, [], probe))).toBe(
      NS(ROOT, "proj/src/helper.alya")
    );
    expect(N(resolveImportTarget("./helper.alya", SRC, [], probe))).toBe(
      NS(ROOT, "proj/src/helper.alya")
    );
    expect(resolveImportTarget("./ghost", SRC, [], probe)).toBeUndefined();
  });

  it("resolves std modules against nearby stdlib roots", () => {
    expect(N(resolveImportTarget("std/fs", SRC, [], probe))).toBe(
      NS(ROOT, "proj/src/stdlib/fs.alya")
    );
    // Embedded-only module: no on-disk file, no link.
    expect(resolveImportTarget("std/nope_xyz", SRC, [], probe)).toBeUndefined();
  });

  it("resolves installed packages via manifest entry", () => {
    expect(N(resolveImportTarget("cache", SRC, [], probe))).toBe(
      NS(ROOT, "proj/.alya/packages/cache/src/lib.alya")
    );
    expect(N(resolveImportTarget("cache/extra", SRC, [], probe))).toBe(
      NS(ROOT, "proj/.alya/packages/cache/src/extra.alya")
    );
    expect(resolveImportTarget("cache/ghost", SRC, [], probe)).toBeUndefined();
  });

  it("prefers version-segregated package dirs", () => {
    expect(N(resolveImportTarget("ver", SRC, [], probe))).toBe(
      NS(ROOT, "proj/.alya/packages/ver-v2/src/lib.alya")
    );
  });

  it("resolves path dependencies", () => {
    expect(N(resolveImportTarget("loc", SRC, [], probe))).toBe(
      NS(ROOT, "libs/loc/src/main.alya")
    );
  });

  it("returns undefined without a manifest", () => {
    expect(
      resolveImportTarget("cache", P("nomani"), [], probe)
    ).toBeUndefined();
  });
});

describe("AlyaDocumentLinkProvider", () => {
  it("emits links only for resolvable imports", () => {
    const manifestPath = N(P("proj2", "alya.toml")) as string;
    const mainPath = P("proj2", "src", "main.alya");
    const probe = fakeProbe({
      [manifestPath]: `[package]\nname = "app"\n`,
      [N(mainPath) as string]: "",
      [N(P("proj2", "src", "helper.alya")) as string]: "",
    });
    const provider = new AlyaDocumentLinkProvider(probe);
    const lines = [
      `import "./helper.alya" as h`,
      `import "./ghost.alya"`,
      `say "done"`,
    ];
    const document = {
      uri: { fsPath: mainPath },
      lineCount: lines.length,
      lineAt: (i: number) => ({ text: lines[i] }),
    };
    const links = provider.provideDocumentLinks(document as never, null as never);
    expect(Array.isArray(links)).toBe(true);
    const arr = links as Array<{ range: unknown; target: unknown }>;
    expect(arr.length).toBe(1);
  });
});
