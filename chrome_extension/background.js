/**
 * Background Service Worker
 * Listens for messages from the content script and acts as a proxy 
 * to communicate with the local Python host via Chrome Native Messaging.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Route specific actions to the native messaging host
    if (request.action === "execute_command" || request.action === "confirm_install_and_run") {
        // Send the payload to the registered native application (host.py)
        chrome.runtime.sendNativeMessage(
            'com.local.ai_agent',
            { 
                action: request.action,
                data: request.code,
                packages: request.packages || [] 
            },
            
            (response) => {
                // Handle connection errors or return the host's response back to the content script
                if (chrome.runtime.lastError) {
                    sendResponse({ status: "error", msg: chrome.runtime.lastError.message });
                } else {
                    sendResponse(response); 
                }
            }
        );

        // Return true to indicate that the response will be sent asynchronously
        return true;
    }
});