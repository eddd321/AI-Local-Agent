document.getElementById('btn').addEventListener('click', () => {
    document.getElementById('result').innerText = "Sending command...";
    
    // Send a message to the native host using the generic identifier
    chrome.runtime.sendNativeMessage(
        'com.local.ai_agent', 
        { action: "create_folder", folder_name: "AI_Magic_Folder" },
        function(response) {
            if (chrome.runtime.lastError) {
                document.getElementById('result').innerText = "Error: " + chrome.runtime.lastError.message;
            } else {
                document.getElementById('result').innerText = response.msg;
            }
        }
    );
});