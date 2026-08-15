# 🤖 Local AI Agent v1.4.0 (Chrome to OS Bridge)

![Python](https://img.shields.io/badge/Python-3.8%2B-blue)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)
![Windows](https://img.shields.io/badge/OS-Windows-0078D6?logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/OS-macOS-000000?logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/OS-Linux-FCC624?logo=linux&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-orange)

A powerful, secure, and automated bridge that allows web-based AI models (like **ChatGPT, Claude, DeepSeek, and Gemini**) to interact directly with your local operating system. By utilizing Chrome's **Native Messaging API**, this project injects a one-click execution environment directly into your browser. 

As of **v1.4.0**, the architecture has been fortified with a **Static Security Sandbox** and **UI Concurrency Locks**. It safely executes local Python scripts, supports real-time interactive terminal input (`input()`), provides a hardware-level Kill Switch, and now proactively intercepts any AI-generated code attempting to overwrite or delete your local files. Your web AI is now a fully autonomous, highly interactive, and bulletproof local execution agent!

## ✨ Features

- **🛡️ Static Security Sandbox (NEW in v1.4.0):** AI hallucinated a destructive command? No problem. The backend performs a regex-based static code analysis before execution to detect sensitive file operations (e.g., `os.remove`, `open('w')`, `df.to_csv`, `wb.save`). If detected, execution halts and a browser warning pops up. You can choose to block the action or forcefully bypass the sandbox.
- **🔒 UI Concurrency Locks & State Cleanup (NEW in v1.4.0):** Eliminated race conditions. The UI now physically locks during execution to prevent accidental double-clicks, and intelligently cleans up orphaned UI states (like lingering Input boxes or Stop buttons) during unexpected network drops or background crashes.
- **⏹️ Hardware-Level Kill Switch (v1.3.0):** Caught in an infinite loop or heavy computation? A dynamic red `⏹️ Stop` button instantly severs the pipeline, forcing the OS to cleanly terminate the underlying Python process with zero zombie processes left behind.
- **⌨️ Interactive Terminal I/O (v1.2.0):** Scripts are no longer static! The agent fully supports Python's native `input()` function with a sleek text box that dynamically renders beneath the code block.
- **🔌 Full-Duplex Persistent Connection (v1.2.0):** A robust communication pipeline utilizing a steady event loop, allowing for complex, multi-step code execution without dropping the connection.
- **🔄 Automated AI Feedback Loop:** Automatically captures standard output (`print`) and Python error tracebacks. It then seamlessly pastes the terminal results directly back into the AI's chatbox, allowing the AI to instantly see the results and debug its own code!
- **🚀 One-Click UI Injection:** Automatically injects a native `🚀 Run in Local` button directly onto code blocks in standard AI chat interfaces.
- **📦 Smart Dependency Management:** Automatically scans Python `import` statements, detects missing libraries, and prompts you via the browser to install them via `pip` with a single click.

## 🏗️ Architecture

This project implements a seamless Inter-Process Communication (IPC) architecture with an advanced feedback, interactive IO, and security engine:

1. **Frontend (Chrome Extension):** Uses Singleton & Concurrency Locks to prevent duplicate UI injections and race conditions. It captures code from the AI's DOM, cleans it, and establishes a persistent full-duplex pipeline via `chrome.runtime.connectNative`. It handles recursive security bypass logic dynamically.
2. **OS Router (Windows/macOS):** Validates the extension ID whitelist and securely routes the payload to the local execution environment.
3. **Backend (Python Host):** Runs a robust `while True` event loop. Before `exec()` is called, it runs a static regex scanner against the payload to intercept dangerous file operations. It intercepts standard output/tracebacks and dynamically intercepts `input()` calls.
4. **Feedback Engine (The Bypass):** The extension receives the logs and uses advanced DOM manipulation (Native Setter Hijacking and Deep Paste Simulation) to bypass React/ProseMirror state isolation, injecting the contextual feedback directly into the AI's locked rich-text input box.

## 🚀 Installation & Usage

### Step 1: Install the Chrome Extension
1. Download or clone this repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `chrome_extension` folder from this project.
5. **Important:** Copy the generated **Extension ID** for the next step.

### Step 2: Run the Auto-Installer
1. Navigate to the `python_host` folder on your local machine.
2. Run `install.py` using your Python interpreter (double-click it or run via terminal).
3. Paste your **Extension ID** into the terminal when prompted. The script will automatically generate the required `manifest.json` and safely configure your OS routing.
4. **Fully restart your Chrome browser.**

### Step 3: Magic in Action
1. Ask ChatGPT, Claude, or DeepSeek to write a Python script.
2. You will see a green `🚀 Run in Local` button instantly appear on the AI's code block. Click it.
3. **Security Interception:** If the code tries to delete or modify files, a warning will ask for your permission before proceeding.
4. **Interactive Prompts:** If the code contains an `input()` statement, a blue **Input Box** will appear right under the code block.
5. **Process Control:** If a script hangs, click the red `⏹️ Stop` button to safely kill the process.
6. **The Feedback Loop:** Once finished or aborted, the detailed output/error log magically appears inside your chat input box. Press **Enter** to send it back to the AI!

## 🛡️ Security Disclaimer

This tool grants web browsers execution access to your local file system. The Native Messaging host will ONLY accept connections from the specific Chrome Extension ID you provide during the installation wizard. **Do not** manually modify the `allowed_origins` in the manifest to include unknown or untrusted extensions. Only run code generated by AI that you understand and trust.

## 📄 License

Distributed under the MIT License.