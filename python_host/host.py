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
    raw_length = sys.__stdin__.buffer.read(4)
    if len(raw_length) == 0:
        # Exit if the extension closed the connection
        sys.exit(0)

    # Unpack the 4 bytes into an integer
    message_length = struct.unpack('@I', raw_length)[0]
    
    # Read the actual message based on the length and parse the JSON
    message = sys.__stdin__.buffer.read(message_length).decode('utf-8')
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
    sys.__stdout__.buffer.write(encoded_length)
    sys.__stdout__.buffer.write(encoded_content)

    # Flush the buffer to ensure the message is sent immediately
    sys.__stdout__.buffer.flush()

"""
Execute the provided Python code and capture its output.
Modified to return output and traceback separately for AI feedback.
"""
def execute_code(code_string):
    # Try to install any missing packages before running
    auto_install_missing_packages(code_string)

    # Create a string buffer to catch print statements
    output_buffer = io.StringIO()

    def custom_input(prompt_text=""):
        # Pause execution and ask the browser for input
        send_message({
            "status": "input_request",
            "prompt": prompt_text
        })
        # Wait here until the browser sends back the user's typed answer
        response = get_message()
        return response.get("data", "") if response else ""

    # Set up global variables for the script to use
    safe_globals = {
        "__builtins__": __builtins__,
        "DESKTOP": get_smart_desktop(),
        "__name__": "__main__",
        "input": custom_input
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
Static code analysis to detect sensitive file modification or deletion operations.
"""
def check_security(code_string):
    # Regex patterns for dangerous file operations
    patterns = [
        # Native Python file deletions & renaming
        (r'\bos\.remove\s*\(', "Delete file (os.remove)"),
        (r'\bos\.unlink\s*\(', "Delete file (os.unlink)"),
        (r'\bshutil\.rmtree\s*\(', "Delete folder tree (shutil.rmtree)"),
        (r'\bos\.rmdir\s*\(', "Delete folder (os.rmdir)"),
        (r'\bos\.rename\s*\(', "Rename file (os.rename)"),
        (r'\bos\.replace\s*\(', "Replace file (os.replace)"),
        
        # Native Python file writing
        (r'\bopen\s*\([\s\S]*?[\'"][wax][tb\+]*[\'"]', "Modify file (open in write/append mode)"),
        (r'\.write\s*\(', "Write to file (.write)"),
        (r'\.write_text\s*\(', "Write to file (Pathlib.write_text)"),
        (r'\.write_bytes\s*\(', "Write to file (Pathlib.write_bytes)"),
        (r'\.unlink\s*\(', "Delete file (Pathlib.unlink)"),

        # Third-Party Libraries (Excel, Pandas, Images, JSON) ====
        (r'\.save\s*\(', "Save/Overwrite file (e.g., Excel/Image .save)"),
        (r'\.to_[a-zA-Z0-9_]+\s*\(', "Export file (e.g., Pandas .to_csv/.to_excel)"),
        (r'\bdump[s]?\s*\(', "Dump data to file (e.g., json.dump, pickle.dump)"),
        (r'\bimwrite\s*\(', "Write image file (e.g., cv2.imwrite)"),
    ]
    
    reasons = []
    for pattern, desc in patterns:
        if re.search(pattern, code_string):
            if desc not in reasons:
                reasons.append(desc)

    # Return True if it is safe (0 reasons foun                
    return len(reasons) == 0, reasons

"""
Main loop to keep the script running and listening for commands.
"""
def main():
    # Keep the program running forever to listen for new messages
    while True:
        message = get_message()
        if not message: 
            break # Stop if the browser disconnects
        
        # If we get an answer for an input request, skip it here (custom_input handles it)
        if message.get("action") == "input_response":
            continue 

        action = message.get("action")
        code = message.get("code")

        # Run the code
        if action == "execute_command":
            if not code:
                send_message({"status": "error", 
                              "msg": "Fatal Error: No code received."})
                continue

            bypass_security = message.get("bypass_security", False)
            if not bypass_security:
                is_safe, reasons = check_security(code)
                if not is_safe:
                    # If unsafe, send a warning back to the browser and pause execution
                    send_message({
                        "status": "security_warning",
                        "reasons": reasons,
                        "msg": "Execution intercepted by Security Sandbox."
                    })
                    continue

            # Check if any packages need to be installed first
            missing_libs = check_missing_packages(code)
            if missing_libs:
                # Tell the browser we need to install packages
                send_message({
                    "status": "need_install", 
                    "packages": missing_libs,
                    "msg": f"Detected missing packages: {', '.join(missing_libs)}"
                })
            else:
                # Run the code and send the result back
                response_dict = execute_code(code)
                send_message(response_dict)

        # Action: Install missing packages, then run the code        
        elif action == "confirm_install_and_run":
            missing_libs = message.get("packages", [])
            for lib in missing_libs:
                try:
                    # Silently install the package using pip
                    subprocess.check_call(
                        [sys.executable, "-m", "pip", "install", lib],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL
                    )
                except Exception:
                    pass # Ignore errors if install fails

            # Run the code after installing and send the result back
            response_dict = execute_code(code)
            send_message(response_dict)

        # Unknown action fallback            
        else:
            send_message({"status": "error", "msg": f"Unknown action: {action}"})

if __name__ == '__main__':
    main()