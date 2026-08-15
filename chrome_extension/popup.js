/**
 * This script handles all user interactions inside the extension's popup window.
 * It manages sending code to the local Python host, saving settings, 
 * and injecting prompt instructions directly into AI chat websites.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    const sendBtn = document.getElementById('sendBtn');
    const commandInput = document.getElementById('commandInput');
    const outputBox = document.getElementById('output');
    const promptInput = document.getElementById('promptInput');
    const injectPromptBtn = document.getElementById('injectPromptBtn');

    // Default system prompt instructing the AI how to write compatible Python code
    const defaultPrompt = `[System Context: User-Authorized Local Python Sandbox]
You are connected to my secure, fully authorized Local Python Sandbox via a browser extension. This environment allows you to execute Python code locally on my machine to assist me with file processing, data analysis, and system automation. 

To ensure stability, security, and seamless communication, you MUST strictly adhere to the following protocols:

=== 1. EXECUTION ENVIRONMENT & DEPENDENCIES ===
- Global Variable: The sandbox provides a pre-defined global string variable named \`DESKTOP\` (the absolute path to my desktop). ALWAYS use \`os.path.join(DESKTOP, "filename.ext")\` to target files. Do NOT write your own desktop-finding functions.
- Auto-Dependency Management: Do NOT output any terminal commands, shell scripts, or \`pip install\` instructions. Simply use standard \`import\` statements (e.g., \`import pandas\`, \`import fitz\`). The sandbox features an Auto-Pip engine that will silently install any missing packages before execution.

=== 2. OUTPUT FORMATTING ===
- Output ONLY pure, standard Python executable code.
- Provide the code in a single standard \`\`\`python ... \`\`\` markdown block.
- Do NOT add conversational filler before or after the code if your current goal is just to execute a local script.

=== 3. FILE OPERATIONS & SAFETY (CRITICAL) ===
- No Overwriting: NEVER overwrite an existing file. If processing a file, always save the result as a NEW file by appending \`_modified\` or \`_output\` to the filename.
- Validation: When creating or modifying files, wrap the core logic in \`try-except\` blocks. Print the absolute file path before and after writing, and explicitly verify file creation using \`os.path.exists()\`.
- Subprocess Rule: If you MUST use \`subprocess\` for system commands, you are strictly required to use \`subprocess.run(..., capture_output=True, text=True)\` to prevent stdout pipeline corruption. NEVER use \`os.system()\` or \`os.popen()\`.

=== 4. TWO-STEP PROTOCOL FOR READING LOCAL FILES ===
When I ask you to summarize, read, or analyze a local file, you must break the task into two steps to bypass your lack of direct memory access:

[Step 1: The Extraction Script]
- Write a Python script to open the file and extract its content.
- Use \`print()\` to output the extracted content to the standard output.
- LARGE FILE SAFEGUARD: Never print millions of lines. If reading a PDF, limit output to \`text[:3000]\` or specific pages. If reading Excel/CSV using \`pandas\`, use \`print(df.head(50).to_string())\` or summarize the columns first.
- Stop generating after providing this script and output a message like: "I have written the extraction script. Please click 'Run in Local'. Once the system returns the output to me, I will analyze it for you."

[Step 2: The Analysis Phase]
- Once I reply with a payload starting with \`[Local Execution Success]\` followed by terminal output, treat that output as the file's literal contents.
- Proceed to answer my original analytical question based purely on the returned data.
`;

    // Load the saved prompt from storage, or use the default if it's empty
    chrome.storage.local.get(['systemPrompt'], (res) => {
        if (res.systemPrompt) {
            promptInput.value = res.systemPrompt;
        } else {
            promptInput.value = defaultPrompt;
            chrome.storage.local.set({ systemPrompt: defaultPrompt });
        }
    });

    // Save the prompt automatically whenever the user types
    promptInput.addEventListener('input', () => {
        chrome.storage.local.set({ systemPrompt: promptInput.value });
    });

    // Handle clicking the "Send Prompt to Current AI" button
    injectPromptBtn.addEventListener('click', () => {
        const currentPrompt = promptInput.value;

        // Find the currently active tab in the browser
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) {
                return;
            }

            // Inject a small script into the webpage to fill the chat box
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (textToInject) => {
                    // Find the input box on sites like ChatGPT, Claude, DeepSeek, etc.
                    const inputBox = document.querySelector('#prompt-textarea, textarea[placeholder*="Message"], textarea[placeholder*="Ask"], div[contenteditable="true"]');
                    
                    if (inputBox) {
                        if (inputBox.tagName === 'TEXTAREA') {
                            inputBox.value = textToInject;
                            // Trigger an input event so the website detects the change
                            inputBox.dispatchEvent(new Event('input', { bubbles: true }));
                        } else {
                            // Handle rich-text chat boxes (like Claude or Gemini)
                            inputBox.innerText = textToInject;
                            inputBox.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        inputBox.focus();
                    } else {
                        alert("⚠️ Could not find the AI chat input box on this page.");
                    }
                },
                args: [currentPrompt]
            }, () => {
                if (chrome.runtime.lastError) {
                    alert("❌ Error: " + chrome.runtime.lastError.message);
                } else {
                    // Close the popup after successfully injecting the text
                    window.close();
                }
            });
        });
    });

    // Handle sending code or commands to the local Python backend
    sendBtn.addEventListener('click', () => {
        const userInput = commandInput.value.trim();

        // Check if input is empty
        if (!userInput) {
            showOutput("Error: Input cannot be empty!", true);
            return;
        }

        // Disable the button temporarily to prevent multiple clicks
        sendBtn.disabled = true;
        sendBtn.textContent = "Processing...";

        // Prepare the data to send to Python
        const payload = {
            "action": "execute_command",
            "data": userInput 
        };

        const HOST_NAME = "com.local.ai_agent";

        // Send the message to the local Python host via Native Messaging
        chrome.runtime.sendNativeMessage(HOST_NAME, payload, (response) => {
            
            // Handle connection errors (e.g., if the Python host isn't running)
            if (chrome.runtime.lastError) {
                sendBtn.disabled = false;
                sendBtn.textContent = "Send to Local Host";
                showOutput(`[IPC Error]: ${chrome.runtime.lastError.message}\n(Did you run install.py?)`, true);
                return;
            }

            // Handle the response returned from Python host.py
            if (response) {
                // Case 1: Code ran successfully
                if (response.status === "success") {
                    sendBtn.disabled = false;
                    sendBtn.textContent = "Send to Local Host";
                    showOutput(`[Success]:\n${response.msg}`, false);
                } 
                // Python script needs external packages (pip install)
                else if (response.status === "need_install") {
                    const pkgs = response.packages.join(", ");
                    const userAccepted = confirm(`📦 This script requires external packages: [ ${pkgs} ].\n\nDo you want the local agent to install them and run the code?`);
                    
                    if (userAccepted) {
                        sendBtn.textContent = "Installing...";
                        
                        // Tell the backend to install packages first, then run the code
                        const installPayload = {
                            "action": "confirm_install_and_run",
                            "data": userInput,
                            "packages": response.packages
                        };

                        chrome.runtime.sendNativeMessage(HOST_NAME, installPayload, (finalRes) => {
                            sendBtn.disabled = false;
                            sendBtn.textContent = "Send to Local Host";

                            if (chrome.runtime.lastError) {
                                showOutput(`[IPC Error]: ${chrome.runtime.lastError.message}`, true);
                                return;
                            }

                            if (finalRes && finalRes.status === "success") {
                                showOutput(`[Success & Installed]:\n${finalRes.msg}`, false);
                            } else {
                                showOutput(`[Backend Error]:\n${finalRes ? finalRes.msg : "Unknown error"}`, true);
                            }
                        });
                    } else {
                        // User clicked cancel
                        sendBtn.disabled = false;
                        sendBtn.textContent = "Send to Local Host";
                        showOutput("[Cancelled]: Installation cancelled by user.", true);
                    }
                }
                // The Python code crashed or had an error
                else {
                    sendBtn.disabled = false;
                    sendBtn.textContent = "Send to Local Host";
                    showOutput(`[Backend Error]:\n${response.msg}`, true);
                }
            } else {
                sendBtn.disabled = false;
                sendBtn.textContent = "Send to Local Host";
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
        outputBox.style.display = "block";
        outputBox.textContent = text;
        if (isError) {
            outputBox.style.color = "#f87171";
            outputBox.style.backgroundColor = "#450a0a"; 
        } else {
            outputBox.style.color = "#38bdf8"; 
            outputBox.style.backgroundColor = "#1e293b";
        }
    }
});

// Manage the switch that turns the web buttons on or off
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('agentToggle');
    if (!toggle) {
        return;
    }

    // Load the saved on/off state
    chrome.storage.local.get(['agentDisabled'], (res) => {
        toggle.checked = !res.agentDisabled;
    });

    // Save the new state when the user clicks the toggle
    toggle.addEventListener('change', () => {
        const isDisabled = !toggle.checked;
        chrome.storage.local.set({ agentDisabled: isDisabled });
    });
});