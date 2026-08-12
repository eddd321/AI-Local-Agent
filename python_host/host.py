import sys
import json
import struct
import os
import platform

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

def main():
    while True:
        message = get_message()
        
        if message.get("action") == "create_folder":
            system_os = platform.system()
            
            # Resolve the correct absolute path to the user's Desktop
            if system_os == "Windows":
                user_profile = os.environ.get('USERPROFILE')
                # Check for OneDrive backup, which alters the standard Desktop path
                desktop_path = os.path.join(user_profile, 'OneDrive', 'Desktop')
                if not os.path.exists(desktop_path):
                    # Fallback to standard local Desktop
                    desktop_path = os.path.join(user_profile, 'Desktop')
                    
            elif system_os == "Darwin": # macOS
                # Mac path resolution
                user_home = os.path.expanduser("~")
                desktop_path = os.path.join(user_home, 'Desktop')
                
            else:
                # Failsafe for unsupported operating systems (e.g., Linux)
                send_message({"status": "error", "msg": f"Unsupported OS: {system_os}"})
                continue
                
            folder_name = message.get("folder_name", "AI_Magic_Folder")
            full_path = os.path.join(desktop_path, folder_name)
            
            try:
                # Execute the actual file system operation
                os.makedirs(full_path, exist_ok=True)
                send_message({"status": "success", "msg": f"Folder '{folder_name}' created on {system_os}!"})
            except Exception as e:
                # Catch permission errors or disk issues and send them back to the browser UI
                send_message({"status": "error", "msg": str(e)})

if __name__ == '__main__':
    main()