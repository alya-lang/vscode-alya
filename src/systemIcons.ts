import * as cp from "child_process";
import * as vscode from "vscode";

/**
 * `Alya: Register System File Icons` command (Windows and Linux).
 *
 * A VS Code extension cannot change OS-level file icons by itself: the
 * system file manager gets them from the OS file association. This command
 * delegates to the compiler (`alya icons install`), which registers the
 * brand `.alya` icon without touching the current default application.
 * Per-user scope only, no elevation needed.
 */

export interface IconsRunResult {
  ok: boolean;
  output: string;
}

export type IconsRunner = (alyaPath: string) => IconsRunResult;

export function defaultIconsRunner(alyaPath: string): IconsRunResult {
  try {
    const out = cp.execFileSync(alyaPath, ["icons", "install"], {
      timeout: 30000,
      encoding: "utf8",
      windowsHide: true,
    });
    return { ok: true, output: typeof out === "string" ? out.trim() : "" };
  } catch (e) {
    const err = e as { stdout?: unknown; message?: unknown };
    const detail =
      typeof err.stdout === "string" && err.stdout.trim() !== ""
        ? err.stdout.trim()
        : String(err.message ?? e);
    return { ok: false, output: detail };
  }
}

export interface SystemIconsVscodeShim {
  workspace: {
    getConfiguration(section?: string): {
      get<T>(key: string, defaultValue?: T): T | undefined;
    };
  };
  window: {
    showInformationMessage(message: string): unknown;
    showErrorMessage(message: string): unknown;
  };
  commands: {
    registerCommand(
      command: string,
      callback: (...args: unknown[]) => unknown
    ): vscode.Disposable;
  };
  l10n: {
    t(message: string, ...args: Array<string | number | boolean>): string;
  };
}

export function registerSystemFileIcons(
  vscodeNs: SystemIconsVscodeShim,
  context: vscode.ExtensionContext,
  runner: IconsRunner = defaultIconsRunner
): void {
  context.subscriptions.push(
    vscodeNs.commands.registerCommand(
      "alya.registerSystemFileIcons",
      () => {
        const alyaPath =
          vscodeNs.workspace.getConfiguration("alya").get<string>("lsp.path", "alya") ??
          "alya";
        const result = runner(alyaPath);
        if (result.ok) {
          vscodeNs.window.showInformationMessage(
            vscodeNs.l10n.t(
              "System file managers now show Alya file icons for .alya sources."
            )
          );
        } else {
          vscodeNs.window.showErrorMessage(
            vscodeNs.l10n.t(
              "Could not register system file icons: {0}",
              result.output
            )
          );
        }
      }
    ) as vscode.Disposable
  );
}
