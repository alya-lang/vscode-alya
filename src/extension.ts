import * as cp from "child_process";
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
  const testController = new AlyaTestController(context, serverPath);

  // 4. Automatic Docstring & Summary Generator
  registerDocGenerator(context);

  // 5. Initialize LSP Client (Native LSP handles formatting, symbols, references, folding)
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

  // 6. CodeLens Provider (`function main()` -> Run, `test "..."` -> Run Test, suites, benches)
  const codeLensProvider = vscode.languages.registerCodeLensProvider("alya", {
    provideCodeLenses(
      document: vscode.TextDocument
    ): vscode.ProviderResult<vscode.CodeLens[]> {
      const lenses: vscode.CodeLens[] = [];
      const lines = document.getText().split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (/^\s*(?:pub\s+)?(?:function|fn)\s+main\s*\(/.test(line)) {
          const range = new vscode.Range(i, 0, i, line.length);
          lenses.push(
            new vscode.CodeLens(range, {
              title: "$(play) Run",
              tooltip: "Run this file with alya run",
              command: "alya.runFile",
              arguments: [document.uri],
            }),
            new vscode.CodeLens(range, {
              title: "$(pulse) Mem Trace",
              tooltip: "Run this file with heap trace and leak diagnostics (alya run --mem-trace)",
              command: "alya.runFileWithMemTrace",
              arguments: [document.uri],
            })
          );
        }

        const testMatch = line.match(/^\s*(?:pub\s+)?test\s+"([^"]+)"/);
        if (testMatch) {
          const range = new vscode.Range(i, 0, i, line.length);
          lenses.push(
            new vscode.CodeLens(range, {
              title: "$(beaker) Run Test",
              tooltip: `Run test: ${testMatch[1]}`,
              command: "alya.runTestAtCursor",
            })
          );
        }

        const suiteMatch = line.match(/test_suite\s*\(\s*"([^"]+)"\s*\)/);
        if (suiteMatch) {
          const range = new vscode.Range(i, 0, i, line.length);
          lenses.push(
            new vscode.CodeLens(range, {
              title: "$(beaker) Run Suite",
              tooltip: `Run test suite: ${suiteMatch[1]}`,
              command: "alya.runTest",
              arguments: [document.uri],
            })
          );
        }

        const benchRunnerMatch = line.match(/bench_runner\s*\(\s*"([^"]+)"\s*\)/);
        if (benchRunnerMatch) {
          const range = new vscode.Range(i, 0, i, line.length);
          lenses.push(
            new vscode.CodeLens(range, {
              title: "$(dashboard) Run Benchmarks",
              tooltip: `Run benchmark suite: ${benchRunnerMatch[1]}`,
              command: "alya.runFile",
              arguments: [document.uri],
            })
          );
        }

        const benchMatch = line.match(/^\s*(?:pub\s+)?bench\s+"([^"]+)"/);
        if (benchMatch) {
          const range = new vscode.Range(i, 0, i, line.length);
          lenses.push(
            new vscode.CodeLens(range, {
              title: "$(dashboard) Run Benchmark",
              tooltip: `Run benchmark: ${benchMatch[1]}`,
              command: "alya.runFile",
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
      const runConfig = vscode.workspace.getConfiguration("alya");
      const memTraceFlag = runConfig.get<boolean>("run.memTrace") ? " --mem-trace" : "";
      terminal.sendText(`alya run${memTraceFlag} "${targetUri.fsPath}"`);
    }
  );

  const runFileWithMemTraceCmd = vscode.commands.registerCommand(
    "alya.runFileWithMemTrace",
    (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (!targetUri) {
        vscode.window.showErrorMessage("No active Alya file to run with memory trace.");
        return;
      }
      const terminal = getAlyaTerminal();
      terminal.show();
      terminal.sendText(`alya run --mem-trace "${targetUri.fsPath}"`);
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
        try {
          await client.stop();
        } catch {
          // Ignore process termination / EPIPE errors during restart
        }
      }
      startLspClient();
      vscode.window.showInformationMessage("Alya Language Server restarted.");
    }
  );

  const lintFileCmd = vscode.commands.registerCommand(
    "alya.lintFile",
    (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      const targetPath = targetUri ? `"${targetUri.fsPath}"` : "";
      const terminal = getAlyaTerminal();
      terminal.show();
      terminal.sendText(`alya lint ${targetPath}`.trim());
    }
  );

  const lintFixCmd = vscode.commands.registerCommand(
    "alya.lintFix",
    (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      const targetPath = targetUri ? `"${targetUri.fsPath}"` : "";
      const terminal = getAlyaTerminal();
      terminal.show();
      terminal.sendText(`alya lint ${targetPath} --fix`.trim());
    }
  );

  const runTestAtCursorCmd = vscode.commands.registerCommand(
    "alya.runTestAtCursor",
    () => testController.runTestAtCursor()
  );

  const debugTestCmd = vscode.commands.registerCommand(
    "alya.debugTest",
    () => testController.debugTestAtCursor()
  );

  const rerunFailedTestsCmd = vscode.commands.registerCommand(
    "alya.rerunFailedTests",
    () => testController.rerunFailedTests()
  );

  const onSaveDisposable = vscode.workspace.onDidSaveTextDocument((doc) => {
    if (doc.languageId === "alya") {
      const lintConfig = vscode.workspace.getConfiguration("alya.lint");
      if (lintConfig.get<boolean>("runOnSave")) {
        cp.execFile(serverPath, ["lint", doc.uri.fsPath, "--fix"], () => {});
      }
      const testConfig = vscode.workspace.getConfiguration("alya.testing");
      if (testConfig.get<boolean>("autoRunOnSave")) {
        testController.autoRunOnSave(doc);
      }
    }
  });

  context.subscriptions.push(
    codeLensProvider,
    runFileCmd,
    runFileWithMemTraceCmd,
    runTestCmd,
    runTestAtCursorCmd,
    debugTestCmd,
    rerunFailedTestsCmd,
    openReplCmd,
    showDocCmd,
    formatDocCmd,
    viewAssemblyCmd,
    viewAstCmd,
    viewTokensCmd,
    showMenuCmd,
    restartLspCmd,
    lintFileCmd,
    lintFixCmd,
    onSaveDisposable,
    {
      dispose: () => {
        if (client) {
          try {
            client.stop();
          } catch {
            // Ignore
          }
        }
      },
    }
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop().catch(() => {});
}
