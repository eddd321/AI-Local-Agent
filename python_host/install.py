"""
This script registers the local Python host with the Chrome browser.
It automatically creates an isolated virtual environment (.venv) 
and links the universal wrapper scripts to Google Chrome.
"""

import os
import sys
import json
import platform
import shutil
import subprocess

def install():
    # OS DETECTION 
    system_os = platform.system()
    
    print("=====================================================")
    print(f"    AI Agent Installer (Detected OS: {system_os})")
    print("=====================================================\n")
    
    # Get the absolute path of the current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    venv_dir = os.path.join(current_dir, ".venv")
    
    # Automatic Virtual Environment Creation
    print("🔍 Checking Python environment...")
    if not os.path.exists(venv_dir):
        print("📦 First time setup: Creating an isolated virtual environment...")
        print("⏳ This might take a few seconds...")
        try:
            # Use the system's python to build the virtual environment folder
            subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)
            print("✅ Virtual environment created successfully!\n")
        except subprocess.CalledProcessError:
            print("❌ Error: Failed to create virtual environment.")
            print("Please open terminal and run 'python -m venv .venv' manually.")
            return
    else:
        print("✅ Isolated virtual environment already exists.\n")

    print("⚙️ Locating executable wrappers...")
    if system_os == "Windows":
        # Point to the static Windows batch file
        script_path = os.path.join(current_dir, "host_wrapper.bat")
    else: 
        # Point to the static Mac/Linux shell script
        script_path = os.path.join(current_dir, "host_wrapper.sh")
        # Ensure the shell script has execution permissions
        if os.path.exists(script_path):
            os.chmod(script_path, 0o755)
        
    print(f"✅ Using universal wrapper at: {script_path}\n")

    # Get Extension ID from user
    print("Before entering your ID, please complete these steps in Chrome:")
    print("  Step 1. Open your browser and navigate to: chrome://extensions/")
    print("  Step 2. Turn on 'Developer mode' (top right corner).")
    print("  Step 3. Click 'Load unpacked' and select the 'chrome_extension' folder.")
    print("  Step 4. Find 'Local AI Agent' in your extensions list and copy its 'ID'.\n")
    
    ext_id = input("Paste your Extension ID here and press Enter: ").strip()
    
    if not ext_id:
        print("❌ Error: Extension ID cannot be empty! Please run the script again.")
        return

    # Manifest Generation
    manifest_path = os.path.join(current_dir, "manifest.json")
    manifest_data = {
        "name": "com.local.ai_agent",
        "description": "Local Python Agent",
        "path": script_path,
        "type": "stdio",
        "allowed_origins": [
            f"chrome-extension://{ext_id}/"
        ]
    }

    try:
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=4)
        print(f"\n✅ Manifest file generated at: {manifest_path}")
    except Exception as e:
        print(f"❌ Error: Failed to generate manifest file: {e}")
        return

    # System Routing Configuration
    if system_os == "Windows":
        try:
            import winreg 
            
            # Write the manifest path to the Windows Registry
            registry_path = r"Software\Google\Chrome\NativeMessagingHosts\com.local.ai_agent"
            key = winreg.CreateKey(winreg.HKEY_CURRENT_USER, registry_path)
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, manifest_path)
            winreg.CloseKey(key)
            print("✅ Windows Registry routing configured successfully!")
        except Exception as e:
            print(f"❌ Error: Registry write failed: {e}")
            return
            
    elif system_os == "Darwin": # macOS
        try:
            mac_manifest_dir = os.path.expanduser("~/Library/Application Support/Google/Chrome/NativeMessagingHosts")
            
            # Ensure the deep directory structure exists
            os.makedirs(mac_manifest_dir, exist_ok=True)
            
            # Mac requires the JSON filename to match the 'name' field exactly
            destination = os.path.join(mac_manifest_dir, "com.local.ai_agent.json")
            
            # Copy generated manifest to the hidden system folder
            shutil.copy(manifest_path, destination)
            print(f"✅ Mac routing configured successfully at: {destination}")
        except Exception as e:
            print(f"❌ Error: Mac routing configuration failed: {e}")
            return
            
    elif system_os == "Linux":
        try:
            linux_manifest_dir = os.path.expanduser("~/.config/google-chrome/NativeMessagingHosts")
            os.makedirs(linux_manifest_dir, exist_ok=True)
            destination = os.path.join(linux_manifest_dir, "com.local.ai_agent.json")
            shutil.copy(manifest_path, destination)
            print(f"✅ Linux routing configured successfully at: {destination}")
        except Exception as e:
            print(f"❌ Error: Linux routing configuration failed: {e}")
            return

    print("\n=====================================================")
    print("🎉 Installation complete! Please fully restart Chrome.")
    print("=====================================================\n")
    
    # Keep terminal open on Windows so the user can read the output
    if system_os == "Windows":
        input("Press Enter to exit...")

if __name__ == "__main__":
    install()