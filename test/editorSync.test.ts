import { describe, it, expect } from "bun:test";
import {
  mirrorEditorBoolean,
  registerAlyaMirror,
  syncInlayHints,
  registerInlayHintsToggle,
  type VscodeShim,
} from "../src/editorSync";

function stub(calls: unknown[], values: Record<string, any> = {}) {
  (stub as any).scopes = [];
  (stub as any).edScopes = [];
  return {
    workspace: {
      getConfiguration: (_section?: string, _scope?: unknown) => {
        if (_section === "alya") {
          (stub as any).scopes.push({ section: _section, scope: _scope });
        } else {
          (stub as any).edScopes.push({ section: _section, scope: _scope });
        }
        return {
          get: (key: string, dflt?: any) => {
            const hit = values[key];
            return (hit !== undefined ? hit : dflt) as never;
          },
          update: (section: string, value: unknown, target: unknown) => {
            calls.push({ section, value, target });
            return Promise.resolve();
          },
        };
      },
      onDidChangeConfiguration: (listener: (e: any) => void) => {
        (stub as any).listener = listener;
        return { dispose: () => {} };
      },
    },
    ConfigurationTarget: { Global: "GLOBAL" },
  } as unknown as VscodeShim;
}

describe("mirrorEditorBoolean", () => {
  it("writes the [alya]-scoped editor setting", async () => {
    (stub as any).edScopes = [];
    const calls: unknown[] = [];
    await mirrorEditorBoolean(stub(calls), "inlayHints.enabled", false);
    expect((stub as any).edScopes).toContainEqual({
      section: "editor",
      scope: { languageId: "alya" },
    });
    expect(calls).toEqual([
      { section: "inlayHints.enabled", value: false, target: "GLOBAL" },
    ]);
  });
});

describe("registerAlyaMirror", () => {
  it("forwards only its own toggle flips", async () => {
    (stub as any).edScopes = [];
    const calls: unknown[] = [];
    const s = stub(calls, { "inlayHints.enabled": false });
    registerAlyaMirror(s, "inlayHints.enabled", "inlayHints.enabled");
    const listener = (stub as any).listener;
    listener({ affectsConfiguration: (_s: string) => false });
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.length).toBe(0);
    listener({
      affectsConfiguration: (x: string) => x === "alya.inlayHints.enabled",
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([
      { section: "inlayHints.enabled", value: false, target: "GLOBAL" },
    ]);
  });
});

describe("syncInlayHints", () => {
  it("delegates to the generic mirror", async () => {
    (stub as any).edScopes = [];
    const calls: unknown[] = [];
    await syncInlayHints(stub(calls), true);
    expect(calls).toEqual([
      { section: "inlayHints.enabled", value: true, target: "GLOBAL" },
    ]);
    const disp = registerInlayHintsToggle(stub(calls));
    expect(typeof disp.dispose).toBe("function");
  });
});
