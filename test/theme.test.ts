import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "..");
const themePath = path.join(root, "themes", "alya-dark-color-theme.json");

describe("Alya Dark color theme", () => {
  const theme = JSON.parse(fs.readFileSync(themePath, "utf8"));

  it("is a dark theme with the brand bracket palette", () => {
    expect(theme.type).toBe("dark");
    const brackets = [
      "#38bdf8",
      "#c084fc",
      "#34d399",
      "#818cf8",
      "#e0f2fe",
      "#a855f7",
    ];
    brackets.forEach((color, i) => {
      expect(theme.colors[`editorBracketHighlight.foreground${i + 1}`]).toBe(
        color
      );
      expect(
        theme.colors[`editorBracketPairGuide.activeBackground${i + 1}`]
      ).toBe(color);
    });
    expect(
      theme.colors["editorBracketHighlight.unexpectedBracket.foreground"]
    ).toBeDefined();
  });

  it("covers the grammar scopes the Alya TextMate grammar emits", () => {
    const covered = new Set<string>();
    for (const rule of theme.tokenColors) {
      const scopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
      for (const s of scopes) {
        covered.add(s);
      }
    }
    for (const scope of [
      "comment",
      "keyword",
      "string",
      "punctuation.definition.string",
      "constant.numeric",
      "constant.language",
      "entity.name.function",
      "entity.name.type",
      "support.function",
      "variable.language",
      "invalid",
    ]) {
      expect(covered.has(scope)).toBe(true);
    }
  });

  it("maps the semantic types the Alya LSP emits", () => {
    for (const type of [
      "type",
      "enum",
      "enumMember",
      "struct",
      "interface",
      "parameter",
      "variable",
      "property",
      "function",
      "method",
      "string",
      "number",
    ]) {
      expect(typeof theme.semanticTokenColors[type]).toBe("string");
    }
  });

  it("is contributed by package.json at an existing path", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8")
    );
    const entry = (pkg.contributes.themes as Array<any>).find(
      (t) => t.label === "Alya Dark"
    );
    expect(entry).toBeDefined();
    expect(entry.uiTheme).toBe("vs-dark");
    expect(fs.existsSync(path.join(root, entry.path))).toBe(true);
  });
});
