# Changelog

All notable changes to the **Alya** VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.2] - 2026-09-19

### Fixed
- **Large File AST & Token Dumps**: Replaced `child_process.execFile` with streaming `cp.spawn` chunk accumulation for `View Abstract Syntax Tree (AST)` and `View Tokens (Lexer)`. Files with large AST dumps (exceeding Node's 1MB default buffer) now load smoothly without `stdout maxBuffer length exceeded` errors.
- **Progress Notifications**: Added interactive progress notifications while generating AST dumps and tokenizing files.
- **LSP Transport Resilience**: Hardened `read_framed_message` in `alya lsp` against leading newlines, case-insensitive headers, and JSON parse errors to prevent sudden server exits that caused `write EPIPE` crashes.
- **Graceful LSP Client Restart**: Added exception handling around LSP client shutdown/restart to suppress noisy pipe errors.

---

## [0.3.1] - 2026-09-19

### Added
- **Memory Diagnostics & Heap Trace (`alya.runFileWithMemTrace`)**: Run any active `.alya` file with `--mem-trace` enabled directly from editor title bar icon, right-click context menu, or Quick Actions. Provides real-time heap statistics (allocations, frees, active bytes, live object counters) and leak detection.
- **`$(pulse) Mem Trace` CodeLens**: Added 1-click memory trace CodeLens right above `function main()` / `fn main()`.
- **Configuration Setting (`alya.run.memTrace`)**: Added workspace/user setting to toggle `--mem-trace` flag by default for all file runs.

---

## [0.3.0] - 2026-09-18

### Added
- **Smart Docstring & Summary Generator (`Ctrl+Alt+D` / Lightbulb)**: Context-aware docstring generator adhering to `Src/spec`. Automatically humanizes function names into natural language summaries, infers parameter and return descriptions, inspects function bodies for `throw` statements to generate `### Throws`, and parses `struct` fields, `enum` variants, and `interface` methods.
- **Official VS Code Test Explorer**: Full native integration with VS Code's Testing sidebar via the Test Controller API. Automatically discovers `test "..."` blocks, runs suites, and reports pass/fail with execution durations.
- **Native Assembly Inspector (`Alya: View Assembly Output`)**: Compile any `.alya` file directly to native GNU/Mach-O assembly (`-S`) and display it side-by-side with assembly syntax highlighting.
- **AST & Token Inspector**: Instant side-by-side visualization of parsed Abstract Syntax Trees (`Alya: View AST Dump`) and lexical token streams (`Alya: View Tokens`).
- **Interactive Status Bar**: Real-time compiler version indicator and LSP status (`Ready`, `Starting`, `Restarting`) in the bottom status bar, with a 1-click quick actions menu.
- **LSP Lifecycle Management**: Added `Alya: Restart Language Server` command.

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
- **Interactive Commands**: Run Current File, Run Tests, Open REPL, Format Document, Generate Documentation.
- **Rich Code Snippets**: Comprehensive templates for functions, entry points, `struct`, `enum`, `when`, `if`, `while`, `for`, `try`, `extern "C"`, `spawn`, `defer`, and `say`.

---

## [0.1.0] - 2026-09-18

### Added
- Initial release of the Alya VS Code extension.
- Syntax highlighting via TextMate grammar (`syntaxes/alya.tmLanguage.json`).
- Language configuration for line comments (`#`), bracket matching, and auto-closing pairs.
- Language Server Protocol (LSP) client connected to `alya lsp`.
- Real-time diagnostics, autocompletion, hover documentation, and go-to-definition.
