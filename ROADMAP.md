# 🗺️ Alya VS Code Extension Roadmap

This document outlines the strategic roadmap, planned architectural enhancements, and feature milestones for the official **Alya VS Code Extension** (`vscode-alya`) and its underlying Language Server (`alya lsp`).

---

## 🎯 Current Status (v0.5.0)

- [x] Full text document synchronization (`textDocumentSync: 1`)
- [x] Syntax and Gradual Type checking diagnostics (`textDocument/publishDiagnostics`)
- [x] Real-time Linter diagnostics and Quick-Fix code actions (`textDocument/codeAction`)
- [x] Identifier, keyword, and member completion (`textDocument/completion`)
- [x] Markdown docstring hover inspection (`textDocument/hover`)
- [x] Definition navigation (`textDocument/definition`)
- [x] Native in-memory document formatting (`textDocument/formatting`)
- [x] Hierarchical document symbols and Outline navigation (`textDocument/documentSymbol`)
- [x] Find All References across open documents (`textDocument/references`)
- [x] AST-driven block, comment, and import folding ranges (`textDocument/foldingRange`)
- [x] Package & Benchmark Test Explorer (`tests/*.alya`, `benches/*.alya`, `test_suite`, `bench_runner`)
- [x] Native `vscode.TestRun` reporting with clickable failure locations and visual diffs
- [x] Re-run failed tests & auto-run on save (`alya.testing.autoRunOnSave`)
- [x] CodeLens execution (`main` run, `test` blocks, `test_suite`, `bench_runner`)
- [x] Official SVG brand file icon theme (Light/Dark)
- [x] Automatic docstring generator (`alya.generateDocstring`, `Ctrl+Alt+D`)
- [x] Native assembly (`-S`), AST, and token inspector webviews

---

## 🚀 Milestone 1: Core LSP Navigation & Structural Intelligence (v0.4.0) ✅

Enhance code navigation, workspace structural comprehension, and in-memory formatting.

### 1.1 Document Symbols & Outline (`textDocument/documentSymbol`)
- [x] Provide hierarchical outline symbols for:
  - `Function` (`function`, `pub function`, struct methods `Struct.method`)
  - `Struct` (`struct`, `pub struct`)
  - `Enum` (`enum`, `pub enum`) and their variants
  - `Interface` (`interface`, `pub interface`)
  - `Constant` (`const`, `pub const`)
- [x] Enable VS Code **Outline view** in the File Explorer.
- [x] Enable **Breadcrumbs** navigation at the top of the editor.
- [x] Support **Go to Symbol in File** (`Ctrl+Shift+O`).

### 1.2 In-Memory Native LSP Formatting (`textDocument/formatting`)
- [x] Migrate document formatting from extension-side temp files (`os.tmpdir()` + `cp.execFile`) to native LSP `textDocument/formatting`.
- [x] Format directly in memory inside the `alya lsp` process, eliminating child process spawning and disk I/O overhead.
- [x] Enable formatting support for other LSP clients (Neovim, Helix, Zed, Emacs).

### 1.3 Find All References (`textDocument/references`)
- [x] Implement `textDocument/references` to discover all usages of variables, functions, structs, and enum variants.
- [x] Support `Shift+F12` ("Find All References") and reference count CodeLens.

### 1.4 Workspace & Document Folding Ranges (`textDocument/foldingRange`)
- [x] AST-driven folding ranges for:
  - Block declarations (`function ... end`, `struct ... end`, `enum ... end`, `interface ... end`)
  - Control flow structures (`if ... elif ... else ... end`, `while ... end`, `for ... end`, `repeat ... end`)
  - Multi-line block comments (`/* ... */`) and documentation comments (`## ...`)
- [x] Eliminates reliance on indentation-based folding.

---

## 🧪 Milestone 2: Comprehensive Test Explorer & Package Testing (v0.5.0) ✅

Upgrade the test controller from regex line-matching to a robust package-aware test runner.

### 2.1 Package & Suite Discovery
- [x] Automatically discover all standard package test suites in `tests/*.alya` (matching `alya test` CLI discovery).
- [x] Support both inline `test "..."` keyword blocks and `std/test` suite runners (`test_suite(...)`, `runner_new()`, `main()`).
- [x] Discover benchmark suites in `benches/*.alya` (`bench_runner(...)`).

