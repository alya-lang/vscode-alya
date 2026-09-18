import * as cp from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export class AlyaAssemblyViewer {
  constructor(private serverPath: string) {}

  public async viewAssembly(uri?: vscode.Uri) {
    const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
    if (!targetUri) {
      vscode.window.showErrorMessage("No active Alya file to compile.");
      return;
    }

    const filePath = targetUri.fsPath;
    const tempAsm = path.join(
      os.tmpdir(),
      `alya_asm_${Date.now()}_${Math.random().toString(36).substring(7)}.s`
    );

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Alya: Emitting native assembly...",
        cancellable: false,
      },
      () => {
        return new Promise<void>((resolve) => {
          cp.execFile(
            this.serverPath,
            ["build", filePath, "-S", "-o", tempAsm],
            async (err, _stdout, stderr) => {
              try {
                if (err || !fs.existsSync(tempAsm)) {
                  vscode.window.showErrorMessage(
                    `Assembly generation failed: ${stderr || err?.message}`
                  );
                  return resolve();
                }

                const asmContent = fs.readFileSync(tempAsm, "utf8");
                fs.unlinkSync(tempAsm);

                const doc = await vscode.workspace.openTextDocument({
                  content: asmContent,
                  language: "arm", // arm/assembly syntax highlighting
                });

                await vscode.window.showTextDocument(doc, {
                  viewColumn: vscode.ViewColumn.Beside,
                  preview: true,
                  preserveFocus: true,
                });
              } catch (e: any) {
                vscode.window.showErrorMessage(
                  `Error opening assembly view: ${e.message}`
                );
              } finally {
                if (fs.existsSync(tempAsm)) {
                  try {
                    fs.unlinkSync(tempAsm);
                  } catch {
                    // Ignore
                  }
                }
                resolve();
              }
            }
          );
        });
      }
    );
  }

  public async viewAst(uri?: vscode.Uri) {
    const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
    if (!targetUri) {
      vscode.window.showErrorMessage("No active Alya file to inspect.");
      return;
    }

    const filePath = targetUri.fsPath;
    cp.execFile(this.serverPath, ["ast", filePath], async (err, stdout, stderr) => {
      if (err) {
        vscode.window.showErrorMessage(`AST dump failed: ${stderr || err.message}`);
        return;
      }

      const doc = await vscode.workspace.openTextDocument({
        content: stdout,
        language: "rust",
      });

      await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: true,
        preserveFocus: true,
      });
    });
  }

  public async viewTokens(uri?: vscode.Uri) {
    const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
    if (!targetUri) {
      vscode.window.showErrorMessage("No active Alya file to tokenize.");
      return;
    }

    const filePath = targetUri.fsPath;
    cp.execFile(this.serverPath, ["tokens", filePath], async (err, stdout, stderr) => {
      if (err) {
        vscode.window.showErrorMessage(`Tokenization failed: ${stderr || err.message}`);
        return;
      }

      const doc = await vscode.workspace.openTextDocument({
        content: stdout,
        language: "rust",
      });

      await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: true,
        preserveFocus: true,
      });
    });
  }
}
