import * as vscode from "vscode";

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
};

/**
 * One-way mirrors of `alya.*` toggles into `[alya]`-scoped native editor
 * settings. They only write when the user flips our setting — never on
 * activation — so global preferences stay untouched.
 */

/** Writes an `[alya]`-scoped boolean editor setting. */
export async function mirrorEditorBoolean(
  vscodeNs: VscodeShim,
  editorKey: string,
  enabled: boolean
): Promise<void> {
  const editor = vscodeNs.workspace.getConfiguration("editor", {
    languageId: "alya",
  });
  await editor.update(
    editorKey,
    enabled,
    vscodeNs.ConfigurationTarget.Global
  );
}

/** Listens for an `alya.*` toggle and mirrors it into the editor setting. */
export function registerAlyaMirror(
  vscodeNs: VscodeShim,
  alyaKey: string,
  editorKey: string
): vscode.Disposable {
  return vscodeNs.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(`alya.${alyaKey}`)) {
      const enabled = vscodeNs.workspace
        .getConfiguration("alya")
        .get<boolean>(alyaKey, true);
      void mirrorEditorBoolean(vscodeNs, editorKey, enabled);
    }
  });
}

/** `alya.inlayHints.enabled` -> native `[alya]` inlay hints. */
export function syncInlayHints(
  vscodeNs: VscodeShim,
  enabled: boolean
): Promise<void> {
  return mirrorEditorBoolean(vscodeNs, "inlayHints.enabled", enabled);
}

/** Keeps inlay hints following the Alya toggle. */
export function registerInlayHintsToggle(
  vscodeNs: VscodeShim
): vscode.Disposable {
  return registerAlyaMirror(vscodeNs, "inlayHints.enabled", "inlayHints.enabled");
}
