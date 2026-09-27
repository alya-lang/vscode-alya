import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "..");

interface ThemeCase {
  file: string;
  label: string;
  uiTheme: string;
  type: string;
  brackets: string[];
  checks: Array<[string, string]>;
}

const THEMES: ThemeCase[] = [
  {
    file: "alya-dark-color-theme.json",
    label: "Alya Dark",
    uiTheme: "vs-dark",
    type: "dark",
    brackets: [
      "#38bdf8",
      "#c084fc",
      "#34d399",
      "#818cf8",
      "#e0f2fe",
      "#a855f7",
    ],
    checks: [
      ["keyword.other.unit-testing", "#38bdf8"],
      ["string", "#34d399"],
      ["entity.name.function", "#38bdf8"],
    ],
  },
  {
    file: "alya-light-color-theme.json",
    label: "Alya Light",
    uiTheme: "vs",
    type: "light",
    brackets: [
      "#0284c7",
      "#7c3aed",
      "#059669",
      "#4f46e5",
      "#0369a1",
      "#a21caf",
    ],
    checks: [
      ["keyword.other.unit-testing", "#0284c7"],
      ["string", "#047857"],
      ["entity.name.function", "#0369a1"],
    ],
  },
];

describe.each(THEMES)("Alya theme $label", (theme) => {
  const parsed = JSON.parse(
    fs.readFileSync(path.join(root, "themes", theme.file), "utf8")
  );

  it("declares type, bracket palette, and inlay colors", () => {
    expect(parsed.type).toBe(theme.type);
    // Semantic tokens must render under the default
    // `configuredByTheme` setting: the theme has to opt in.
    expect(parsed.semanticHighlighting).toBe(true);
    expect(parsed.type).toBe(theme.type);
    theme.brackets.forEach((color, i) => {
      expect(parsed.colors[`editorBracketHighlight.foreground${i + 1}`]).toBe(
        color
      );
      expect(
        parsed.colors[`editorBracketPairGuide.activeBackground${i + 1}`]
      ).toBe(color);
    });
    expect(
      parsed.colors["editorBracketHighlight.unexpectedBracket.foreground"]
    ).toBeDefined();
    expect(parsed.colors["editorInlayHint.foreground"]).toBeDefined();
  });

  it("covers the grammar scopes the Alya TextMate grammar emits", () => {
    const covered = new Set<string>();
    for (const rule of parsed.tokenColors) {
      const scopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
      for (const s of scopes) {
        covered.add(s);
      }
    }
    for (const scope of [
      "comment",
      "keyword",
      "keyword.other.unit-testing",
      "string",
      "punctuation.definition.string",
      "constant.numeric",
      "constant.language",
      "entity.name.function",
      "entity.name.type",
      "entity.name.namespace",
      "support.function",
      "variable.language",
      "invalid",
    ]) {
      expect(covered.has(scope)).toBe(true);
    }
    for (const [scope, color] of theme.checks) {
      const rule = parsed.tokenColors.find((r: any) => {
        const scopes = Array.isArray(r.scope) ? r.scope : [r.scope];
        return scopes.includes(scope);
      });
      expect(rule).toBeDefined();
      expect(rule.settings.foreground).toBe(color);
    }
  });

  it("maps the semantic types the Alya LSP emits", () => {
    for (const type of [
      "type",
      "namespace",
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
      expect(typeof parsed.semanticTokenColors[type]).toBe("string");
    }
  });

  it("is contributed by package.json at an existing path", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8")
    );
    const entry = (pkg.contributes.themes as Array<any>).find(
      (t) => t.label === theme.label
    );
    expect(entry).toBeDefined();
    expect(entry.uiTheme).toBe(theme.uiTheme);
    expect(fs.existsSync(path.join(root, entry.path))).toBe(true);
  });
});

describe("Alya File Icons theme", () => {
  it("maps .alya files to the bundled brand icons", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8")
    );
    const entry = (pkg.contributes.iconThemes as Array<any>).find(
      (t) => t.id === "alya-file-icons"
    );
    expect(entry).toBeDefined();
    const theme = JSON.parse(
      fs.readFileSync(path.join(root, entry.path), "utf8")
    );
    expect(theme.fileExtensions["alya"]).toBeDefined();
    expect(theme.light.fileExtensions["alya"]).toBeDefined();
    for (const key of [theme.fileExtensions["alya"], theme.light.fileExtensions["alya"]]) {
      const iconPath = path.join(root, "icons", theme.iconDefinitions[key].iconPath.replace(/^\.\//, ""));
      expect(fs.existsSync(iconPath)).toBe(true);
    }
  });
});
