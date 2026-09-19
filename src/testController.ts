import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

interface DiscoveredItem {
  id: string;
  name: string;
  line: number;
  endLine?: number;
  isBenchmark?: boolean;
  isSuite?: boolean;
}

export class AlyaTestController {
  private controller: vscode.TestController;
  private failedTestIds: Set<string> = new Set();

  constructor(
    private context: vscode.ExtensionContext,
    private serverPath: string
  ) {
    this.controller = vscode.tests.createTestController(
      "alyaTestController",
      "Alya Tests"
    );
    context.subscriptions.push(this.controller);

    // 1. Run Profile (executes alya test / alya run)
    this.controller.createRunProfile(
      "Run",
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runTests(request, token),
      true
    );

    // 2. Debug Profile (runs in terminal with --mem-trace and diagnostics)
    this.controller.createRunProfile(
      "Debug",
      vscode.TestRunProfileKind.Debug,
      (request, token) => this.runDebugTests(request, token),
      false
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

  public async discoverWorkspaceTests() {
    const files = await vscode.workspace.findFiles(
      "**/*.alya",
      "**/{node_modules,.alya,target,build}/**"
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
    const discovered: DiscoveredItem[] = [];
    const normalizedPath = uri.fsPath.replace(/\\/g, "/");
    const isBenchFile =
      normalizedPath.includes("/benches/") ||
      path.basename(normalizedPath).startsWith("bench_") ||
      path.basename(normalizedPath).endsWith("_bench.alya");
    const isTestFile =
      normalizedPath.includes("/tests/") ||
      path.basename(normalizedPath).startsWith("test_") ||
      path.basename(normalizedPath).endsWith("_test.alya") ||
      path.basename(normalizedPath).endsWith(".test.alya");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1. Inline test keyword block: test "..."
      const inlineTest = line.match(/^\s*(?:pub\s+)?test\s+"([^"]+)"/);
      if (inlineTest) {
        let endLine = i;
        for (let j = i + 1; j < lines.length; j++) {
          if (/^\s*end\b/.test(lines[j])) {
            endLine = j;
            break;
          }
        }
        discovered.push({
          id: `${uri.toString()}::test::${inlineTest[1]}`,
          name: inlineTest[1],
          line: i,
          endLine,
          isBenchmark: false,
          isSuite: false,
        });
        continue;
      }

      // 2. Inline bench keyword block: bench "..."
      const inlineBench = line.match(/^\s*(?:pub\s+)?bench\s+"([^"]+)"/);
      if (inlineBench) {
        let endLine = i;
        for (let j = i + 1; j < lines.length; j++) {
          if (/^\s*end\b/.test(lines[j])) {
            endLine = j;
            break;
          }
        }
        discovered.push({
          id: `${uri.toString()}::bench::${inlineBench[1]}`,
          name: inlineBench[1],
          line: i,
          endLine,
          isBenchmark: true,
          isSuite: false,
        });
        continue;
      }

      // 3. std/test suite runner: test_suite("...")
      const suiteMatch = line.match(/test_suite\s*\(\s*"([^"]+)"\s*\)/);
      if (suiteMatch) {
        discovered.push({
          id: `${uri.toString()}::suite::${suiteMatch[1]}`,
          name: `[Suite] ${suiteMatch[1]}`,
          line: i,
          isBenchmark: false,
          isSuite: true,
        });
        continue;
      }

      // 4. std/bench runner: bench_runner("...")
      const benchRunnerMatch = line.match(/bench_runner\s*\(\s*"([^"]+)"\s*\)/);
      if (benchRunnerMatch) {
        discovered.push({
          id: `${uri.toString()}::bench_suite::${benchRunnerMatch[1]}`,
          name: `[Bench] ${benchRunnerMatch[1]}`,
          line: i,
          isBenchmark: true,
          isSuite: true,
        });
        continue;
      }

      // 5. bench_stop(runner, "...")
      const benchStopMatch = line.match(
        /bench_stop\s*\([^,]+,\s*"([^"]+)"\s*\)/
      );
      if (benchStopMatch) {
        discovered.push({
          id: `${uri.toString()}::bench_case::${benchStopMatch[1]}`,
          name: benchStopMatch[1],
          line: i,
          isBenchmark: true,
          isSuite: false,
        });
        continue;
      }

      // 6. runner_assert or runner_assert_eq with description
      const assertMatch = line.match(
        /runner_assert(?:_eq)?\s*\(.*,\s*"([^"]+)"\s*\)/
      );
      if (assertMatch) {
        discovered.push({
          id: `${uri.toString()}::assert::${assertMatch[1]}`,
          name: assertMatch[1],
          line: i,
          isBenchmark: false,
          isSuite: false,
        });
        continue;
      }

