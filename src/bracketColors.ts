import * as vscode from "vscode";

/**
 * Rainbow brackets toggle.
 *
 * Bracket coloring itself is VSCode's native bracket-pair engine (enabled
 * for Alya by default via `configurationDefaults`, themed through
 * `editorBracketHighlight.*`). This toggle mirrors `alya.rainbowBrackets`
 * into the `[alya]`-scoped native setting, so users get an in-extension
 * on/off switch without touching global preferences. It only writes when
 * the user flips this setting — never on activation.
 */

export const RAINBOW_SETTING_SECTION = "alya";
export const RAINBOW_SETTING_KEY = "rainbowBrackets";

export interface EditorConfigShim {
  update(section: string, value: unknown, target: unknown): any;
}

export interface VscodeShim {
  workspace: {
    getConfiguration(
      section?: string,
      scope?: unknown
    ): EditorConfigShim & {
      get<T>(key: string, defaultValue: T): T;
    };
    onDidChangeConfiguration(
      listener: (e: { affectsConfiguration(section: string): boolean }) => void
    ): vscode.Disposable;
  };
  ConfigurationTarget: { Global: unknown };
}

/** One-way sync: our toggle -> native `[alya]` bracket colorization. */
export async function syncRainbowBrackets(
  vscodeNs: VscodeShim,
  enabled: boolean
): Promise<void> {
  const editor = vscodeNs.workspace.getConfiguration("editor", {
    languageId: "alya",
  });
  await editor.update(
    "bracketPairColorization.enabled",
    enabled,
    vscodeNs.ConfigurationTarget.Global
  );
}

/** Listens for `alya.rainbowBrackets` changes and mirrors them natively. */
export function registerRainbowBracketsToggle(
  vscodeNs: VscodeShim
): vscode.Disposable {
  return vscodeNs.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(`${RAINBOW_SETTING_SECTION}.${RAINBOW_SETTING_KEY}`)) {
      const enabled = vscodeNs.workspace
        .getConfiguration(RAINBOW_SETTING_SECTION)
        .get<boolean>(RAINBOW_SETTING_KEY, true);
      void syncRainbowBrackets(vscodeNs, enabled);
    }
  });
}