### 2.2 Rich Test Execution & Reporting
- [x] Replace plain terminal output with native `vscode.TestRun` API reporting:
  - Per-test pass/fail status
  - Individual assertion count and elapsed duration
  - Exact failure line numbers with visual diffs and assertion messages
- [x] Support "Run Test at Cursor" and "Debug Test" shortcuts.

### 2.3 Smart Re-Run & Coverage Readiness
- [x] Re-run only failed tests.
- [x] Auto-run tests on file save (configurable: `alya.testing.autoRunOnSave`).

---

## 🎨 Milestone 3: Developer Experience & Refactoring (v0.6.0)

Provide first-class editing ergonomics and safe refactoring tools.

### 3.1 Signature Help & Parameter Info (`textDocument/signatureHelp`)
- [ ] Automatically trigger signature help when typing `(` or `,`.
- [ ] Display parameter names, type annotations, and default parameter values.
- [ ] Highlight active parameter as the developer types arguments.

### 3.2 Symbol Renaming & Safe Refactoring (`textDocument/rename`)
- [ ] Implement `textDocument/prepareRename` and `textDocument/rename`.
- [ ] Allow safe, workspace-wide symbol renaming with `F2`.
- [ ] Return transactional `WorkspaceEdit` preventing partial/corrupt renames.

### 3.3 Inlay Hints for Inferred Types & Parameters (`textDocument/inlayHint`)
- [ ] Inlay type hints: Display compiler-inferred types for untyped declarations (`let count /* : int */ = 42`).
- [ ] Parameter name hints: Display parameter names inline for call sites (`scale(/*factor:*/ 2.5)`).
- [ ] Configurable toggle (`alya.inlayHints.enabled`).

### 3.4 Smart Bracket & Keyword Autocompletion
- [ ] Implement `onEnterRules` in `language-configuration.json`:
  - Automatically indent and insert matching `end` after typing `function`, `if`, `while`, `for`, `struct`, `repeat`, `enum`, `interface`.
- [ ] Electric pairs for quotes, backticks, string interpolations (`{"..."}`), and runes (`'...'`).

### 3.5 Semantic Highlighting (`textDocument/semanticTokens/full`)
- [ ] AST-driven semantic token classification:
  - Distinct colors for custom types, interfaces, and struct members.
  - Distinguish between mutable local variables, parameters, and constants.
  - Enum variant discrimination.

---

## 🐞 Milestone 4: Debugger Integration & Packaging (v1.0.0)

Complete the IDE toolchain with debugging capabilities and automated releases.

### 4.1 Debug Adapter Protocol (DAP)
- [ ] Implement Alya Debug Adapter Protocol (DAP) integration.
- [ ] Support breakpoints, step in / step over / step out, and variable evaluation.
- [ ] Provide predefined `launch.json` templates:
  - `Alya: Launch Current File`
  - `Alya: Run Tests`
  - `Alya: Run with Memory Leak Trace`

### 4.2 CI/CD & Marketplace Automated Publishing
- [ ] GitHub Actions workflow for automated `.vsix` packaging on tagged releases.
- [ ] Automated publishing to:
  - **Visual Studio Marketplace** (`alya-lang.alya-lsp`)
  - **Open VSX Registry** (for VSCodium, Gitpod, Eclipse Theia)

---

## 📊 Priority Matrix

| Feature | Target Version | Category | Complexity | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Document Symbols (Outline & Breadcrumbs)** | `v0.4.0` | LSP Server | Medium | High |
| **In-Memory Formatting** | `v0.4.0` | LSP Server | Low | High |
| **Package Test Discovery (`tests/*.alya`)** | `v0.5.0` | Extension | Medium | High |
| **Find All References** | `v0.4.0` | LSP Server | Medium | High |
| **Signature Help** | `v0.6.0` | LSP Server | Medium | High |
| **Symbol Renaming (`F2`)** | `v0.6.0` | LSP Server | High | Medium |
| **Smart `end` Insertion** | `v0.5.0` | Extension | Low | High |
| **Inlay Hints** | `v0.6.0` | LSP Server | Medium | Medium |
| **Semantic Highlighting** | `v0.6.0` | LSP Server | High | Medium |
| **Debug Adapter Protocol (DAP)** | `v1.0.0` | Tooling | Very High | High |
| **Marketplace Publishing CI** | `v1.0.0` | DevOps | Low | High |
