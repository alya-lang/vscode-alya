# Contributing to Alya for VS Code

Thank you for your interest in contributing to the **Alya** VS Code extension! We welcome bug reports, feature requests, documentation improvements, and pull requests.

---

## Development Setup

### Prerequisites

1. **[Bun](https://bun.sh)** (v1.1 or later):
   ```bash
   bun --version
   ```
2. **[Alya Compiler](https://github.com/alya-lang/alya)** (in system `PATH`):
   ```bash
   alya --version
   ```
3. **Visual Studio Code** (v1.80.0 or later).

---

## Getting Started

1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/alya-lang/vscode-alya.git
   cd vscode-alya
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Build the extension**:
   ```bash
   bun run build
   ```

4. **Debugging in VS Code**:
   - Open this folder in VS Code (`code .`).
   - Press **`F5`** (or go to `Run and Debug` -> `Run Extension`).
   - A new VS Code **Extension Development Host** window will open with the development extension loaded.
   - Open any `.alya` file to test syntax highlighting, formatting, CodeLens, and LSP features.

5. **Package the `.vsix` file**:
   ```bash
   bun run package
   ```

---

## Pull Request Guidelines

1. Create a descriptive feature branch:
   ```bash
   git checkout -b feature/my-cool-feature
   ```
2. Make sure `bun run build` and `bun run package` succeed cleanly with zero errors.
3. If your changes are user-facing, update `CHANGELOG.md` under an `[Unreleased]` section.
4. Submit a Pull Request targeting the `main` branch, filling out the PR template.

---

## Reporting Issues

- **Bug Reports**: Use the [Bug Report template](https://github.com/alya-lang/vscode-alya/issues/new?template=bug_report.yml). Please include VS Code version, OS, and language server logs.
- **Feature Requests**: Use the [Feature Request template](https://github.com/alya-lang/vscode-alya/issues/new?template=feature_request.yml).
- **Core Compiler Issues**: If the issue is with compilation, parsing, or codegen, report it in the [main Alya repository](https://github.com/alya-lang/alya/issues).
