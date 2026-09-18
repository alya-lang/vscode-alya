<p align="center">
  <img src="https://raw.githubusercontent.com/alya-lang/vscode-alya/main/icons/alya-icon.png" width="128" height="128" alt="Alya Logo" />
</p>

<h1 align="center">Alya for Visual Studio Code</h1>

<p align="center">
  Official Visual Studio Code extension providing full Language Server Protocol (LSP) intelligence, formatting, CodeLens, snippets, and official brand file icons for the <b>Alya</b> programming language.
</p>

<p align="center">
  <a href="https://github.com/alya-lang/vscode-alya/actions"><img src="https://img.shields.io/github/actions/workflow/status/alya-lang/vscode-alya/ci.yml?branch=main&label=CI&style=flat-square" alt="CI Status" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=alya-lang.alya-lsp"><img src="https://img.shields.io/visual-studio-marketplace/v/alya-lang.alya-lsp?style=flat-square&color=purple" alt="Marketplace Version" /></a>
  <a href="https://github.com/alya-lang/vscode-alya/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
  <a href="https://alya-lang.org"><img src="https://img.shields.io/badge/website-alya--lang.org-0284c7?style=flat-square" alt="Website" /></a>
</p>

---

## 🌟 Key Features

### 1. 🧠 Language Server Protocol (LSP)
Powered by the native `alya lsp` engine:
* **Instant Diagnostics**: Real-time syntax and type error reporting as you type.
* **Smart Autocompletion**: Context-aware completion for keywords, variables, struct fields, and functions (`Ctrl+Space`).
* **Hover Tooltips**: Signature inspection and Markdown docstrings (`##`).
* **Go to Definition**: Jump directly to function, struct, and symbol definitions (`F12`).

### 2. ⚡ CodeLens (One-Click Execution & Testing)
* **`▶ Run`**: Appears automatically above `function main()`. Click to run the program in an integrated Alya terminal.
* **`🧪 Run Test`**: Appears above each `test "..."` block to execute individual test suites directly.

### 3. 🎨 Official Brand File Icons & Theme
* Embedded vector SVGs with automatic **Dark** and **Light** mode switching for `.alya` files.
* Includes the standalone **`Alya File Icons`** theme (`Preferences: File Icon Theme` ➔ `Alya File Icons`).

### 4. 🧹 In-Place Code Formatter (`alya fmt`)
* Native integration with the Alya compiler's formatter:
  * **Format Document**: `Shift+Alt+F`
  * **Format on Save**: Automatic formatting upon saving (`"editor.formatOnSave": true`).

### 5. ✂️ Rich Code Snippets
Tab-triggered templates for all major language idioms:
* `fn` / `pubfn` ➔ Function definitions
* `main` / `mainargs` ➔ Program entry point functions
* `struct` / `pubstruct` ➔ Struct definitions
* `enum` ➔ Enumerations
* `test` ➔ Unit and integration test blocks
* `when` ➔ Pattern matching cascades
* `if` / `ifelse` ➔ Conditional branching
* `while` / `for` ➔ Loop constructs
* `try` ➔ Exception handling (`try ... catch ... finally ... end`)
* `extern` ➔ Foreign Function Interface (`extern "C"`)
* `spawn` ➔ Colorless concurrency fiber dispatch
* `defer` ➔ Scope-exit deferred cleanup

### 6. 🛠️ Interactive Commands & Menus
* **Title Bar Buttons**: Instant `▶` Run and `🧪` Test buttons on every `.alya` file.
* **Context Menu**: Right-click anywhere in an `.alya` file to run, test, or open the REPL.
* **Command Palette (`Ctrl+Shift+P`)**:
  * `Alya: Run Current File`
  * `Alya: Run Tests`
  * `Alya: Open REPL`
  * `Alya: Format Document`
  * `Alya: Generate Documentation`

---

## 🚀 Prerequisites

Ensure the `alya` compiler is installed and available in your system `PATH`:

```bash
alya --version
```

If not installed, install or build Alya from the [official repository](https://github.com/alya-lang/alya).

---

## ⚙️ Configuration

Configure the extension in your user or workspace `settings.json`:

```json
{
  "alya.lsp.path": "alya",
  "alya.lsp.arguments": ["lsp"],
  "editor.formatOnSave": true
}
```

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `alya.lsp.path` | `string` | `"alya"` | Path to the `alya` compiler binary. |
| `alya.lsp.arguments` | `array` | `["lsp"]` | CLI arguments passed to launch the LSP server. |

---

## 📦 Building from Source

This extension uses [Bun](https://bun.sh) for ultra-fast bundling and dependency management:

```bash
# Clone repository
git clone https://github.com/alya-lang/vscode-alya.git
cd vscode-alya

# Install dependencies
bun install

# Bundle extension
bun run build

# Package .vsix
bun run package
```

To install the built `.vsix` into VS Code:
```bash
code --install-extension alya-lsp-0.2.1.vsix
```

---

## 📄 License

This extension is licensed under the [MIT License](LICENSE).
Copyright (c) 2026 Taiizor and the Alya Project Authors.
