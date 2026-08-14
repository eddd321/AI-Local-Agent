# 🤖 Local AI Agent v1.1.0 (Chrome to OS Bridge)

![Python](https://img.shields.io/badge/Python-3.8%2B-blue)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)
![Windows](https://img.shields.io/badge/OS-Windows-0078D6?logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/OS-macOS-000000?logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/OS-Linux-FCC624?logo=linux&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-orange)

A powerful, secure, and automated bridge that allows web-based AI models (like **ChatGPT, Claude, DeepSeek, and Gemini**) to interact directly with your local operating system. By utilizing Chrome's **Native Messaging API**, this project injects a one-click execution environment directly into your browser. 

As of **v1.1.0**, it not only executes local Python scripts safely but also **automatically feeds the execution results and error tracebacks back to the AI for self-correction**—effectively turning any web AI into a fully autonomous local execution agent.

## ✨ Features

- **🔄 Automated AI Feedback Loop (v1.1.0):** Automatically captures standard output (`print`) and Python error tracebacks. It then seamlessly pastes the terminal results directly back into the AI's chatbox, allowing the AI to instantly see the results and debug its own code!
- **🚀 One-Click UI Injection:** Automatically injects a native `🚀 Run in Local` button directly onto code blocks in ChatGPT, Claude, and DeepSeek interfaces. No copy-pasting required.
- **📦 Smart Dependency Management:** Before executing code, the backend automatically scans Python `import` statements, detects missing libraries (e.g., mapping `PIL` to `pillow`), and prompts you via the browser to install them via `pip` with a single click.
- **🧹 Bulletproof Code Extraction:** Advanced DOM parsing that accurately extracts pure Python code. It intelligently strips out AI UI artifacts ("Copy", "Download" buttons) and sanitizes invisible characters that would otherwise crash the Python interpreter.
- **🧠 Intelligent Execution Sandbox:** Dynamically resolves your local `DESKTOP` path (perfectly handling Windows OneDrive, standard Windows, and macOS paths). It also spoofs the `__name__ == "__main__"` context, ensuring complex, multi-function scripts run flawlessly without modification.
- **⚡ True Local Execution (No Servers):** Bypasses browser sandboxes to run native OS commands directly via a Python daemon. Does not require setting up a local web server.

## 🏗️ Architecture

This project implements a seamless Inter-Process Communication (IPC) architecture with an advanced feedback engine:

1. **Frontend (Chrome Extension):** Uses a Singleton Lock to prevent duplicate UI injections. It captures code from the AI's DOM, cleans it, and sends a JSON payload via `chrome.runtime.sendNativeMessage`.
2. **OS Router (Windows Registry/macOS Native Messaging):** Validates the extension ID whitelist and securely routes the payload to the local execution environment.
3. **Backend (Python Host):** Reads the binary payload from standard input (`sys.stdin`), executes the code using `exec()`, intercepts standard output/tracebacks via `io.StringIO`, and returns execution logs to the extension.
4. **Feedback Engine (The Bypass):** The extension receives the logs and uses advanced DOM manipulation (Native Setter Hijacking and Deep Paste Simulation) to bypass React/ProseMirror state isolation, injecting the terminal output directly into the AI's locked rich-text input box.

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
1. Ask ChatGPT, Claude, or DeepSeek to write a Python script (e.g., *"Write a script to generate a QR code and save it to my desktop"*).
2. You will see a green `🚀 Run in Local` button instantly appear on the AI's code block.
3. Click it. The code will execute on your machine, auto-install required packages, and perform the task.
4. **The Feedback Loop:** Once the code finishes running (or if it crashes), the output/error log will magically appear inside your chat input box. Just press **Enter** to send it back to the AI for the next step or automatic debugging!

## 🛡️ Security Disclaimer

This tool grants web browsers execution access to your local file system. The Native Messaging host will ONLY accept connections from the specific Chrome Extension ID you provide during the installation wizard. **Do not** manually modify the `allowed_origins` in the manifest to include unknown or untrusted extensions. Only run code generated by AI that you understand and trust.

## 📄 License

Distributed under the MIT License.