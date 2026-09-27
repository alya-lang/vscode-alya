import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  AlyaTaskProvider,
  registerAlyaTasks,
  type TasksVscodeShim,
  type TaskLike,
} from "../src/tasks";

const root = path.resolve(__dirname, "..");

interface Call {
  definition: unknown;
  scope: unknown;
  name: string;
  source: string;
  executable?: string;
  args?: string[];
}

function stub(calls: Call[]): TasksVscodeShim {
  return {
    Task: function (
      this: any,
      definition: any,
      scope: any,
      name: string,
      source: string,
      execution?: any,
      problemMatchers?: any
    ) {
      calls.push({
        definition,
        scope,
        name,
        source,
        executable: execution?.executable,
        args: execution?.args,
      });
      const task: TaskLike = { definition, name };
      if (problemMatchers !== undefined) {
        task.problemMatchers = problemMatchers;
      }
      return task;
    } as any,
    ShellExecution: function (this: any, executable: string, args: string[]) {
      this.executable = executable;
      this.args = args;
    } as any,
    TaskScope: { Global: "GLOBAL" },
    TaskGroup: { Test: "TEST", Build: "BUILD" },
  };
}

describe("AlyaTaskProvider", () => {
  it("provides the five static tasks with shell executions", () => {
    const calls: Call[] = [];
    const tasks = new AlyaTaskProvider(stub(calls)).provideTasks();
    expect(tasks.length).toBe(5);
    const byName = new Map(tasks.map((t) => [t.name, t]));
    expect([...byName.keys()]).toEqual([
      "Alya: Run Current File",
      "Alya: Test Project",
      "Alya: Build Project",
      "Alya: Check Project",
      "Alya: Format Project",
    ]);
    const run = calls.find((c) => c.name === "Alya: Run Current File");
    expect(run?.executable).toBe("alya");
    expect(run?.args).toEqual(["run", "${file}"]);
    const test = byName.get("Alya: Test Project");
    expect(test?.group).toBe("TEST");
    const check = byName.get("Alya: Check Project");
    expect(check?.problemMatchers).toEqual(["$alya"]);
  });

  it("resolves tasks.json entries and rejects foreign ones", () => {
    const calls: Call[] = [];
    const provider = new AlyaTaskProvider(stub(calls));
    const resolved = provider.resolveTask({
      definition: { type: "alya", task: "run", file: "main.alya", args: ["--x"] },
      name: "custom",
    });
    expect(resolved?.name).toBe("custom");
    const made = calls.find((c) => c.name === "custom");
    expect(made?.args).toEqual(["run", "main.alya", "--x"]);
    expect(
      provider.resolveTask({ definition: { type: "other" }, name: "x" })
    ).toBeUndefined();
    expect(
      provider.resolveTask({ definition: { type: "alya", task: "nope" }, name: "x" })
    ).toBeUndefined();
  });

  it("registers under the alya task type", () => {
    const types: string[] = [];
    const shim = stub([]) as any;
    shim.tasks = {
      registerTaskProvider: (type: string, _provider: unknown) => {
        types.push(type);
        return { dispose: () => {} };
      },
    };
    registerAlyaTasks({ subscriptions: [] } as never, shim);
    expect(types).toEqual(["alya"]);
  });
});

describe("$alya problem matcher", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  );
  const matcher = (pkg.contributes.problemMatchers as Array<any>).find(
    (m) => m.name === "$alya"
  );

  it("is contributed with file/line/column capture", () => {
    expect(matcher).toBeDefined();
    expect(matcher.owner).toBe("alya");
    expect(matcher.pattern.length).toBe(2);
  });

  it("parses real `alya check` output", () => {
    const sample = [
      "error: Expected parameter name",
      "  --> C:/proj/main.alya:1:15",
      "  |",
      " 1 | function main(",
      "   |               ^",
    ].join("\n");
    const [first, second] = matcher.pattern;
    const m1 = new RegExp(first.regexp).exec(sample.split("\n")[0]);
    expect(m1).not.toBeNull();
    expect(m1![first.severity]).toBe("error");
    expect(m1![first.message]).toBe("Expected parameter name");
    const m2 = new RegExp(second.regexp).exec(sample.split("\n")[1]);
    expect(m2).not.toBeNull();
    expect(m2![second.file]).toBe("C:/proj/main.alya");
    expect(m2![second.line]).toBe("1");
    expect(m2![second.column]).toBe("15");
  });
});

describe("wordPattern", () => {
  it("treats :: chains as one word", () => {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(root, "language-configuration.json"), "utf8")
    );
    expect(typeof cfg.wordPattern).toBe("string");
    const re = new RegExp(`^(?:${cfg.wordPattern})$`);
    expect(re.test("pkg")).toBe(true);
    expect(re.test("pkg::helper_fn")).toBe(true);
    // Dots stay separate words (unchanged default behavior).
    expect(re.test("a.b")).toBe(false);
  });
});
