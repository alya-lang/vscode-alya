# Changelog

All notable changes to the **Alya** VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.1] - 2026-09-18

### Added
- Official Alya brand file icons for `.alya` files with automatic Dark/Light mode switching.
- Dedicated `Alya File Icons` theme (`icons/alya-icon-theme.json`).
- High-resolution 3D Delta Prism extension icon for VS Code Marketplace and Extensions tab.
- Packaging optimizations with `.vscodeignore`.

---

## [0.2.0] - 2026-09-18

### Added
- **Integrated Formatter**: Direct formatting support using native `alya fmt` (`Format Document` & `Format on Save`).
- **CodeLens**: One-click `▶ Run` above `function main()` and `🧪 Run Test` above `test "..."` blocks.
- **Title Bar & Context Menus**: Run File and Run Tests buttons in the editor title bar and right-click menu.
- **Interactive Commands**:
  - `Alya: Run Current File`
  - `Alya: Run Tests`
  - `Alya: Open REPL`
  - `Alya: Format Document`
  - `Alya: Generate Documentation`
- **Rich Code Snippets**: Comprehensive templates for functions (`fn`, `pubfn`), entry points (`main`, `mainargs`), `struct`, `enum`, `when`, `if`, `while`, `for`, `try`, `extern "C"`, `spawn`, `defer`, and `say`.

---

## [0.1.0] - 2026-09-18

### Added
- Initial release of the Alya VS Code extension.
- Syntax highlighting via TextMate grammar (`syntaxes/alya.tmLanguage.json`).
- Language configuration for line comments (`#`), bracket matching, and auto-closing pairs.
- Language Server Protocol (LSP) client connected to `alya lsp`.
- Real-time diagnostics, autocompletion, hover documentation, and go-to-definition.
