import { mock } from "bun:test";

mock.module("vscode", () => {
  return {
    window: {
      activeTextEditor: undefined,
      showErrorMessage: () => {},
      showInformationMessage: () => {},
      showWarningMessage: () => {},
      createTerminal: () => ({ show: () => {}, sendText: () => {} }),
      terminals: [],
    },
    workspace: {
      getConfiguration: () => ({
        get: (_key: string, defaultValue: any) => defaultValue,
      }),
      workspaceFolders: [],
      onDidSaveTextDocument: () => ({ dispose: () => {} }),
      createFileSystemWatcher: () => ({ dispose: () => {} }),
    },
    commands: {
      registerCommand: () => ({ dispose: () => {} }),
      executeCommand: () => Promise.resolve(),
    },
    languages: {
      registerCodeLensProvider: () => ({ dispose: () => {} }),
    },
    debug: {
      registerDebugConfigurationProvider: () => ({ dispose: () => {} }),
      registerDebugAdapterDescriptorFactory: () => ({ dispose: () => {} }),
      startDebugging: () => Promise.resolve(true),
    },
    DebugAdapterExecutable: class {
      command: string;
      args: string[];
      options: any;
      constructor(command: string, args: string[], options: any) {
        this.command = command;
        this.args = args;
        this.options = options;
      }
    },
    Range: class {
      start: { line: number; character: number };
      end: { line: number; character: number };
      constructor(
        startLine: number,
        startCharacter: number,
        endLine: number,
        endCharacter: number
      ) {
        this.start = { line: startLine, character: startCharacter };
        this.end = { line: endLine, character: endCharacter };
      }
    },
    CodeLens: class {
      range: any;
      command: any;
      constructor(range: any, command: any) {
        this.range = range;
        this.command = command;
      }
    },
    Position: class {
      line: number;
      character: number;
      constructor(line: number, character: number) {
        this.line = line;
        this.character = character;
      }
    },
  };
});
