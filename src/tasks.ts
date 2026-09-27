import * as vscode from "vscode";

/**
 * `alya run/test/build/check/fmt` as VSCode tasks (`Terminal > Run Task`,
 * `preLaunchTask`, keybindings). Task labels stay plain English on purpose:
 * they double as identifiers referenced from `tasks.json` and launch
 * configs, which must not shift per locale.
 */

export type AlyaTaskKind = "run" | "test" | "build" | "check" | "fmt";

export interface AlyaTaskDefinition {
  type: "alya";
  task: AlyaTaskKind;
  /** File for `run` (defaults to the file active at execution, `${file}`). */
  file?: string;
  /** Extra CLI args appended after the built-in ones. */
  args?: string[];
}

export interface TaskLike {
  definition: unknown;
  name: string;
  group?: unknown;
  problemMatchers?: unknown;
}

export interface TasksVscodeShim {
  Task: new (
    definition: any,
    scope: any,
    name: string,
    source: string,
    execution?: any,
    problemMatchers?: any
  ) => TaskLike;
  ShellExecution: new (executable: string, args: string[]) => unknown;
  TaskScope: { Global: unknown };
  TaskGroup: { Test: unknown; Build: unknown };
}

const TASK_NAMES: Record<AlyaTaskKind, string> = {
  run: "Alya: Run Current File",
  test: "Alya: Test Project",
  build: "Alya: Build Project",
  check: "Alya: Check Project",
  fmt: "Alya: Format Project",
};

function baseArgs(kind: AlyaTaskKind, def: AlyaTaskDefinition): string[] {
  switch (kind) {
    case "run":
      return ["run", def.file ?? "${file}", ...(def.args ?? [])];
    case "test":
      return ["test", ...(def.args ?? [])];
    case "build":
      return ["build", ...(def.args ?? [])];
    case "check":
      return ["check", ...(def.args ?? [])];
    case "fmt":
      return ["fmt", ".", ...(def.args ?? [])];
  }
}

export class AlyaTaskProvider {
  constructor(private readonly vscodeNs: TasksVscodeShim) {}

  private makeTask(def: AlyaTaskDefinition, name?: string): TaskLike {
    const task = new this.vscodeNs.Task(
      def,
      this.vscodeNs.TaskScope.Global,
      name ?? TASK_NAMES[def.task],
      "alya",
      new this.vscodeNs.ShellExecution("alya", baseArgs(def.task, def))
    );
    if (def.task === "test") {
      task.group = this.vscodeNs.TaskGroup.Test;
    } else if (def.task === "build") {
      task.group = this.vscodeNs.TaskGroup.Build;
    }
    if (def.task === "check") {
      task.problemMatchers = ["$alya"];
    }
    return task;
  }

  /** Static task list shown by `Run Task`. */
  provideTasks(): TaskLike[] {
    return (Object.keys(TASK_NAMES) as AlyaTaskKind[]).map((kind) =>
      this.makeTask({ type: "alya", task: kind })
    );
  }

  /** Fills executions for user-declared `tasks.json` entries. */
  resolveTask(task: TaskLike): TaskLike | undefined {
    const def = task.definition as Partial<AlyaTaskDefinition> | undefined;
    const kind = def?.task;
    if (def?.type !== "alya" || kind === undefined || !(kind in TASK_NAMES)) {
      return undefined;
    }
    return this.makeTask(
      {
        type: "alya",
        task: kind,
        file: def.file,
        args: def.args,
      },
      task.name
    );
  }
}

export function registerAlyaTasks(
  context: vscode.ExtensionContext,
  vscodeNs: TasksVscodeShim & {
    tasks: {
      registerTaskProvider(
        type: string,
        provider: {
          provideTasks(): any;
          resolveTask(task: any): any;
        }
      ): vscode.Disposable;
    };
  }
): void {
  context.subscriptions.push(
    vscodeNs.tasks.registerTaskProvider("alya", new AlyaTaskProvider(vscodeNs))
  );
}
