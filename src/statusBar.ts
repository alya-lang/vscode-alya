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
    const localizedStatus = vscode.l10n.t(this.lspStatus);
    const displayVersion =
      this.version === "offline" || this.version === "loading..."
        ? vscode.l10n.t(this.version)
        : this.version;
    const title = vscode.l10n.t("Alya Language Toolchain");
    const compilerLabel = vscode.l10n.t("Compiler");
    const hint = vscode.l10n.t("Click for quick actions");
    this.statusBarItem.text = `$(symbol-property) Alya ${displayVersion} | ${localizedStatus}`;
    this.statusBarItem.tooltip = new vscode.MarkdownString(
      `**${title}**\n\n- **${compilerLabel}**: ${displayVersion}\n- **LSP**: ${localizedStatus}\n\n*${hint}*`
    );
  }

  public async showQuickMenu() {
    interface MenuItem extends vscode.QuickPickItem {
      action: () => void;
    }

    const items: MenuItem[] = [
      {
        label: vscode.l10n.t("$(play) Run Current File"),
        description: vscode.l10n.t("Execute active .alya file (alya run)"),
        action: () => vscode.commands.executeCommand("alya.runFile"),
      },
      {
        label: vscode.l10n.t("$(pulse) Run with Memory Trace (--mem-trace)"),
        description: vscode.l10n.t(
          "Execute active file with heap trace and leak diagnostics"
        ),
        action: () => vscode.commands.executeCommand("alya.runFileWithMemTrace"),
      },
      {
        label: vscode.l10n.t("$(beaker) Run Project Tests"),
        description: vscode.l10n.t("Run test suite (alya test)"),
        action: () => vscode.commands.executeCommand("alya.runTest"),
      },
      {
        label: vscode.l10n.t("$(file-code) View Assembly Output (-S)"),
        description: vscode.l10n.t(
          "Compile to native assembly and view side-by-side"
        ),
        action: () => vscode.commands.executeCommand("alya.viewAssembly"),
      },
      {
        label: vscode.l10n.t("$(symbol-structure) View Abstract Syntax Tree (AST)"),
        description: vscode.l10n.t("Inspect parsed AST hierarchy (alya ast)"),
        action: () => vscode.commands.executeCommand("alya.viewAst"),
      },
      {
        label: vscode.l10n.t("$(symbol-key) View Tokens (Lexer)"),
        description: vscode.l10n.t("Inspect token stream from lexical analysis"),
        action: () => vscode.commands.executeCommand("alya.viewTokens"),
      },
      {
        label: vscode.l10n.t("$(terminal) Open Interactive REPL"),
        description: vscode.l10n.t("Launch alya repl in integrated terminal"),
        action: () => vscode.commands.executeCommand("alya.openRepl"),
      },
      {
        label: vscode.l10n.t("$(paintcan) Format Document"),
        description: vscode.l10n.t("Format active document using alya fmt"),
        action: () => vscode.commands.executeCommand("alya.formatDocument"),
      },
      {
        label: vscode.l10n.t("$(book) Generate Documentation"),
        description: vscode.l10n.t("Generate HTML/Markdown docs (alya doc)"),
        action: () => vscode.commands.executeCommand("alya.showDoc"),
      },
      {
        label: vscode.l10n.t("$(refresh) Restart Language Server"),
        description: vscode.l10n.t("Restart alya lsp background process"),
        action: () => vscode.commands.executeCommand("alya.restartLsp"),
      },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: vscode.l10n.t("Alya Toolchain Quick Actions"),
    });

    if (selected) {
      selected.action();
    }
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
