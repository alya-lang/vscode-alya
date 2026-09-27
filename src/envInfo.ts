import * as cp from "child_process";
import * as vscode from "vscode";

/**
 * `Alya: Show Environment Info` command.
 *
 * Prints versions and color-relevant settings into the "Alya" output
 * channel so coloring/navigation issues can be triaged without guessing:
 * extension version, LSP server path, active color theme, global and
 * `[alya]`-scoped bracket colorization, and the rainbow toggle.
 */

export interface EnvVscodeShim {
  extensions: {
    getExtension(
      id: string
    ): { packageJSON: { version?: string } } | undefined;
  };
  workspace: {
    getConfiguration(
      section?: string,
      scope?: unknown
    ): {
      get<T>(key: string, defaultValue?: T): T | undefined;
    };
  };
  window: {
    activeTextEditor?: { document: { languageId: string } };
    createOutputChannel(name: string): {
      clear(): void;
      appendLine(line: string): void;
      show(preserveFocus?: boolean): void;
    };
  };
  commands: {
    registerCommand(
      command: string,
      callback: (...args: unknown[]) => unknown
    ): vscode.Disposable;
  };
}

function valueText(value: unknown): string {
  if (value === undefined) {
    return "unset";
  }
  return JSON.stringify(value) ?? String(value);
}

/**
 * Definitive server-age probe: runs `<lsp-path> fmt --help` and checks for
 * the `--sort-imports` flag (shipped with the coloring fixes). Version
 * strings cannot tell dev builds apart; this can.
 */
export function probeBinarySortImports(
  runHelp: () => string | undefined
): string {
  try {
    const out = runHelp();
    if (out === undefined) {
      return "unknown (probe failed)";
    }
    return out.includes("--sort-imports") ? "yes" : "no (stale binary)";
  } catch {
    return "unknown (probe failed)";
  }
}

/** Pure info collector: easy to unit test, no VSCode writes. */
export function collectEnvInfo(
  vscodeNs: EnvVscodeShim,
  binaryInfo?: string
): string[] {
  const version =
    vscodeNs.extensions.getExtension("alya-lang.alya-lsp")?.packageJSON
      .version ?? "unknown";
  const lspPath = vscodeNs.workspace
    .getConfiguration("alya")
    .get<string>("lsp.path", "alya");
  const colorTheme = vscodeNs.workspace
    .getConfiguration("workbench")
    .get<string>("colorTheme");
  const bracketGlobal = vscodeNs.workspace
    .getConfiguration("editor")
    .get("bracketPairColorization.enabled");
  const doc = vscodeNs.window.activeTextEditor?.document;
  const scope =
    doc !== undefined && doc.languageId === "alya"
      ? doc
      : { languageId: "alya" };
  const bracketAlya = vscodeNs.workspace
    .getConfiguration("editor", scope)
    .get("bracketPairColorization.enabled");
  const rainbow = vscodeNs.workspace
    .getConfiguration("alya")
    .get<boolean>("rainbowBrackets", true);
  const semantic = vscodeNs.workspace
    .getConfiguration("editor")
    .get("semanticHighlighting.enabled");
  const serverVersion = "see `alya --version` (binary is versioned separately)";
  return [
    `Alya extension: ${valueText(version)}`,
    `LSP server path setting: ${valueText(lspPath)}`,
    `LSP server binary: ${serverVersion}`,
    `LSP binary sort-imports support: ${valueText(binaryInfo)}`,
    `Color theme: ${valueText(colorTheme)}`,
    `editor.semanticHighlighting.enabled: ${valueText(semantic)}`,
    `editor.bracketPairColorization.enabled (global): ${valueText(bracketGlobal)}`,
    `editor.bracketPairColorization.enabled ([alya]): ${valueText(bracketAlya)}`,
    `alya.rainbowBrackets: ${valueText(rainbow)}`,
  ];
}

export function registerEnvInfoCommand(
  vscodeNs: EnvVscodeShim,
  context: vscode.ExtensionContext
): void {
  const channel = vscodeNs.window.createOutputChannel("Alya");
  context.subscriptions.push(
    vscodeNs.commands.registerCommand("alya.showEnvInfo", () => {
      const lspPath =
        vscodeNs.workspace.getConfiguration("alya").get<string>("lsp.path", "alya") ??
        "alya";
      const binaryInfo = probeBinarySortImports(() => {
        try {
          const out = cp.execFileSync(lspPath, ["fmt", "--help"], {
            timeout: 8000,
            encoding: "utf8",
            windowsHide: true,
          });
          return typeof out === "string" ? out : undefined;
        } catch {
          return undefined;
        }
      });
      channel.clear();
      for (const line of collectEnvInfo(vscodeNs, binaryInfo)) {
        channel.appendLine(line);
      }
      channel.show(true);
    }) as vscode.Disposable
  );
}
