"""
This script runs in the background and acts as the bridge between 
the Chrome Extension and the local computer. It handles receiving code, 
installing missing packages, and executing the code safely.
"""

import os
import platform
import sys
import json
import struct
import io
import re
import subprocess

"""
Read a message sent from the Chrome Extension via standard input.
"""
def get_message():
    # Read the message length (first 4 bytes)
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0:
        # Exit if the extension closed the connection
        sys.exit(0)

    # Unpack the 4 bytes into an integer
    message_length = struct.unpack('@I', raw_length)[0]
    
    # Read the actual message based on the length and parse the JSON
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

"""
Send a message back to the Chrome Extension via standard output.
"""
def send_message(message_dict):
    # Convert the dictionary to a JSON string, then to bytes
    encoded_content = json.dumps(message_dict).encode('utf-8')

    # Pack the length of the message into 4 bytes
    encoded_length = struct.pack('@I', len(encoded_content))
    
    # Send the length followed by the actual message
    sys.stdout.buffer.write(encoded_length)
    sys.stdout.buffer.write(encoded_content)

    # Flush the buffer to ensure the message is sent immediately
    sys.stdout.buffer.flush()

"""
Execute the provided Python code and capture its output.
Modified to return output and traceback separately for AI feedback.
"""
def execute_code(code_string):
    # Try to install any missing packages before running
    auto_install_missing_packages(code_string)

    # Create a string buffer to catch print statements
    output_buffer = io.StringIO()

    # Set up global variables for the script to use
    safe_globals = {
        "__builtins__": __builtins__,
        "DESKTOP": get_smart_desktop(),
        "__name__": "__main__"
    }

    # Temporarily redirect standard output
    old_stdout = sys.stdout
    sys.stdout = output_buffer
    
    try:
        # Run the code
        exec(code_string, safe_globals, safe_globals)
        output = output_buffer.getvalue()
        return {
            "status": "success", 
            "output": output,
            "msg": output if output else "Executed successfully with no output."
        }
    except Exception as e:
        # Get the full error traceback if the code crashes
        import traceback
        partial_output = output_buffer.getvalue()
        error_trace = traceback.format_exc()
        return {
            "status": "error", 
            "output": partial_output,
            "msg": error_trace
        }
    finally:
        # Always restore the original standard output
        sys.stdout = old_stdout

"""
Find the correct path to the user's Desktop folder across different operating systems.
"""
def get_smart_desktop():
    # OS runtime detection
    system_os = platform.system()
    
    if system_os == "Windows":
        try:
            # Use Windows API to find the actual desktop folder (handles moved folders)
            import ctypes.wintypes
            CSIDL_DESKTOPDIRECTORY = 0
            buf = ctypes.create_unicode_buffer(ctypes.wintypes.MAX_PATH)
            ctypes.windll.shell32.SHGetFolderPathW(None, CSIDL_DESKTOPDIRECTORY, None, 0, buf)
            return buf.value
        except Exception:
            # Check for OneDrive Desktop or normal Desktop
            user_profile = os.environ.get('USERPROFILE', os.path.expanduser("~"))
            onedrive_desktop = os.path.join(user_profile, 'OneDrive', 'Desktop')
            local_desktop = os.path.join(user_profile, 'Desktop')
            return onedrive_desktop if os.path.exists(onedrive_desktop) else local_desktop
            
    elif system_os == "Darwin":  # macOS
        return os.path.join(os.path.expanduser("~"), "Desktop")
        
    else:  # Linux
        return os.path.join(os.path.expanduser("~"), "Desktop")

"""
Find import statements in the code and automatically install missing packages.
"""
def auto_install_missing_packages(code_string):
    # Regular expression to extract package names from import statements
    imports = re.findall(r'^\s*(?:import|from)\s+([a-zA-Z0-9_]+)', code_string, re.MULTILINE)
    
    # Common Python standard libraries to skip
    std_libs = {
        'os', 'sys', 'math', 'random', 'datetime', 'json', 're', 'time', 
        'collections', 'itertools', 'functools', 'pathlib', 'io', 'subprocess',
        'urllib', 'http', 'socket', 'sqlite3', 'hashlib', 'base64', 'logging'
    }
    
    for lib in imports:
        if lib in std_libs:
            continue
        
        try:
            # Check if the module is already installed
            __import__(lib)
        except ImportError:
            try:
                # Run pip install silently in the background
                subprocess.check_call(
                    [sys.executable, "-m", "pip", "install", lib],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            except Exception:
                pass

"""
Check for missing packages without installing them, useful for prompting the user.
"""
def check_missing_packages(code_string):
    # Regular expression to extract package names
    imports = re.findall(r'^\s*(?:import|from)\s+([a-zA-Z0-9_]+)', code_string, re.MULTILINE)

    # Common Python standard libraries to skip
    std_libs = {
        'os', 'sys', 'math', 'random', 'datetime', 'json', 're', 'time', 
        'collections', 'itertools', 'functools', 'pathlib', 'io', 'subprocess',
        'urllib', 'http', 'socket', 'sqlite3', 'hashlib', 'base64', 'logging'
    }

    # Map import names to actual PyPI package names
    package_mapping = {
        'PIL': 'pillow',
        'cv2': 'opencv-python',
        'sklearn': 'scikit-learn',
        'bs4': 'beautifulsoup4'
    }
    
    missing = []
    for lib in imports:
        if lib in std_libs:
            continue
        
        target_pkg = package_mapping.get(lib, lib)
        
        try:
            # Check if the module is installed using the original code name
            __import__(lib)
        except ImportError:
            if target_pkg not in missing:
                missing.append(target_pkg)
    return missing

"""
Main loop to keep the script running and listening for commands.
"""
def main():
    while True:
        message = get_message()
        if not message: 
            break
        
        action = message.get("action")
        code = message.get("data")
        
        if action == "execute_command":
            # Check for missing packages first
            missing_libs = check_missing_packages(code)
            # Ask the extension to prompt the user for installation
            if missing_libs:
                send_message({
                    "status": "need_install", 
                    "packages": missing_libs,
                    "msg": f"Detected missing packages: {', '.join(missing_libs)}"
                })
            # Run the code if everything is ready
            else:
                response_dict = execute_code(code)
                send_message(response_dict)
                
        elif action == "confirm_install_and_run":
            # Install packages after user confirmation, then run
            missing_libs = message.get("packages", [])
            for lib in missing_libs:
                try:
                    subprocess.check_call(
                        [sys.executable, "-m", "pip", "install", lib],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL
                    )
                except Exception:
                    pass

            response_dict = execute_code(code)
            send_message(response_dict)
            
        else:
            send_message({"status": "error", "msg": f"Unknown action: {action}"})

if __name__ == '__main__':
    main()