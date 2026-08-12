import os
import json
import platform
import shutil

def install():
    # OS DETECTION 
    system_os = platform.system()
    
    print("=====================================================")
    print(f"    AI Agent Installer (Detected OS: {system_os})")
    print("=====================================================\n")
    
    # UI instructions for the user to get their extension ID
    print("Before entering your ID, please complete these steps in Chrome:")
    print("  Step 1. Open your browser and navigate to: chrome://extensions/")
    print("  Step 2. Turn on 'Developer mode' (top right corner).")
    print("  Step 3. Click 'Load unpacked' and select the 'chrome_extension' folder.")
    print("  Step 4. Find 'Local AI Agent' in your extensions list and copy its 'ID'.\n")
    
    ext_id = input("Paste your Extension ID here and press Enter: ").strip()
    
    if not ext_id:
        print("Error: Extension ID cannot be empty! Please try again.")
        return

    # Get the absolute path of the current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    manifest_path = os.path.join(current_dir, "manifest.json")
    
    # Wrapper Selection & Permission Handling
    if system_os == "Windows":
        # Windows uses .bat files natively
        script_path = os.path.join(current_dir, "host_wrapper.bat")
    else: 
        # Mac/Linux uses .sh scripts
        script_path = os.path.join(current_dir, "host_wrapper.sh")
        os.chmod(script_path, 0o755)

    # MANIFEST GENERATION
    manifest_data = {
        "name": "com.local.ai_agent",
        "description": "Local Python Agent",
        "path": script_path,    # Points to the dynamically selected wrapper
        "type": "stdio",        # Defines communication protocol (Standard I/O)
        "allowed_origins": [
            f"chrome-extension://{ext_id}/" # Whitelists only your specific extension
        ]
    }

    try:
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=4)
        print(f"\n[Success] Manifest file generated at: {manifest_path}")
    except Exception as e:
        print(f"[Error] Failed to generate manifest file: {e}")
        return

    # Syste Routing Configuration
    if system_os == "Windows":
        try:
            import winreg 
            
            # Write the manifest path to the Windows Registry
            registry_path = r"Software\Google\Chrome\NativeMessagingHosts\com.local.ai_agent"
            key = winreg.CreateKey(winreg.HKEY_CURRENT_USER, registry_path)
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, manifest_path)
            winreg.CloseKey(key)
            print("[Success] Windows Registry routing configured successfully!")
        except Exception as e:
            print(f"[Error] Registry write failed: {e}")
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
            print(f"[Success] Mac routing configured successfully at: {destination}")
        except Exception as e:
            print(f"[Error] Mac routing configuration failed: {e}")
            return

    print("\n=====================================================")
    print("Installation complete! Please fully restart Chrome to use the extension.")
    print("=====================================================\n")
    
    # Keep terminal open on Windows so the user can read the output
    if system_os == "Windows":
        input("Press Enter to exit...")

if __name__ == "__main__":
    install()