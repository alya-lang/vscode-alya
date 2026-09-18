import * as cp from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";

import { AlyaAssemblyViewer } from "./assemblyViewer";
import { registerDocGenerator } from "./docGenerator";
import { AlyaStatusBar } from "./statusBar";
import { AlyaTestController } from "./testController";

let client: LanguageClient | undefined;
let alyaTerminal: vscode.Terminal | undefined;

function getAlyaTerminal(): vscode.Terminal {
  if (!alyaTerminal || alyaTerminal.exitStatus !== undefined) {
    alyaTerminal = vscode.window.createTerminal("Alya");
  }
  return alyaTerminal;
}

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("alya");
  const serverPath = config.get<string>("lsp.path") || "alya";
  const serverArgs = config.get<string[]>("lsp.arguments") || ["lsp"];

  // 1. Status Bar Item
  const statusBar = new AlyaStatusBar(context, serverPath);

  // 2. Assembly & AST Inspector
  const assemblyViewer = new AlyaAssemblyViewer(serverPath);

  // 3. Official Test Explorer Controller
  new AlyaTestController(context, serverPath);

  // 4. Automatic Docstring & Summary Generator
  registerDocGenerator(context);

  // 5. Initialize LSP Client
  function startLspClient() {
    const serverOptions: ServerOptions = {
      run: { command: serverPath, args: serverArgs },
      debug: { command: serverPath, args: serverArgs },
    };

    const clientOptions: LanguageClientOptions = {
      documentSelector: [{ scheme: "file", language: "alya" }],
      synchronize: {
        fileEvents: vscode.workspace.createFileSystemWatcher("**/*.alya"),
      },
    };

    client = new LanguageClient(
      "alya-lsp",
      "Alya Language Server",
      serverOptions,
      clientOptions
    );

    client.start().then(
      () => statusBar.setLspStatus("Ready"),
      () => statusBar.setLspStatus("Error")
    );
  }

  startLspClient();

  // 5. Document Formatting Provider (`alya fmt`)
  const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider(
    "alya",
    {
      provideDocumentFormattingEdits(
        document: vscode.TextDocument
      ): Promise<vscode.TextEdit[]> {
        return new Promise((resolve) => {
          const originalText = document.getText();
          const tempDir = os.tmpdir();
          const tempFile = path.join(
            tempDir,
            `alya_fmt_${Date.now()}_${Math.random().toString(36).substring(7)}.alya`
          );

          try {
            fs.writeFileSync(tempFile, originalText, "utf8");
          } catch {
            return resolve([]);
          }

          cp.execFile(serverPath, ["fmt", tempFile], (err) => {
            try {
              if (!err && fs.existsSync(tempFile)) {
                const formatted = fs.readFileSync(tempFile, "utf8");
                fs.unlinkSync(tempFile);

                if (formatted !== originalText) {
                  const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(originalText.length)
                  );
                  return resolve([vscode.TextEdit.replace(fullRange, formatted)]);
                }
              }
            } catch {
              // Ignore
            } finally {
              if (fs.existsSync(tempFile)) {
                try {
                  fs.unlinkSync(tempFile);
                } catch {
                  // Ignore
                }
              }
            }
            resolve([]);
          });
        });
      },
    }
  );

  // 6. CodeLens Provider (`function main()` -> Run, `test "..."` -> Run Test)
  const codeLensProvider = vscode.languages.registerCodeLensProvider("alya", {
    provideCodeLenses(
      document: vscode.TextDocument
    ): vscode.ProviderResult<vscode.CodeLens[]> {
      const lenses: vscode.CodeLens[] = [];
      const lines = document.getText().split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (/^\s*(?:pub\s+)?function\s+main\s*\(/.test(line)) {
          const range = new vscode.Range(i, 0, i, line.length);
          lenses.push(
            new vscode.CodeLens(range, {
              title: "$(play) Run",
              tooltip: "Run this file with alya run",
              command: "alya.runFile",
              arguments: [document.uri],
            })
          );
        }

        const testMatch = line.match(/^\s*test\s+"([^"]+)"/);
        if (testMatch) {
          const range = new vscode.Range(i, 0, i, line.length);
          lenses.push(
            new vscode.CodeLens(range, {
              title: "$(beaker) Run Test",
              tooltip: `Run test: ${testMatch[1]}`,
              command: "alya.runTest",
              arguments: [document.uri],
            })
          );
        }
      }

      return lenses;
    },
  });

  // 7. Interactive Commands
  const runFileCmd = vscode.commands.registerCommand(
    "alya.runFile",
    (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (!targetUri) {
        vscode.window.showErrorMessage("No active Alya file to run.");
        return;
      }
      const terminal = getAlyaTerminal();
      terminal.show();
      terminal.sendText(`alya run "${targetUri.fsPath}"`);
    }
  );

  const runTestCmd = vscode.commands.registerCommand(
    "alya.runTest",
    (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      const targetPath = targetUri ? `"${targetUri.fsPath}"` : "";
      const terminal = getAlyaTerminal();
      terminal.show();
      terminal.sendText(`alya test ${targetPath}`.trim());
    }
  );

  const openReplCmd = vscode.commands.registerCommand("alya.openRepl", () => {
    const terminal = getAlyaTerminal();
    terminal.show();
    terminal.sendText("alya repl");
  });

  const showDocCmd = vscode.commands.registerCommand(
    "alya.showDoc",
    (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      const targetPath = targetUri ? `"${targetUri.fsPath}"` : "";
      const terminal = getAlyaTerminal();
      terminal.show();
      terminal.sendText(`alya doc ${targetPath}`.trim());
    }
  );

  const formatDocCmd = vscode.commands.registerCommand(
    "alya.formatDocument",
    () => {
      vscode.commands.executeCommand("editor.action.formatDocument");
    }
  );

  const viewAssemblyCmd = vscode.commands.registerCommand(
    "alya.viewAssembly",
    (uri?: vscode.Uri) => assemblyViewer.viewAssembly(uri)
  );

  const viewAstCmd = vscode.commands.registerCommand(
    "alya.viewAst",
    (uri?: vscode.Uri) => assemblyViewer.viewAst(uri)
  );

  const viewTokensCmd = vscode.commands.registerCommand(
    "alya.viewTokens",
    (uri?: vscode.Uri) => assemblyViewer.viewTokens(uri)
  );

  const showMenuCmd = vscode.commands.registerCommand(
    "alya.showMenu",
    () => statusBar.showQuickMenu()
  );

  const restartLspCmd = vscode.commands.registerCommand(
    "alya.restartLsp",
    async () => {
      statusBar.setLspStatus("Restarting");
      if (client) {
        await client.stop();
      }
      startLspClient();
      vscode.window.showInformationMessage("Alya Language Server restarted.");
    }
  );

  context.subscriptions.push(
    formattingProvider,
    codeLensProvider,
    runFileCmd,
    runTestCmd,
    openReplCmd,
    showDocCmd,
    formatDocCmd,
    viewAssemblyCmd,
    viewAstCmd,
    viewTokensCmd,
    showMenuCmd,
    restartLspCmd,
    {
      dispose: () => {
        if (client) {
          client.stop();
        }
      },
    }
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
