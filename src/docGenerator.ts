import * as vscode from "vscode";
import { buildDocstringSnippet, parseTargetDefinition } from "./docParser";

export function registerDocGenerator(context: vscode.ExtensionContext) {
  // 1. Primary command: alya.generateDocstring (Keybinding: Ctrl+Alt+D)
  const cmd = vscode.commands.registerCommand(
    "alya.generateDocstring",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const document = editor.document;
      const position = editor.selection.active;
      const lines = document.getText().split(/\r?\n/);

      const target = parseTargetDefinition(lines, position.line);
      if (!target) {
        vscode.window.showInformationMessage(
          vscode.l10n.t(
            "Place cursor on or above a function, struct, enum, or interface to generate documentation."
          )
        );
        return;
      }

      const snippetText = buildDocstringSnippet(target);
      if (snippetText) {
        const insertPos = new vscode.Position(target.insertLine, 0);
        await editor.insertSnippet(
          new vscode.SnippetString(snippetText),
          insertPos
        );
      }
    }
  );

  // 2. Lightbulb CodeAction provider (Refactor / Quick Assist)
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    "alya",
    {
      provideCodeActions(document, range) {
        const lines = document.getText().split(/\r?\n/);
        const target = parseTargetDefinition(lines, range.start.line);
        if (!target) {
          return [];
        }

        const action = new vscode.CodeAction(
          vscode.l10n.t("Generate Docstring for {0}", target.name),
          vscode.CodeActionKind.RefactorRewrite
        );
        action.command = {
          command: "alya.generateDocstring",
          title: vscode.l10n.t("Generate Alya Docstring"),
        };
        return [action];
      },
    },
    {
      providedCodeActionKinds: [vscode.CodeActionKind.RefactorRewrite],
    }
  );

  context.subscriptions.push(cmd, codeActionProvider);
}
