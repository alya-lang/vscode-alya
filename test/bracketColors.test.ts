import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  syncRainbowBrackets,
  registerRainbowBracketsToggle,
  type VscodeShim,
} from "../src/bracketColors";

function stubVscode(calls: unknown[], rainbowValue = true): VscodeShim {
  return {
    workspace: {
      getConfiguration: (_section?: string, _scope?: unknown) => {
        (stubVscode as any).scopes.push({ section: _section, scope: _scope });
        return {
          get: (_key: string, defaultValue: any) => rainbowValue as never,
          update: (section: string, value: unknown, target: unknown) => {
            calls.push({ section, value, target });
            return Promise.resolve();
          },
        };
      },
      onDidChangeConfiguration: (listener: (e: any) => void) => {
        (stubVscode as any).listener = listener;
        return { dispose: () => {} };
      },
    },
    ConfigurationTarget: { Global: "GLOBAL" },
  } as unknown as VscodeShim;
}

describe("syncRainbowBrackets", () => {
  it("mirrors the toggle into the [alya]-scoped native setting", async () => {
    (stubVscode as any).scopes = [];
    const calls: unknown[] = [];
    await syncRainbowBrackets(stubVscode(calls), false);
    expect((stubVscode as any).scopes).toContainEqual({
      section: "editor",
      scope: { languageId: "alya" },
    });
    expect(calls).toEqual([
      {
        section: "bracketPairColorization.enabled",
        value: false,
        target: "GLOBAL",
      },
    ]);
  });

  it("passes true through unchanged", async () => {
    const calls: unknown[] = [];
    await syncRainbowBrackets(stubVscode(calls), true);
    expect((calls[0] as any).value).toBe(true);
  });
});

describe("registerRainbowBracketsToggle", () => {
  it("syncs only when our setting changes", async () => {
    const calls: unknown[] = [];
    const stub = stubVscode(calls, false);
    registerRainbowBracketsToggle(stub);
    const listener = (stubVscode as any).listener;
    expect(typeof listener).toBe("function");
    // Unrelated change: no sync.
    listener({ affectsConfiguration: (_s: string) => false });
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.length).toBe(0);
    // Our setting flipped off: one sync with false.
    listener({ affectsConfiguration: (s: string) => s === "alya.rainbowBrackets" });
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.length).toBe(1);
    expect((calls[0] as any).value).toBe(false);
  });
});

describe("bracket colorization static config", () => {
  const root = path.resolve(__dirname, "..");

  it("declares brackets in the language configuration", () => {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(root, "language-configuration.json"), "utf8")
    );
    expect(cfg.brackets).toContainEqual(["(", ")"]);
    expect(cfg.brackets).toContainEqual(["[", "]"]);
    expect(cfg.brackets).toContainEqual(["{", "}"]);
  });

  it("enables native colorization for Alya by default", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8")
    );
    expect(
      pkg.contributes.configurationDefaults["[alya]"][
        "editor.bracketPairColorization.enabled"
      ]
    ).toBe(true);
    expect(
      pkg.contributes.configuration.properties["alya.rainbowBrackets"].default
    ).toBe(true);
  });

  it("scopes qualifier heads as namespace with a type fallback", () => {
    const grammar = JSON.parse(
      fs.readFileSync(
        path.join(root, "syntaxes", "alya.tmLanguage.json"),
        "utf8"
      )
    );
    expect(grammar.patterns).toEqual(
      expect.arrayContaining([{ include: "#namespaces" }])
    );
    const rule = grammar.repository["namespaces"].patterns[0];
    // Dual scope: precise `namespace` for aware themes, `type` fallback
    // so stock themes still paint qualifiers distinctly.
    expect(rule.name).toBe(
      "entity.name.namespace.alya entity.name.type.alya"
    );
  });

  it("covers backtick raw strings in the grammar", () => {
    const grammar = JSON.parse(
      fs.readFileSync(
        path.join(root, "syntaxes", "alya.tmLanguage.json"),
        "utf8"
      )
    );
    expect(grammar.patterns).toEqual(
      expect.arrayContaining([{ include: "#strings-backtick" }])
    );
    const rule = grammar.repository["strings-backtick"].patterns[0];
    expect(rule.name).toBe("string.quoted.backtick.alya");
    expect(rule.begin).toBe("`");
    expect(rule.end).toBe("`");
  });
});
