import { describe, it, expect } from "bun:test";
import {
  resolvePlatform,
  parseCompilerVersion,
  normalizeTag,
  assetName,
  siblingLspPath,
} from "../src/compilerManager";

describe("resolvePlatform", () => {
  it("maps supported OS/arch pairs to release assets", () => {
    expect(resolvePlatform("win32", "x64")).toEqual({
      platform: "x86_64-windows",
      archive: "zip",
    });
    expect(resolvePlatform("win32", "arm64")).toEqual({
      platform: "arm64-windows",
      archive: "zip",
    });
    expect(resolvePlatform("linux", "x64")).toEqual({
      platform: "x86_64-linux",
      archive: "tar.gz",
    });
    expect(resolvePlatform("linux", "arm64")).toEqual({
      platform: "arm64-linux",
      archive: "tar.gz",
    });
    expect(resolvePlatform("darwin", "x64")).toEqual({
      platform: "x86_64-macos",
      archive: "tar.gz",
    });
    expect(resolvePlatform("darwin", "arm64")).toEqual({
      platform: "arm64-macos",
      archive: "tar.gz",
    });
  });

  it("returns null for unsupported combinations", () => {
    expect(resolvePlatform("freebsd", "x64")).toBeNull();
    expect(resolvePlatform("win32", "ia32")).toBeNull();
  });
});

describe("parseCompilerVersion", () => {
  it("parses `alya --version` output", () => {
    expect(parseCompilerVersion("alya 0.0.20 (windows-x86_64)")).toBe("0.0.20");
  });

  it("returns null when no version is present", () => {
    expect(parseCompilerVersion("not a compiler")).toBeNull();
    expect(parseCompilerVersion("")).toBeNull();
  });
});

describe("normalizeTag", () => {
  it("adds a missing v prefix", () => {
    expect(normalizeTag("0.0.21")).toBe("v0.0.21");
    expect(normalizeTag("v0.0.21")).toBe("v0.0.21");
  });
});

describe("assetName", () => {
  it("matches the release packaging convention", () => {
    expect(
      assetName("v0.0.21", { platform: "x86_64-windows", archive: "zip" })
    ).toBe("alya-v0.0.21-x86_64-windows.zip");
    expect(
      assetName("v0.0.21", { platform: "arm64-macos", archive: "tar.gz" })
    ).toBe("alya-v0.0.21-arm64-macos.tar.gz");
  });
});

describe("siblingLspPath", () => {
  it("derives the standalone server next to alya", () => {
    expect(siblingLspPath("/usr/local/bin/alya")).toBe(
      "/usr/local/bin/alya-lsp"
    );
    expect(siblingLspPath("C:/tools/alya.exe")).toBe(
      "C:/tools/alya-lsp.exe"
    );
  });
});
