import * as vscode from "vscode";

export function registerDocGenerator(context: vscode.ExtensionContext) {
  const cmd = vscode.commands.registerCommand(
    "alya.generateDocstring",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const document = editor.document;
      const position = editor.selection.active;
      const targetLine = position.line;

      // Look at current line or up to 4 lines down for a function/struct
      let foundLine = -1;
      let targetText = "";
      for (
        let i = targetLine;
        i < Math.min(targetLine + 5, document.lineCount);
        i++
      ) {
        const line = document.lineAt(i).text.trim();
        if (
          /^(?:pub\s+)?(?:function|fn|struct|enum|interface)\b/.test(line)
        ) {
          foundLine = i;
          targetText = line;
          break;
        }
      }

      if (foundLine === -1) {
        vscode.window.showInformationMessage(
          "Place cursor on or above a function, struct, or enum to generate documentation."
        );
        return;
      }

      const indent = document.lineAt(foundLine).text.match(/^\s*/)?.[0] || "";
      let snippetText = "";

      // 1. Function docstring parsing
      const fnMatch = targetText.match(
        /^(?:pub\s+)?(?:function|fn)\s+([a-zA-Z0-9_]+)\s*\((.*?)\)(?:\s*->\s*([a-zA-Z0-9_\[\]\?]+))?/
      );
      if (fnMatch) {
        const fnName = fnMatch[1];
        const rawParams = fnMatch[2].trim();
        const retType = fnMatch[3]?.trim();

        const params = rawParams
          ? rawParams
              .split(",")
              .map((p) => {
                const parts = p.trim().split(":");
                return {
                  name: parts[0].trim(),
                  type: parts[1]?.trim(),
                };
              })
              .filter((p) => p.name.length > 0)
          : [];

        let tabIndex = 1;
        snippetText += `${indent}## \${${tabIndex++}:Summary of ${fnName}.}\n`;
        snippetText += `${indent}##\n`;

        if (params.length > 0) {
          snippetText += `${indent}## ### Parameters\n`;
          for (const p of params) {
            const typeStr = p.type ? ` (${p.type})` : "";
            snippetText += `${indent}## - \`${p.name}\`${typeStr}: \${${tabIndex++}:Description.}\n`;
          }
          snippetText += `${indent}##\n`;
        }

        if (retType && retType.toLowerCase() !== "void") {
          snippetText += `${indent}## ### Returns\n`;
          snippetText += `${indent}## \${${tabIndex++}:Returns ${retType}.}\n`;
        }
      }

      // 2. Struct docstring parsing
      const structMatch = targetText.match(
        /^(?:pub\s+)?struct\s+([a-zA-Z0-9_]+)/
      );
      if (structMatch) {
        const structName = structMatch[1];
        snippetText += `${indent}## \${1:Represents ${structName}.}\n`;
        snippetText += `${indent}##\n`;
        snippetText += `${indent}## ### Fields\n`;
        snippetText += `${indent}## - \`\${2:field}\`: \${3:Description.}\n`;
      }

      // 3. Enum docstring parsing
      const enumMatch = targetText.match(
        /^(?:pub\s+)?enum\s+([a-zA-Z0-9_]+)/
      );
      if (enumMatch) {
        const enumName = enumMatch[1];
        snippetText += `${indent}## \${1:Defines ${enumName} variants.}\n`;
      }

      if (snippetText) {
        const insertPos = new vscode.Position(foundLine, 0);
        await editor.insertSnippet(
          new vscode.SnippetString(snippetText),
          insertPos
        );
      }
    }
  );

  context.subscriptions.push(cmd);
}
