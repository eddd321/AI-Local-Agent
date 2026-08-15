/**
 * Local AI Agent - Background Service Worker
 * Keeps a continuous connection open for interactive inputs.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "force_stop") {
        if (activeNativePort) {
            // Disconnect active port. Chrome will immediately kill the underlying Python process.
            activeNativePort.disconnect(); 
            activeNativePort = null;
            console.log("🛑 Native host process forcefully terminated by user.");
        }
        return false;
    }

    // Route specific actions to the native messaging host
    if (request.action === "execute_command" || request.action === "confirm_install_and_run") {
        
        const HOST_NAME = "com.local.ai_agent";
        const activeNativePort = chrome.runtime.connectNative(HOST_NAME);
        
        // Lock to make sure we only reply once
        let hasResponded = false; 

        activeNativePort.onMessage.addListener((response) => {
            // If Python asks for user input in the middle of running
            if (response.status === "input_request") {
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: "input_request",
                    prompt: response.prompt
                }, (userInput) => {
                    // Send what the user typed back to Python
                    activeNativePort.postMessage({ action: "input_response", data: userInput });
                });
            } 
            // If Python is done and sends the final result
            else {
                hasResponded = true;
                sendResponse(response);
                activeNativePort.disconnect(); 
            }
        });

        activeNativePort.onDisconnect.addListener(() => {
            if (chrome.runtime.lastError) {
                console.error("Native Host Disconnected:", chrome.runtime.lastError.message);
                
                // If Python crashes suddenly, tell the webpage so it doesn't wait forever
                if (!hasResponded) {
                    hasResponded = true;
                    sendResponse({
                        status: "error",
                        msg: "Fatal Error: The local Python host crashed unexpectedly. \nPossible reasons:\n1. A typo in the code sending data.\n2. A sudden crash in Python."
                    });
                }
            }
        });

        // Start sending the code to Python
        activeNativePort.postMessage(request);
        
        // Keep the connection open to wait for the answer
        return true; 
    }
});