import { describe, it, expect } from "bun:test";
import {
  AlyaDebugConfigurationProvider,
  AlyaDebugAdapterDescriptorFactory,
} from "../src/debugAdapter";

describe("Alya Debug Adapter Protocol", () => {
  it("provides predefined launch configurations", () => {
    const provider = new AlyaDebugConfigurationProvider();
    const configs = provider.provideDebugConfigurations(undefined) as any[];

    expect(configs).toBeDefined();
    expect(configs.length).toBe(3);

    const names = configs.map((c) => c.name);
    expect(names).toContain("Alya: Launch Current File");
    expect(names).toContain("Alya: Run Tests");
    expect(names).toContain("Alya: Run with Memory Leak Trace");

    const currentFileConfig = configs.find(
      (c) => c.name === "Alya: Launch Current File"
    );
    expect(currentFileConfig.type).toBe("alya");
    expect(currentFileConfig.request).toBe("launch");
    expect(currentFileConfig.program).toBe("${file}");
    expect(currentFileConfig.memTrace).toBe(false);

    const memTraceConfig = configs.find(
      (c) => c.name === "Alya: Run with Memory Leak Trace"
    );
    expect(memTraceConfig.memTrace).toBe(true);
  });

  it("resolves workspace folder variable in program path", () => {
    const provider = new AlyaDebugConfigurationProvider();
    const fakeFolder: any = {
      uri: { fsPath: "E:/MyProject/App" },
    };
    const resolved = provider.resolveDebugConfiguration(fakeFolder, {
      type: "alya",
      name: "Run Tests",
      request: "launch",
      program: "${workspaceFolder}/tests/main.alya",
    }) as any;

    expect(resolved).toBeDefined();
    expect(resolved.program).toBe("E:/MyProject/App/tests/main.alya");
  });

  it("creates debug adapter descriptor pointing to 'alya dap'", () => {
    const factory = new AlyaDebugAdapterDescriptorFactory();
    const session: any = {
      workspaceFolder: { uri: { fsPath: "E:/MyProject/App" } },
    };
    const descriptor = factory.createDebugAdapterDescriptor(session, undefined) as any;

    expect(descriptor).toBeDefined();
    expect(descriptor.command).toBe("alya");
    expect(descriptor.args).toEqual(["dap"]);
    expect(descriptor.options.cwd).toBe("E:/MyProject/App");
  });
});
