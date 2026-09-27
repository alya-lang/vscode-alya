import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "..");

function pkg() {
  return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
}

function nls(locale = ""): Record<string, string> {
  const file = locale === "" ? "package.nls.json" : `package.nls.${locale}.json`;
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

describe("walkthrough contribution", () => {
  const wt = pkg().contributes.walkthroughs[0];

  it("declares five steps with media and completion events", () => {
    expect(wt.id).toBe("alya.getStarted");
    expect(wt.steps.length).toBe(5);
    for (const step of wt.steps) {
      expect(typeof step.id).toBe("string");
      expect(typeof step.title).toBe("string");
      expect(typeof step.description).toBe("string");
      expect(Array.isArray(step.completionEvents)).toBe(true);
      expect(step.completionEvents.length).toBeGreaterThan(0);
      for (const variant of ["dark", "light"]) {
        const rel = step.media.image[variant] as string;
        expect(typeof rel).toBe("string");
        const full = path.join(root, rel);
        expect(fs.existsSync(full)).toBe(true);
        expect(fs.statSync(full).size).toBeGreaterThan(200);
      }
      expect(typeof step.media.image.altText).toBe("string");
    }
  });

  it("points onCommand events at contributed commands", () => {
    const commands = new Set(
      (pkg().contributes.commands as Array<any>).map((c) => c.command)
    );
    for (const step of wt.steps) {
      for (const event of step.completionEvents as string[]) {
        if (event.startsWith("onCommand:")) {
          const cmd = event.slice("onCommand:".length);
          if (!cmd.startsWith("vscode.")) {
            expect(commands.has(cmd)).toBe(true);
          }
        }
      }
    }
  });

  it("references only existing markdown command links", () => {
    const commands = new Set(
      (pkg().contributes.commands as Array<any>).map((c) => c.command)
    );
    const linkRe = /\(command:([^)]+)\)/g;
    const texts = [wt.description as string];
    for (const step of wt.steps) {
      texts.push(step.description as string);
    }
    for (const text of texts) {
      for (const match of text.matchAll(linkRe)) {
        const cmd = match[1];
        if (!cmd.startsWith("vscode.")) {
          expect(commands.has(cmd)).toBe(true);
        }
      }
    }
  });
});

describe("walkthrough localization", () => {
  const base = nls();
  const needed = new Set<string>();
  const keyRe = /%([a-zA-Z0-9_.]+)%/g;
  const collect = (text: unknown) => {
    if (typeof text !== "string") {
      return;
    }
    for (const match of text.matchAll(keyRe)) {
      needed.add(match[1]);
    }
  };
  const wt = pkg().contributes.walkthroughs[0];
  collect(wt.title);
  collect(wt.description);
  for (const step of wt.steps) {
    collect(step.title);
    collect(step.description);
    collect(step.media.image.altText);
  }
  collect(
    (pkg().contributes.commands as Array<any>).find(
      (c) => c.command === "alya.checkCompiler"
    )?.title
  );

  it("resolves every referenced key in the base locale", () => {
    expect(needed.size).toBeGreaterThan(10);
    for (const key of needed) {
      expect(typeof base[key]).toBe("string");
    }
  });

  it("covers every key in all 20 locales", () => {
    const locales = [
      "",
      "cs",
      "de",
      "el",
      "es",
      "fr",
      "hu",
      "id",
      "it",
      "ja",
      "ko",
      "nl",
      "pl",
      "pt-br",
      "ru",
      "sv",
      "tr",
      "uk",
      "zh-cn",
      "zh-tw",
    ];
    expect(locales.length).toBe(20);
    for (const locale of locales) {
      const table = nls(locale);
      for (const key of needed) {
        expect(typeof table[key]).toBe("string");
      }
    }
  });
});
