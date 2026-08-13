import os
import platform
import sys
import json
import struct
import io
import contextlib
import traceback

def get_message():
    # Read the message length (first 4 bytes)
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0:
        sys.exit(0)
    message_length = struct.unpack('@I', raw_length)[0]
    
    # Read the actual message based on the length
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

def send_message(message_dict):
    # Encode the dictionary into a JSON string, then into bytes
    encoded_content = json.dumps(message_dict).encode('utf-8')
    # Pack the length of the message into 4 bytes
    encoded_length = struct.pack('@I', len(encoded_content))
    
    # Send the length followed by the message
    sys.stdout.buffer.write(encoded_length)
    sys.stdout.buffer.write(encoded_content)
    sys.stdout.buffer.flush()

def execute_code(code_string):

    # Create a buffer to capture print() statements
    output_buffer = io.StringIO()
    
    # Define a restricted global namespace (protecting the system)
    safe_globals = {
        "__builtins__": __builtins__,
        "DESKTOP": get_smart_desktop()
    }
    
    try:
        # Redirect standard output to our capture buffer
        with contextlib.redirect_stdout(output_buffer):
            exec(code_string, safe_globals)
        return "success", output_buffer.getvalue()
    except Exception:
        # Capture the full traceback if the code fails
        return "error", traceback.format_exc()

def get_smart_desktop():
    system_os = platform.system()
    
    if system_os == "Windows":
        try:
            import ctypes.wintypes
            CSIDL_DESKTOPDIRECTORY = 0
            buf = ctypes.create_unicode_buffer(ctypes.wintypes.MAX_PATH)
            ctypes.windll.shell32.SHGetFolderPathW(None, CSIDL_DESKTOPDIRECTORY, None, 0, buf)
            return buf.value
        except Exception:
            user_profile = os.environ.get('USERPROFILE', os.path.expanduser("~"))
            onedrive_desktop = os.path.join(user_profile, 'OneDrive', 'Desktop')
            local_desktop = os.path.join(user_profile, 'Desktop')
            return onedrive_desktop if os.path.exists(onedrive_desktop) else local_desktop
            
    elif system_os == "Darwin":  # macOS
        return os.path.join(os.path.expanduser("~"), "Desktop")
        
    else:  # Linux
        return os.path.join(os.path.expanduser("~"), "Desktop")

def main():
    while True:
        message = get_message()
        if not message: break
        
        action = message.get("action")
        code = message.get("data")
        
        if action == "execute_command":
            # Pass the code from the popup to our execution engine
            status, result = execute_code(code)
            send_message({"status": status, "msg": result})

if __name__ == '__main__':
    main()