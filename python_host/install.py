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
import time  # Added for the delay after deleting the folder

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
    
    if os.path.exists(venv_dir):
        print("⚠️ Isolated virtual environment (.venv) already exists.")
        
        # Ask the user if they want to delete the old one and build a new one
        reset_choice = input("Do you want to RESET/REBUILD it? (Type 'y' to reset, 'n' to keep): ").strip().lower()
        
        if reset_choice == 'y':
            print("🧹 Deleting the old environment (this may take a few seconds)...")
            
            try:
                shutil.rmtree(venv_dir) # Delete the folder completely
                time.sleep(1) # Wait 1 second to let Windows release the files
            except PermissionError:
                print("\n🚨 [Error] Windows Access Denied (File in use)!")
                print(f"Reason: Your source code editor (like VS Code) or a background process is currently using {venv_dir}.")
                print("\n👉 How to fix this (Full Workflow):")
                print("   Step 1: If your terminal prompt starts with '(.venv)', type: deactivate and press Enter.")
                print("   Step 2: Click the 'Trash Can' icon in your editor to completely kill the current terminal.")
                print("   Step 3: Open a brand new terminal (or use an external regular CMD).")
                print("   Step 4: Run 'python install.py' again.")
                print("\n   *Note: If it still fails, open Task Manager and kill any remaining 'python.exe' processes.*")
                return
            
            print("📦 Building a fresh virtual environment...")
            try:
                subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)
                print("✅ Virtual environment reset successfully!\n")
            except subprocess.CalledProcessError:
                print("❌ Error: Failed to rebuild virtual environment.")
                return
        else:
            print("✅ Keeping the existing virtual environment.\n")
            
    else:
        # If it does not exist, create it for the first time
        print("📦 First time setup: Creating an isolated virtual environment...")
        print("⏳ This might take a few seconds...")
        try:
            subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)
            print("✅ Virtual environment created successfully!\n")
        except subprocess.CalledProcessError:
            print("❌ Error: Failed to create virtual environment.")
            return

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

    manifest_path = os.path.join(current_dir, "manifest.json")

    # Check if we already have a manifest file to avoid asking for ID again
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
                old_id = config.get("allowed_origins", [""])[0].replace("chrome-extension://", "").replace("/", "")
            
            print(f"🔍 Found existing configuration! Current Extension ID: {old_id}")
            skip_choice = input("Do you want to CHANGE the Extension ID? (Type 'y' to change, press Enter to KEEP it): ").strip().lower()
            
            if skip_choice != 'y':
                print("\n🚀 Skipping routing setup. Local AI Agent is ready!")
                if system_os == "Windows":
                    input("Press Enter to exit...")
                return
        except Exception:
            pass # If reading fails, just ask for the ID normally below

    # Get Extension ID from user
    print("\nBefore entering your ID, please complete these steps in Chrome:")
    print("  Step 1. Open your browser and navigate to: chrome://extensions/")
    print("  Step 2. Turn on 'Developer mode' (top right corner).")
    print("  Step 3. Click 'Load unpacked' and select the 'chrome_extension' folder.")
    print("  Step 4. Find 'Local AI Agent' in your extensions list and copy its 'ID'.\n")
    
    ext_id = input("Paste your Extension ID here and press Enter: ").strip()
    
    if not ext_id:
        print("❌ Error: Extension ID cannot be empty! Please run the script again.")
        return

    # Manifest Generation
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