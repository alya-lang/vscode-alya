import { describe, it, expect } from "bun:test";
import {
  collectEnvInfo,
  registerEnvInfoCommand,
  type EnvVscodeShim,
} from "../src/envInfo";

function stubEnv(overrides: Record<string, any> = {}): EnvVscodeShim {
  const values: Record<string, any> = {
    "alya|lsp.path": "custom-alya",
    "workbench|colorTheme": "One Dark Pro",
    "editor|bracketPairColorization.enabled": true,
    "editor[alya]|bracketPairColorization.enabled": false,
    "alya|rainbowBrackets": true,
    ...overrides,
  };
  return {
    extensions: {
      getExtension: (id: string) =>
        id === "alya-lang.alya-lsp"
          ? { packageJSON: { version: "0.10.0-test" } }
          : undefined,
    },
    workspace: {
      getConfiguration: (section?: string, scope?: any) => ({
        get: (key: string, dflt?: any) => {
          const lang =
            scope !== undefined &&
            scope !== null &&
            typeof scope === "object" &&
            typeof scope.languageId === "string"
              ? `[${scope.languageId}]`
              : "";
          const lookup = lang !== "" ? `${section}${lang}|${key}` : `${section}|${key}`;
          const hit = values[lookup];
          return (hit !== undefined ? hit : dflt) as never;
        },
      }),
    },
    window: {
      activeTextEditor: undefined,
      createOutputChannel: (_name: string) => ({
        clear: () => {},
        appendLine: () => {},
        show: () => {},
      }),
    },
    commands: {
      registerCommand: (_command: string, _callback: (...a: unknown[]) => unknown) => ({
        dispose: () => {},
      }),
    },
  } as unknown as EnvVscodeShim;
}

describe("collectEnvInfo", () => {
  it("reports versions, theme, and bracket settings", () => {
    const lines = collectEnvInfo(stubEnv());
    const text = lines.join("\n");
    expect(text).toContain("0.10.0-test");
    expect(text).toContain("custom-alya");
    expect(text).toContain("One Dark Pro");
    expect(text).toContain("[alya]");
  });

  it("marks missing values as unset instead of crashing", () => {
    const lines = collectEnvInfo(stubEnv({ "workbench|colorTheme": undefined }));
    expect(lines.join("\n")).toContain("unset");
  });
});

describe("registerEnvInfoCommand", () => {
  it("writes the report into the Alya output channel", () => {
    const appended: string[] = [];
    let shown = false;
    const stub = stubEnv() as any;
    stub.window.createOutputChannel = (_name: string) => ({
      clear: () => {},
      appendLine: (line: string) => appended.push(line),
      show: () => {
        shown = true;
      },
    });
    let registered = "";
    stub.commands.registerCommand = (command: string, _cb: unknown) => {
      registered = command;
      return { dispose: () => {} };
    };
    registerEnvInfoCommand(stub, { subscriptions: [] } as never);
    expect(registered).toBe("alya.showEnvInfo");
    // Invoke the command callback through a fresh registration capture.
    const cbs: Array<() => void> = [];
    stub.commands.registerCommand = (_c: string, cb: () => void) => {
      cbs.push(cb);
      return { dispose: () => {} };
    };
    registerEnvInfoCommand(stub, { subscriptions: [] } as never);
    cbs[0]();
    expect(shown).toBe(true);
    expect(appended.length).toBeGreaterThan(4);
    expect(appended[0]).toContain("Alya extension");
  });
});
