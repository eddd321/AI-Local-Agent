# 🤖 Local AI Agent (Chrome to OS Bridge)

![Python](https://img.shields.io/badge/Python-3.8%2B-blue)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)
![OS](https://img.shields.io/badge/OS-Windows-lightgrey)
![License](https://img.shields.io/badge/License-MIT-orange)

A powerful, secure, and automated bridge that allows web-based AI models (like ChatGPT, Claude, Kimi) to interact directly with your local operating system. By utilizing Chrome's **Native Messaging API**, this project enables AI to execute local Python scripts, manage files, and perform OS-level tasks safely from the browser, effectively turning any web AI into a local execution agent.

## ✨ Features

- **Zero-Configuration Setup:** Comes with an intelligent `install.py` wizard that automatically detects your system paths and configures the Windows Registry. No manual template editing required.
- **True Local Execution:** Bypasses browser sandboxes to run native OS commands directly via a Python daemon. Does not require setting up a local web server (No Flask/FastAPI required).
- **Data Sanitization & Privacy:** 100% privacy-focused. No personal absolute paths or usernames are hardcoded in the repository. The environment resolves dynamically on the host machine.
- **Event-Driven Architecture:** Minimal resource footprint. The Python script acts as a daemon, sleeping until an event is triggered from the Chrome extension interface.

## 🏗️ Architecture

This project implements an Inter-Process Communication (IPC) architecture across the browser sandbox:

1. **Frontend (Chrome Extension):** Captures user intent and sends a JSON payload via `chrome.runtime.sendNativeMessage`.
2. **OS Router (Windows Registry):** Validates the extension ID whitelist and routes the payload to the local execution environment.
3. **Backend (Python Host):** Reads the binary payload from standard input (`sys.stdin`), executes the requested system operations (e.g., `os.makedirs`), and returns the execution status via standard output (`sys.stdout`).

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
3. Paste your **Extension ID** into the terminal when prompted. The script will automatically generate the required `manifest.json` and safely configure your Windows Registry.
4. **Fully restart your Chrome browser.**

### Step 3: Test the Connection
1. Click the extension icon in your Chrome toolbar.
2. Click the **Create Folder!** button.
3. A new folder named `AI_Magic_Folder` will be created seamlessly on your desktop (it will automatically fallback from OneDrive Desktop to standard Desktop if necessary).

## 🛡️ Security Disclaimer

This tool grants web browsers access to your local file system. The Native Messaging host will ONLY accept connections from the specific Chrome Extension ID you provide during the installation wizard. **Do not** manually modify the `allowed_origins` in the manifest to include unknown or untrusted extensions.

## 📄 License

Distributed under the MIT License.