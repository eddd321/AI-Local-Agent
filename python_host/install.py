import os
import json
import winreg

def install():
    print("=====================================================")
    print("       AI Agent Local Environment Installer          ")
    print("=====================================================\n")
    
    print("Before entering your ID, please complete these steps in Chrome:")
    print("  Step 1. Open your browser and navigate to: chrome://extensions/")
    print("  Step 2. Turn on 'Developer mode' (top right corner).")
    print("  Step 3. Click 'Load unpacked' and select the 'chrome_extension' folder.")
    print("  Step 4. Find 'Local AI Agent' in your extensions list and copy its 'ID'.\n")
    
    ext_id = input("Paste your Extension ID here and press Enter: ").strip()
    
    if not ext_id:
        print("Error: Extension ID cannot be empty! Please try again.")
        return

    # Get the absolute path of the current directory to generate configs
    current_dir = os.path.dirname(os.path.abspath(__file__))
    bat_path = os.path.join(current_dir, "host_wrapper.bat")
    manifest_path = os.path.join(current_dir, "manifest.json")

    manifest_data = {
        "name": "com.local.ai_agent",
        "description": "Local Python Agent",
        "path": bat_path,
        "type": "stdio",
        "allowed_origins": [
            f"chrome-extension://{ext_id}/"
        ]
    }

    try:
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=4)
        print(f"\n[Success] Manifest file generated at: {manifest_path}")
    except Exception as e:
        print(f"[Error] Failed to generate manifest file: {e}")
        return

    # Automatically write to Windows Registry
    registry_path = r"Software\Google\Chrome\NativeMessagingHosts\com.local.ai_agent"
    try:
        key = winreg.CreateKey(winreg.HKEY_CURRENT_USER, registry_path)
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, manifest_path)
        winreg.CloseKey(key)
        print("[Success] Registry routing configured successfully!")
    except Exception as e:
        print(f"[Error] Registry write failed (try running as Administrator): {e}")
        return

    print("\n=====================================================")
    print("Installation complete! Please fully restart Chrome to use the extension.")
    print("=====================================================\n")
    input("Press Enter to exit...")

if __name__ == "__main__":
    install()