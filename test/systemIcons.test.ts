import { describe, it, expect } from "bun:test";
import {
  registerSystemFileIcons,
  type IconsRunner,
  type SystemIconsVscodeShim,
} from "../src/systemIcons";

function stubVscode(calls: unknown[]): SystemIconsVscodeShim {
  return {
    workspace: {
      getConfiguration: (_section?: string) => ({
        get: (_key: string, defaultValue: any) => defaultValue as never,
      }),
    },
    window: {
      showInformationMessage: (message: string) => {
        calls.push({ kind: "info", message });
        return undefined;
      },
      showErrorMessage: (message: string) => {
        calls.push({ kind: "error", message });
        return undefined;
      },
    },
    commands: {
      registerCommand: (command: string, callback: (...args: unknown[]) => unknown) => {
        calls.push({ kind: "register", command });
        (stubVscode as any).callback = callback;
        return { dispose: () => {} } as never;
      },
    },
    l10n: {
      t: (message: string, ...args: Array<string | number | boolean>) => {
        let out = message;
        for (const a of args) {
          out = out.replace("{0}", String(a));
        }
        return out;
      },
    },
  } as unknown as SystemIconsVscodeShim;
}

function activateWith(runner: IconsRunner, calls: unknown[]): void {
  const context = { subscriptions: [] as unknown[] } as any;
  registerSystemFileIcons(stubVscode(calls), context, runner);
  expect(context.subscriptions.length).toBe(1);
  const callback = (stubVscode as any).callback as () => void;
  callback();
}

describe("registerSystemFileIcons", () => {
  it("registers the command and reports success", () => {
    const calls: unknown[] = [];
    let seenPath = "";
    activateWith(
      (alyaPath) => {
        seenPath = alyaPath;
        return { ok: true, output: "Registered." };
      },
      calls
    );
    expect(seenPath).toBe("alya");
    expect(
      calls.some(
        (c: any) => c.kind === "register" && c.command === "alya.registerSystemFileIcons"
      )
    ).toBe(true);
    expect(
      calls.some(
        (c: any) =>
          c.kind === "info" && String(c.message).includes("Alya file icons")
      )
    ).toBe(true);
  });

  it("surfaces CLI failures as errors", () => {
    const calls: unknown[] = [];
    activateWith(() => ({ ok: false, output: "denied" }), calls);
    const err = calls.find((c: any) => c.kind === "error") as any;
    expect(err).toBeDefined();
    expect(String(err.message)).toContain("denied");
  });

  it("uses the configured alya path", () => {
    const calls: unknown[] = [];
    const custom = {
      ...stubVscode(calls),
      workspace: {
        getConfiguration: (_section?: string) => ({
          get: (_key: string, _defaultValue: any) =>
            "D:/tools/alya.exe" as never,
        }),
      },
    } as unknown as SystemIconsVscodeShim;
    let seenPath = "";
    const context = { subscriptions: [] as unknown[] } as any;
    registerSystemFileIcons(
      custom,
      context,
      (alyaPath) => {
        seenPath = alyaPath;
        return { ok: true, output: "" };
      }
    );
    const callback = (stubVscode as any).callback as () => void;
    callback();
    expect(seenPath).toBe("D:/tools/alya.exe");
  });
});
