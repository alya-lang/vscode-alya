import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export class AlyaTestController {
  private controller: vscode.TestController;

  constructor(
    private context: vscode.ExtensionContext,
    private serverPath: string
  ) {
    this.controller = vscode.tests.createTestController(
      "alyaTestController",
      "Alya Tests"
    );
    context.subscriptions.push(this.controller);

    this.controller.createRunProfile(
      "Run",
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runTests(request, token),
      true
    );

    this.initWatchers();
    this.discoverWorkspaceTests();
  }

  private initWatchers() {
    const watcher = vscode.workspace.createFileSystemWatcher("**/*.alya");
    this.context.subscriptions.push(watcher);

    watcher.onDidChange((uri) => this.updateTestsForUri(uri));
    watcher.onDidCreate((uri) => this.updateTestsForUri(uri));
    watcher.onDidDelete((uri) => this.controller.items.delete(uri.toString()));

    vscode.workspace.onDidOpenTextDocument(
      (doc) => {
        if (doc.languageId === "alya") {
          this.updateTestsForDocument(doc);
        }
      },
      null,
      this.context.subscriptions
    );

    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.languageId === "alya") {
          this.updateTestsForDocument(e.document);
        }
      },
      null,
      this.context.subscriptions
    );
  }

  private async discoverWorkspaceTests() {
    const files = await vscode.workspace.findFiles(
      "**/*.alya",
      "**/node_modules/**"
    );
    for (const file of files) {
      this.updateTestsForUri(file);
    }
  }

  private updateTestsForUri(uri: vscode.Uri) {
    if (!fs.existsSync(uri.fsPath)) {
      this.controller.items.delete(uri.toString());
      return;
    }
    try {
      const content = fs.readFileSync(uri.fsPath, "utf8");
      this.parseContent(uri, content);
    } catch {
      // Ignore read errors
    }
  }

  private updateTestsForDocument(document: vscode.TextDocument) {
    this.parseContent(document.uri, document.getText());
  }

  private parseContent(uri: vscode.Uri, content: string) {
    const lines = content.split(/\r?\n/);
    const testMatches: { name: string; line: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^\s*test\s+"([^"]+)"/);
      if (match) {
        testMatches.push({ name: match[1], line: i });
      }
    }

    if (testMatches.length === 0) {
      this.controller.items.delete(uri.toString());
      return;
    }

    let fileItem = this.controller.items.get(uri.toString());
    if (!fileItem) {
      fileItem = this.controller.createTestItem(
        uri.toString(),
        path.basename(uri.fsPath),
        uri
      );
      this.controller.items.add(fileItem);
    }

    fileItem.children.replace(
      testMatches.map((t) => {
        const testId = `${uri.toString()}::${t.name}`;
        const item = this.controller.createTestItem(testId, t.name, uri);
        item.range = new vscode.Range(t.line, 0, t.line, lines[t.line].length);
        return item;
      })
    );
  }

  private async runTests(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken
  ) {
    const run = this.controller.createTestRun(request);
    const queue: vscode.TestItem[] = [];

    if (request.include) {
      request.include.forEach((item) => queue.push(item));
    } else {
      this.controller.items.forEach((item) => queue.push(item));
    }

    for (const item of queue) {
      if (token.isCancellationRequested) {
        break;
      }

      run.started(item);
      const uri = item.uri;
      if (!uri) {
        run.skipped(item);
        continue;
      }

      const startTime = Date.now();
      await new Promise<void>((resolve) => {
        cp.execFile(
          this.serverPath,
          ["test", uri.fsPath],
          (err, stdout, stderr) => {
            const duration = Date.now() - startTime;
            const output = stdout + "\n" + stderr;
            run.appendOutput(output.replace(/\r?\n/g, "\r\n"));

            if (err) {
              const msg = new vscode.TestMessage(
                stderr || stdout || "Test execution failed."
              );
              run.failed(item, msg, duration);
              item.children.forEach((child) => run.failed(child, msg, duration));
            } else {
              run.passed(item, duration);
              item.children.forEach((child) => run.passed(child, duration));
            }
            resolve();
          }
        );
      });
    }

    run.end();
  }
}