      // 7. suite.test("...") or runner.test("...")
      const methodTest = line.match(/(?:suite|runner|r)\.test\s*\(\s*"([^"]+)"/);
      if (methodTest) {
        discovered.push({
          id: `${uri.toString()}::case::${methodTest[1]}`,
          name: methodTest[1],
          line: i,
          isBenchmark: false,
          isSuite: false,
        });
        continue;
      }
    }

    // 8. Package test/bench file with function main() but without granular test blocks
    if (discovered.length === 0 && (isTestFile || isBenchFile)) {
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*(?:pub\s+)?(?:function|fn)\s+main\s*\(/.test(lines[i])) {
          discovered.push({
            id: `${uri.toString()}::main`,
            name: isBenchFile ? "Benchmark Suite" : "Package Test Suite",
            line: i,
            isBenchmark: isBenchFile,
            isSuite: true,
          });
          break;
        }
      }
    }

    if (discovered.length === 0) {
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

    fileItem.description = isBenchFile
      ? "benchmark"
      : isTestFile
      ? "package test"
      : undefined;

    // Populate children items
    fileItem.children.replace(
      discovered.map((d) => {
        const item = this.controller.createTestItem(d.id, d.name, uri);
        const endLine = d.endLine ?? d.line;
        item.range = new vscode.Range(
          d.line,
          0,
          endLine,
          lines[endLine]?.length || 0
        );
        if (d.isBenchmark) {
          item.description = "bench";
        } else if (d.isSuite) {
          item.description = "suite";
        }
        return item;
      })
    );
  }

  private async runTests(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken
  ) {
    const run = this.controller.createTestRun(request);
    const targets = new Map<
      string,
      { fileItem: vscode.TestItem; items: vscode.TestItem[] }
    >();

    const collectItem = (item: vscode.TestItem) => {
      const uriStr = item.uri?.toString();
      if (!uriStr) return;

      const fileItem = this.controller.items.get(uriStr);
      if (!fileItem) return;

      if (!targets.has(uriStr)) {
        targets.set(uriStr, { fileItem, items: [] });
      }

      if (item === fileItem) {
        fileItem.children.forEach((c) => targets.get(uriStr)!.items.push(c));
      } else {
        targets.get(uriStr)!.items.push(item);
      }
    };

    if (request.include && request.include.length > 0) {
      request.include.forEach(collectItem);
    } else {
      this.controller.items.forEach(collectItem);
    }

    for (const [, { fileItem, items }] of targets) {
      if (token.isCancellationRequested) break;

      const uri = fileItem.uri;
      if (!uri) continue;

      run.started(fileItem);
      items.forEach((it) => run.started(it));

      const isBench = fileItem.description === "benchmark";
      const cmdArgs = isBench ? ["run", uri.fsPath] : ["test", uri.fsPath];
      const workspaceFolder =
        vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;
      const cwd = workspaceFolder || path.dirname(uri.fsPath);

      const startTime = Date.now();

      await new Promise<void>((resolve) => {
        cp.execFile(
          this.serverPath,
          cmdArgs,
          { cwd, maxBuffer: 50 * 1024 * 1024 },
          (err, stdout, stderr) => {
            const elapsed = Date.now() - startTime;
            const fullOutput = stdout + (stderr ? "\n" + stderr : "");
            run.appendOutput(fullOutput.replace(/\r?\n/g, "\r\n"));

            const isSuccess =
              !err &&
              !stdout.includes("[FAIL]") &&
              !stderr.includes("[FAIL]") &&
              !stdout.includes("Runtime error:") &&
              !stderr.includes("Runtime error:");

            // Collect failure lines: [FAIL] line 45: expected 42, got 0
            const failureLines: {
              line?: number;
              message: string;
              expected?: string;
              actual?: string;
            }[] = [];
            const outputLines = fullOutput.split(/\r?\n/);

            for (const line of outputLines) {
              const failMatch = line.match(
                /(?:\[FAIL\]|\bFAILED\b)\s*(?:line\s*(\d+)[:\s]*)?(.*)/i
              );
              if (failMatch && !line.includes("Failed Assertions")) {
                const lineNum = failMatch[1] ? parseInt(failMatch[1]) : undefined;
                const failMsg = failMatch[2].trim();
                let expected: string | undefined;
                let actual: string | undefined;

                const diffMatch = failMsg.match(
                  /expected\s+([^,]+),\s*got\s+(.*)/i
                );
                if (diffMatch) {
                  expected = diffMatch[1].trim();
                  actual = diffMatch[2].replace(/\)+$/, "").trim();
                }

                failureLines.push({
                  line: lineNum,
                  message: failMsg || line.trim(),
                  expected,
                  actual,
                });
              }
            }

            if (isSuccess) {
              run.passed(fileItem, elapsed);
              this.failedTestIds.delete(fileItem.id);

              const perItemDuration =
                items.length > 0 ? Math.round(elapsed / items.length) : elapsed;
              items.forEach((child) => {
                run.passed(child, perItemDuration);
                this.failedTestIds.delete(child.id);
              });
            } else {
              // File level failure
              const failureText =
                failureLines.map((f) => f.message).join("\n") ||
                stderr ||
                stdout ||
                "Test execution failed";
              const mainMessage = new vscode.TestMessage(failureText);

              if (failureLines.length > 0 && failureLines[0].line) {
                mainMessage.location = new vscode.Location(
                  uri,
                  new vscode.Position(failureLines[0].line - 1, 0)
                );
              }
              if (
                failureLines.length > 0 &&
                failureLines[0].expected &&
                failureLines[0].actual
              ) {
                mainMessage.expectedOutput = failureLines[0].expected;
                mainMessage.actualOutput = failureLines[0].actual;
              }

              run.failed(fileItem, mainMessage, elapsed);
              this.failedTestIds.add(fileItem.id);

              // Evaluate each child item
              items.forEach((child) => {
                const childLine =
                  child.range?.start.line !== undefined
                    ? child.range.start.line + 1
                    : undefined;

                const matchedFail = failureLines.find((f) => {
                  if (
                    childLine &&
                    f.line &&
                    Math.abs(f.line - childLine) <= 1
                  ) {
                    return true;
                  }
                  if (
                    f.message.toLowerCase().includes(child.label.toLowerCase())
                  ) {
                    return true;
                  }
                  return false;
                });

                if (matchedFail) {
                  const childMsg = new vscode.TestMessage(matchedFail.message);
                  if (matchedFail.line) {
                    childMsg.location = new vscode.Location(
                      uri,
                      new vscode.Position(matchedFail.line - 1, 0)
                    );
                  }
                  if (matchedFail.expected && matchedFail.actual) {
                    childMsg.expectedOutput = matchedFail.expected;
                    childMsg.actualOutput = matchedFail.actual;
                  }
                  run.failed(child, childMsg, elapsed);
                  this.failedTestIds.add(child.id);
                } else if (failureLines.length === 0) {
                  run.failed(child, mainMessage, elapsed);
                  this.failedTestIds.add(child.id);
                } else {
                  run.passed(child, 1);
                  this.failedTestIds.delete(child.id);
                }
              });
            }

            resolve();
          }
        );
      });
    }

    run.end();
  }

  private async runDebugTests(
    request: vscode.TestRunRequest,
    _token: vscode.CancellationToken
  ) {
    const run = this.controller.createTestRun(request);
    const items = request.include || [];
    let targetItem = items[0];

    if (!targetItem) {
      for (const [, item] of this.controller.items) {
        targetItem = item;
        break;
      }
    }

    if (!targetItem || !targetItem.uri) {
      vscode.window.showErrorMessage("No test selected for debug execution.");
      run.end();
      return;
    }

    run.started(targetItem);
    run.appendOutput(
      `[Debug Session] Initiating DAP debug session for "${targetItem.label}" (${targetItem.uri.fsPath})...\r\n`
    );

    const started = await vscode.debug.startDebugging(undefined, {
      type: "alya",
      name: `Alya Debug Test: ${targetItem.label}`,
      request: "launch",
      program: targetItem.uri.fsPath,
      memTrace: true,
      stopOnEntry: false,
    });

    if (started) {
      run.appendOutput(`[Debug Session] DAP session started successfully.\r\n`);
      run.passed(targetItem, 0);
    } else {
      run.appendOutput(`[Debug Session] Failed to start DAP session.\r\n`);
      run.failed(
        targetItem,
        new vscode.TestMessage("Failed to start Alya DAP debug session.")
      );
    }
    run.end();
  }

  public async runTestAtCursor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "alya") {
      vscode.window.showInformationMessage(
        "Open an Alya test file to run the test at cursor."
      );
      return;
    }

    const uri = editor.document.uri;
    const pos = editor.selection.active;
    const fileItem = this.controller.items.get(uri.toString());

    if (!fileItem) {
      vscode.window.showWarningMessage(
        "No tests discovered in the current file."
      );
      return;
    }

    let targetItem: vscode.TestItem | undefined;
    fileItem.children.forEach((child) => {
      if (child.range && child.range.contains(pos)) {
        targetItem = child;
      }
    });

    const itemToRun = targetItem || fileItem;
    const request = new vscode.TestRunRequest([itemToRun]);
    await this.runTests(request, new vscode.CancellationTokenSource().token);
  }

  public async debugTestAtCursor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "alya") {
      vscode.window.showInformationMessage("Open an Alya test file to debug.");
      return;
    }

    const uri = editor.document.uri;
    const fileItem = this.controller.items.get(uri.toString());
    const itemToDebug =
      fileItem ||
      this.controller.createTestItem(
        uri.toString(),
        path.basename(uri.fsPath),
        uri
      );
    const request = new vscode.TestRunRequest([itemToDebug]);
    await this.runDebugTests(request, new vscode.CancellationTokenSource().token);
  }

  public async rerunFailedTests(): Promise<void> {
    if (this.failedTestIds.size === 0) {
      vscode.window.showInformationMessage("No failed tests to re-run.");
      return;
    }

    const itemsToRerun: vscode.TestItem[] = [];
    const findItems = (collection: vscode.TestItemCollection) => {
      collection.forEach((item) => {
        if (this.failedTestIds.has(item.id)) {
          itemsToRerun.push(item);
        }
        if (item.children.size > 0) {
          findItems(item.children);
        }
      });
    };

    findItems(this.controller.items);

    if (itemsToRerun.length === 0) {
      this.failedTestIds.clear();
      vscode.window.showInformationMessage(
        "No failed tests found in the current workspace."
      );
      return;
    }

    const request = new vscode.TestRunRequest(itemsToRerun);
    await this.runTests(request, new vscode.CancellationTokenSource().token);
  }

  public async autoRunOnSave(document: vscode.TextDocument): Promise<void> {
    if (document.languageId !== "alya") return;

    const fileItem = this.controller.items.get(document.uri.toString());
    if (fileItem) {
      // Re-run this test file directly
      const request = new vscode.TestRunRequest([fileItem]);
      await this.runTests(request, new vscode.CancellationTokenSource().token);
      return;
    }

    // If source file was edited, re-run previously failed tests or all tests
    if (this.failedTestIds.size > 0) {
      await this.rerunFailedTests();
    } else if (this.controller.items.size > 0) {
      const request = new vscode.TestRunRequest();
      await this.runTests(request, new vscode.CancellationTokenSource().token);
    }
  }
}
