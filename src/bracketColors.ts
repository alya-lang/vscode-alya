import * as vscode from "vscode";
import {
  mirrorEditorBoolean,
  registerAlyaMirror,
  type VscodeShim,
} from "./editorSync";

export type { EditorConfigShim, VscodeShim } from "./editorSync";

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

/** One-way sync: our toggle -> native `[alya]` bracket colorization. */
export async function syncRainbowBrackets(
  vscodeNs: VscodeShim,
  enabled: boolean
): Promise<void> {
  return mirrorEditorBoolean(vscodeNs, "bracketPairColorization.enabled", enabled);
}

/** Listens for `alya.rainbowBrackets` changes and mirrors them natively. */
export function registerRainbowBracketsToggle(
  vscodeNs: VscodeShim
): vscode.Disposable {
  return registerAlyaMirror(vscodeNs, RAINBOW_SETTING_KEY, "bracketPairColorization.enabled");
}
