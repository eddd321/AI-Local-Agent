// -------------------------------------------------------------------------
// POPUP CONTROLLER: Handles UI events and Native Messaging IPC bridge
// -------------------------------------------------------------------------

// Wait for the DOM content to fully load before attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
    
    const sendBtn = document.getElementById('sendBtn');
    const commandInput = document.getElementById('commandInput');
    const outputBox = document.getElementById('output');

    // Listen for click events on the main action button
    sendBtn.addEventListener('click', () => {
        const userInput = commandInput.value.trim();

        // 1. Validate user input: Do not send empty payloads
        if (!userInput) {
            showOutput("Error: Input cannot be empty!", true);
            return;
        }

        // Disable button temporarily to prevent double-clicks during execution
        sendBtn.disabled = true;
        sendBtn.textContent = "Processing...";

        // 2. Construct the JSON payload packet
        // We package the user's raw text into a structured action protocol
        const payload = {
            "action": "execute_command", // Action specifier for the Python backend
            "data": userInput            // The actual instruction/code payload
        };

        // 3. Define the target Native Messaging Host ID
        // This must strictly match the name defined in your manifest.json & registry/mac folder
        const HOST_NAME = "com.local.ai_agent";

        // 4. Fire the Chrome Native Messaging API
        // This sends the JSON payload through the secure browser-to-OS pipe to 'host.py'
        chrome.runtime.sendNativeMessage(HOST_NAME, payload, (response) => {
            
            // Re-enable the button once a response is received
            sendBtn.disabled = false;
            sendBtn.textContent = "Send to Local Host";

            // 5. Handle potential connection errors (e.g., host not installed or path broken)
            if (chrome.runtime.lastError) {
                showOutput(`[IPC Error]: ${chrome.runtime.lastError.message}\n(Did you run install.py?)`, true);
                return;
            }

            // 6. Handle the response returned from Python host.py
            if (response) {
                if (response.status === "success") {
                    showOutput(`[Success]:\n${response.msg}`, false);
                } else {
                    showOutput(`[Backend Error]:\n${response.msg}`, true);
                }
            } else {
                showOutput("[Error]: Received empty response from host.", true);
            }
        });
    });

    /**
     * Helper function to render feedback dynamically in the terminal output box
     * @param {string} text - The log message or error stack
     * @param {boolean} isError - Style flag for errors (red vs cyan)
     */
    function showOutput(text, isError = false) {
        outputBox.style.display = "block"; // Reveal the terminal box
        outputBox.textContent = text;
        if (isError) {
            outputBox.style.color = "#f87171"; // Soft red for errors
            outputBox.style.backgroundColor = "#450a0a"; // Dark red background
        } else {
            outputBox.style.color = "#38bdf8"; // Bright cyan for success
            outputBox.style.backgroundColor = "#1e293b"; // Dark slate background
        }
    }
});