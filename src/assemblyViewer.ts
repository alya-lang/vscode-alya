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
      vscode.window.showErrorMessage(
        vscode.l10n.t("No active Alya file to compile.")
      );
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
        title: vscode.l10n.t("Alya: Emitting native assembly..."),
        cancellable: false,
      },
      () => {
        return new Promise<void>((resolve) => {
          cp.execFile(
            this.serverPath,
            ["build", filePath, "-S", "-o", tempAsm],
            { maxBuffer: 50 * 1024 * 1024 },
            async (err, _stdout, stderr) => {
              try {
                if (err || !fs.existsSync(tempAsm)) {
                  vscode.window.showErrorMessage(
                    vscode.l10n.t(
                      "Assembly generation failed: {0}",
                      stderr || err?.message || ""
                    )
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
                  vscode.l10n.t("Error opening assembly view: {0}", e.message)
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
      vscode.window.showErrorMessage(
        vscode.l10n.t("No active Alya file to inspect.")
      );
      return;
    }

    const filePath = targetUri.fsPath;

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t("Alya: Generating AST dump..."),
        cancellable: false,
      },
      () => {
        return new Promise<void>((resolve) => {
          const child = cp.spawn(this.serverPath, ["ast", filePath]);
          const stdoutChunks: Buffer[] = [];
          const stderrChunks: Buffer[] = [];

          child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
          child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

          child.on("error", (err) => {
            vscode.window.showErrorMessage(
              vscode.l10n.t("AST dump failed: {0}", err.message)
            );
            resolve();
          });

          child.on("close", async (code) => {
            if (code !== 0) {
              const stderr = Buffer.concat(stderrChunks).toString("utf8");
              vscode.window.showErrorMessage(
                vscode.l10n.t(
                  "AST dump failed: {0}",
                  stderr || `Process exited with code ${code}`
                )
              );
              return resolve();
            }

            try {
              const stdout = Buffer.concat(stdoutChunks).toString("utf8");
              const doc = await vscode.workspace.openTextDocument({
                content: stdout,
                language: "rust",
              });

              await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Beside,
                preview: true,
                preserveFocus: true,
              });
            } catch (e: any) {
              vscode.window.showErrorMessage(
                vscode.l10n.t("Error displaying AST: {0}", e.message)
              );
            }
            resolve();
          });
        });
      }
    );
  }

  public async viewTokens(uri?: vscode.Uri) {
    const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
    if (!targetUri) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("No active Alya file to tokenize.")
      );
      return;
    }

    const filePath = targetUri.fsPath;

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t("Alya: Inspecting tokens (lexer)..."),
        cancellable: false,
      },
      () => {
        return new Promise<void>((resolve) => {
          const child = cp.spawn(this.serverPath, ["tokens", filePath]);
          const stdoutChunks: Buffer[] = [];
          const stderrChunks: Buffer[] = [];

          child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
          child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

          child.on("error", (err) => {
            vscode.window.showErrorMessage(
              vscode.l10n.t("Tokenization failed: {0}", err.message)
            );
            resolve();
          });

          child.on("close", async (code) => {
            if (code !== 0) {
              const stderr = Buffer.concat(stderrChunks).toString("utf8");
              vscode.window.showErrorMessage(
                vscode.l10n.t(
                  "Tokenization failed: {0}",
                  stderr || `Process exited with code ${code}`
                )
              );
              return resolve();
            }

            try {
              const stdout = Buffer.concat(stdoutChunks).toString("utf8");
              const doc = await vscode.workspace.openTextDocument({
                content: stdout,
                language: "rust",
              });

              await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Beside,
                preview: true,
                preserveFocus: true,
              });
            } catch (e: any) {
              vscode.window.showErrorMessage(
                vscode.l10n.t("Error displaying tokens: {0}", e.message)
              );
            }
            resolve();
          });
        });
      }
    );
  }
}
