import * as vscode from "vscode";

/**
 * Alya Debug Configuration Provider.
 * Provides default launch configurations and dynamically resolves program paths.
 */
export class AlyaDebugConfigurationProvider
  implements vscode.DebugConfigurationProvider
{
  /**
   * Provide initial debug configurations when launch.json is generated or requested.
   */
  provideDebugConfigurations(
    _folder: vscode.WorkspaceFolder | undefined,
    _token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [
      {
        type: "alya",
        request: "launch",
        name: "Alya: Launch Current File",
        program: "${file}",
        stopOnEntry: false,
        memTrace: false,
      },
      {
        type: "alya",
        request: "launch",
        name: "Alya: Run Tests",
        program: "${workspaceFolder}/tests",
        stopOnEntry: false,
        args: ["test"],
      },
      {
        type: "alya",
        request: "launch",
        name: "Alya: Run with Memory Leak Trace",
        program: "${file}",
        stopOnEntry: false,
        memTrace: true,
      },
    ];
  }

  /**
   * Resolve a debug configuration just before a debug session is being launched.
   */
  resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    _token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    // If no configuration is provided (e.g. F5 pressed on open file without launch.json)
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === "alya") {
        config.type = "alya";
        config.name = "Launch Current Alya File";
        config.request = "launch";
        config.program = "${file}";
        config.stopOnEntry = false;
        config.memTrace = false;
      }
    }

    if (!config.program) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === "alya") {
        config.program = editor.document.uri.fsPath;
      } else {
        vscode.window.showErrorMessage(
          "Cannot start Alya debugging: No active Alya file or 'program' attribute specified in launch.json."
        );
        return undefined;
      }
    }

    // Resolve ${file} if needed
    if (config.program === "${file}") {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        config.program = editor.document.uri.fsPath;
      }
    }

    // Resolve ${workspaceFolder} if needed
    if (
      folder &&
      typeof config.program === "string" &&
      config.program.includes("${workspaceFolder}")
    ) {
      config.program = config.program.replace(
        "${workspaceFolder}",
        folder.uri.fsPath
      );
    }

    if (config.memTrace === undefined) {
      const memTraceSetting = vscode.workspace
        .getConfiguration("alya.run")
        .get<boolean>("memTrace", false);
      config.memTrace = memTraceSetting;
    }

    return config;
  }
}

/**
 * Alya Debug Adapter Descriptor Factory.
 * Spawns the Alya DAP server executable (`alya dap`).
 */
export class AlyaDebugAdapterDescriptorFactory
  implements vscode.DebugAdapterDescriptorFactory
{
  createDebugAdapterDescriptor(
    _session: vscode.DebugSession,
    _executable: vscode.DebugAdapterExecutable | undefined
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    const config = vscode.workspace.getConfiguration("alya");
    const dapPath =
      config.get<string>("debug.path") ||
      config.get<string>("lsp.path") ||
      "alya";

    // Launch `alya dap` communicating over stdin/stdout
    const options: vscode.DebugAdapterExecutableOptions = {
      cwd:
        _session.workspaceFolder?.uri.fsPath ||
        (vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0
          ? vscode.workspace.workspaceFolders[0].uri.fsPath
          : undefined),
    };

    return new vscode.DebugAdapterExecutable(dapPath, ["dap"], options);
  }
}
