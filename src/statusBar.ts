import * as cp from "child_process";
import * as vscode from "vscode";

export class AlyaStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private version: string = "loading...";
  private lspStatus: string = "Starting";

  constructor(context: vscode.ExtensionContext, private serverPath: string) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = "alya.showMenu";
    context.subscriptions.push(this.statusBarItem);

    this.detectVersion();
    this.update();
    this.statusBarItem.show();
  }

  public setLspStatus(status: string) {
    this.lspStatus = status;
    this.update();
  }

  private detectVersion() {
    cp.execFile(this.serverPath, ["--version"], (err, stdout) => {
      if (!err && stdout) {
        // e.g. "Alya Language Toolchain (alya) v0.0.18" -> "v0.0.18"
        const match = stdout.match(/v\d+\.\d+\.\d+/i);
        if (match) {
          this.version = match[0];
        } else {
          this.version = stdout.trim().split("\n")[0];
        }
      } else {
        this.version = "offline";
      }
      this.update();
    });
  }

  private update() {
    const isOk = this.version !== "offline";
    const icon = isOk ? "$(check)" : "$(warning)";
    this.statusBarItem.text = `$(symbol-property) Alya ${this.version} | ${this.lspStatus}`;
    this.statusBarItem.tooltip = new vscode.MarkdownString(
      `**Alya Language Toolchain**\n\n- **Compiler**: ${this.version}\n- **LSP**: ${this.lspStatus}\n\n*Click for quick actions*`
    );
  }

  public async showQuickMenu() {
    interface MenuItem extends vscode.QuickPickItem {
      action: () => void;
    }

    const items: MenuItem[] = [
      {
        label: "$(play) Run Current File",
        description: "Execute active .alya file (alya run)",
        action: () => vscode.commands.executeCommand("alya.runFile"),
      },
      {
        label: "$(pulse) Run with Memory Trace (--mem-trace)",
        description: "Execute active file with heap trace and leak diagnostics",
        action: () => vscode.commands.executeCommand("alya.runFileWithMemTrace"),
      },
      {
        label: "$(beaker) Run Project Tests",
        description: "Run test suite (alya test)",
        action: () => vscode.commands.executeCommand("alya.runTest"),
      },
      {
        label: "$(file-code) View Assembly Output (-S)",
        description: "Compile to native assembly and view side-by-side",
        action: () => vscode.commands.executeCommand("alya.viewAssembly"),
      },
      {
        label: "$(symbol-structure) View Abstract Syntax Tree (AST)",
        description: "Inspect parsed AST hierarchy (alya ast)",
        action: () => vscode.commands.executeCommand("alya.viewAst"),
      },
      {
        label: "$(symbol-key) View Tokens (Lexer)",
        description: "Inspect token stream from lexical analysis",
        action: () => vscode.commands.executeCommand("alya.viewTokens"),
      },
      {
        label: "$(terminal) Open Interactive REPL",
        description: "Launch alya repl in integrated terminal",
        action: () => vscode.commands.executeCommand("alya.openRepl"),
      },
      {
        label: "$(paintcan) Format Document",
        description: "Format active document using alya fmt",
        action: () => vscode.commands.executeCommand("alya.formatDocument"),
      },
      {
        label: "$(book) Generate Documentation",
        description: "Generate HTML/Markdown docs (alya doc)",
        action: () => vscode.commands.executeCommand("alya.showDoc"),
      },
      {
        label: "$(refresh) Restart Language Server",
        description: "Restart alya lsp background process",
        action: () => vscode.commands.executeCommand("alya.restartLsp"),
      },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Alya Toolchain Quick Actions",
    });

    if (selected) {
      selected.action();
    }
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
