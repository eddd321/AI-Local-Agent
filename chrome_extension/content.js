/**
 * Local AI Agent - Content Script
 * Injected into AI chat webpages (ChatGPT, Claude, DeepSeek, etc.)
 * Responsible for finding code blocks, injecting the execution button, 
 * extracting/cleaning code, and communicating with the background script.
 */

// Prevent multiple script injections on the same page
if (document.getElementById('local-agent-lock')) {
    console.warn("⚠️ Intercepted duplicate Agent script execution, automatically terminated!");
} else {
    // Insert invisible lock to claim ownership of this webpage
    const lock = document.createElement('div');
    lock.id = 'local-agent-lock';
    lock.style.display = 'none';
    document.body.appendChild(lock);

    let injectionInterval;
    window.__activeAgentBlock = null;

    /**
     * Put the execution results back into the AI's chat box.
     * Uses safe methods to ensure the website registers the text correctly.
     */
    function feedBackToAI(feedbackText) {
        // Find the input element on the page (supports ChatGPT, Claude, DeepSeek, Grok, etc.)
        const inputBox = document.querySelector('#prompt-textarea, textarea[placeholder*="Message"], textarea[placeholder*="Ask"], div[contenteditable="true"]');
        
        if (!inputBox) {
            console.warn("Local Agent Warning: Could not locate AI input DOM element to inject feedback.");
            return;
        }

        // Make sure the chat box is selected and active
        inputBox.focus();

        if (inputBox.tagName === 'TEXTAREA') {
            // For standard text areas, bypass internal locks to set the text directly
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(inputBox, feedbackText);
            } else {
                inputBox.value = feedbackText;
            }
        } else {
            // For complex text boxes (ChatGPT), move the cursor to the very end
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(inputBox);
            range.collapse(false); 
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Simulate typing the text into the box
            document.execCommand('insertText', false, feedbackText);
        }

        // Simulate a paste event so the website saves the new text
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', feedbackText);
        const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
        });
        inputBox.dispatchEvent(pasteEvent);

        // Trigger input events so the website knows to enable the "Send" button
        inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        inputBox.dispatchEvent(new Event('change', { bubbles: true }));

        console.log("🚀 Feedback successfully injected into AI input box (using Deep Paste Simulation).");
    }

    // Listen for input requests from background.js and show a text box
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === "input_request") {
            const block = window.__activeAgentBlock;
            if (!block) {
                return;
            }

            const container = document.createElement('div');
            container.className = 'local-agent-input-box';
            container.style.marginTop = '12px';
            container.style.padding = '12px';
            container.style.backgroundColor = '#f8fafc';
            container.style.borderLeft = '4px solid #3b82f6'; 
            container.style.borderRadius = '4px';

            const promptLabel = document.createElement('div');
            promptLabel.innerText = "🐍 Python Requires Input: " + msg.prompt;
            promptLabel.style.color = '#334155';
            promptLabel.style.marginBottom = '8px';
            promptLabel.style.fontWeight = 'bold';

            const inputField = document.createElement('input');
            inputField.type = 'text';
            inputField.style.width = '100%';
            inputField.style.padding = '8px';
            inputField.style.border = '1px solid #cbd5e1';
            inputField.style.borderRadius = '4px';
            inputField.style.boxSizing = 'border-box';
            inputField.style.marginBottom = '8px';

            const submitBtn = document.createElement('button');
            submitBtn.innerText = "↵ Send to Python";
            submitBtn.style.backgroundColor = '#3b82f6';
            submitBtn.style.color = 'white';
            submitBtn.style.border = 'none';
            submitBtn.style.padding = '6px 12px';
            submitBtn.style.borderRadius = '4px';
            submitBtn.style.cursor = 'pointer';

            container.appendChild(promptLabel);
            container.appendChild(inputField);
            container.appendChild(submitBtn);

            block.parentElement.insertBefore(container, block.nextSibling);
            inputField.focus();

            const submitInput = () => {
                const val = inputField.value;
                container.remove(); 
                sendResponse(val);
            };

            submitBtn.onclick = submitInput;
            inputField.onkeydown = (e) => { 
                if (e.key === 'Enter') {
                    submitInput();
                }
            };
            return true;
        }
    });

    /**
     * Main loop to scan the DOM and inject buttons.
     */
    function injectButtons() {
        // Prevent errors if the extension is reloaded/updated
        try {
            if (!chrome.runtime || !chrome.runtime.id) {
                clearInterval(injectionInterval);
                return;
            }
        } catch (e) {
            clearInterval(injectionInterval);
            return;
        }

        // Remove buttons dynamically if the user disables the extension
        chrome.storage.local.get(['agentDisabled'], (res) => {
            if (res.agentDisabled) {
                document.querySelectorAll('.local-run-btn').forEach(btn => {
                    const block = btn.closest('pre') || btn.closest('div');
                    if (block) {
                        delete block.dataset.agentInjected;
                    }
                    btn.remove();
                });
                return;
            }

            // Find all code blocks
            const codeBlocks = document.querySelectorAll('pre, div.code-block-wrapper, div[class*="code-block"]');

            codeBlocks.forEach(block => {
                // Prevent duplicate targeting of nested containers
                if (block.parentElement.closest('pre') || block.parentElement.closest('div[class*="code-block"]')) {
                    return;
                }
                
                // Skip if block is already marked or button exists
                if (block.dataset.agentInjected === "true" || block.querySelector('.local-run-btn')) {
                    return;
                }

                // Traverse up the DOM to find the parent chat bubble container
                const chatBubble = block.closest('[data-message-author-role], .text-base, .message, div[class*="message"]');
                
                if (chatBubble) {
                    // Identity verification (Who sent this message)
                    const role = chatBubble.getAttribute('data-message-author-role');
                    
                    // If this message was sent by the user, block it completely.
                    if (role === 'user' || chatBubble.className.includes('user')) {
                        return; 
                    }

                    // Prevent buttons on system execution feedbacks
                    const paragraphs = Array.from(chatBubble.querySelectorAll('p')).map(p => p.innerText).join('\n');
                    if (paragraphs.includes('[Local Execution Success]') || 
                        paragraphs.includes('[Local Execution Failed]') || 
                        paragraphs.includes('[Local Execution Aborted]')) {
                        return; 
                    }
                }

                // Lenient Whitelist
                const codeNode = block.querySelector('code');
                if (codeNode) {
                    const langClass = codeNode.className.toLowerCase();
                    if (langClass.includes('language-') && !langClass.includes('python')) {
                        return; 
                    }
                }

                // Tag the current code block to prevent future injections
                block.dataset.agentInjected = "true";

                // Create and style the execution button
                const btn = document.createElement('button');
                btn.innerText = "🚀 Run in Local";
                btn.className = "local-run-btn";
                
                // Style adjustments, leave space on the right to avoid overlapping with native copy buttons
                btn.style.position = 'absolute';
                btn.style.top = '45px';
                btn.style.right = '12px'; 
                btn.style.zIndex = '9999';
                btn.style.padding = '4px 8px';
                btn.style.fontSize = '12px';
                btn.style.backgroundColor = '#10a37f';
                btn.style.color = 'white';
                btn.style.border = 'none';
                btn.style.borderRadius = '4px';
                btn.style.cursor = 'pointer';
                btn.style.fontWeight = '500';

                // Ensure the parent container can anchor the absolute-positioned button
                if (window.getComputedStyle(block).position === 'static') {
                    block.style.position = 'relative';
                }
                block.appendChild(btn);

                // Execute code when the button is clicked
                btn.addEventListener('click', (e) => {
                    // Prevent triggering the website's native click events
                    e.stopPropagation();

                    if (btn.innerText !== "🚀 Run in Local") {
                        return;
                    }
                    
                    window.__activeAgentBlock = block;
                    // State lock to prevent errors when pipeline disconnects
                    let isAborted = false;

                    // Extract text content from the <code> tag or the block itself
                    const codeElement = block.querySelector('code');
                    let codeContent = codeElement ? codeElement.innerText : block.innerText;
                    
                    // Strip UI text, status messages, and Markdown formatting
                    codeContent = codeContent
                        .replace(/🚀 Run in Local|⏳ Running...|✅ Success!|❌ Failed|❌ Timeout/g, "")
                        .replace(/<run_code>|<\/run_code>/gi, "")
                        .replace(/^(python|Copy code|Copy|Download|Run code|Run)\b/gim, "")
                        .replace(/^```[a-zA-Z]*\n?/gm, "")
                        .replace(/```$/gm, "")
                        .trim();

                    // Update UI to active state
                    btn.innerText = "⏳ Running...";
                    btn.style.backgroundColor = '#ff9800';

                    // Dynamically create the red Stop button
                    const stopBtn = document.createElement('button');
                    stopBtn.innerText = "⏹️ Stop";
                    stopBtn.className = "local-stop-btn";
                    stopBtn.style.position = 'absolute';
                    stopBtn.style.top = '75px';
                    stopBtn.style.right = '12px';
                    stopBtn.style.zIndex = '9999';
                    stopBtn.style.padding = '4px 8px';
                    stopBtn.style.fontSize = '12px';
                    stopBtn.style.backgroundColor = '#f44336'; 
                    stopBtn.style.color = 'white';
                    stopBtn.style.border = 'none';
                    stopBtn.style.borderRadius = '4px';
                    stopBtn.style.cursor = 'pointer';
                    stopBtn.style.fontWeight = '500';
                    
                    block.appendChild(stopBtn);

                    //Stop Button Click Event
                    stopBtn.addEventListener('click', (stopEvent) => {
                        stopEvent.stopPropagation();
                        
                        // Lock the state so the main callback ignores the channel closure
                        isAborted = true; 
                        
                        // Send the kill signal to the background script
                        chrome.runtime.sendMessage({ action: "force_stop" });

                        // Clean up any active input box hanging on the screen
                        const activeInputBox = block.parentElement.querySelector('.local-agent-input-box');
                        if (activeInputBox) {
                            activeInputBox.remove();
                        }
                        
                        // Update UI
                        stopBtn.remove();
                        btn.innerText = "❌ Aborted";
                        btn.style.backgroundColor = '#9e9e9e';
                        
                        // Send smart feedback to the AI for self-correction
                        const feedback = `[Local Execution Aborted]\nI manually terminated the script because it was running for a long time without responding.\n\nThis usually means one of two things:\n1. **Infinite Loop**: Please check the code for hanging \`while\` loops.\n2. **Heavy Computation**: If the code is just naturally slow, please rewrite it to include \`print()\` statements tracking the progress (e.g., printing progress every 10%).\n\nPlease analyze and provide the updated code.`;
                        
                        feedBackToAI(feedback);
                        setTimeout(() => resetBtn(btn), 3000);
                    });

                    // Put the sending logic in a function to try again if needed
                    const sendExecutionRequest = (bypassSecurity = false) => {
                        try {
                            chrome.runtime.sendMessage({
                                action: "execute_command",
                                code: codeContent,
                                bypass_security: bypassSecurity // Tell Python forcing it to run
                            }, (response) => {
                                // Stop doing anything if the user already clicked Stop
                                if (isAborted) {
                                    return;
                                }

                                // Security Warning
                                if (response && response.status === "security_warning") {
                                    const reasons = response.reasons.join(", ");
                                    const userAccepted = confirm(`🛡️ SECURITY WARNING\n\nThis script is trying to change or delete files.\n\nActions found:\n[ ${reasons} ]\n\nDo you want to ALLOW this to run?`);
                                    
                                    if (userAccepted) {
                                        // Show red button and try again without security checks
                                        btn.innerText = "⏳ Bypassing Sandbox...";
                                        btn.style.backgroundColor = '#f44336';
                                        sendExecutionRequest(true); 
                                    } else {
                                        // Cancel everything
                                        if (stopBtn.parentNode) {
                                            stopBtn.remove();
                                        }
                                        btn.innerText = "❌ Blocked";
                                        btn.style.backgroundColor = '#9e9e9e';
                                        setTimeout(() => resetBtn(btn), 3000);
                                    }
                                    return; // Stop here and wait for the next try
                                }

                                // Handle Standard Success
                                if (response && response.status === "success") {
                                    if (stopBtn.parentNode) {
                                        stopBtn.remove();
                                    }
                                    btn.innerText = "✅ Success!";
                                    btn.style.backgroundColor = '#10a37f';
                                    
                                    if (response.output && response.output.trim() !== "") {
                                        const feedback = `[Local Execution Success]\nHere is the terminal output from my local machine:\n\`\`\`text\n${response.output}\n\`\`\`\nPlease confirm if this matches the expected result.`;
                                        feedBackToAI(feedback);
                                    }
                                    setTimeout(() => resetBtn(btn), 3000);
                                }
                                // Handle Missing Dependencies (Auto-pip workflow)
                                else if (response && response.status === "need_install") {
                                    const pkgs = response.packages.join(", ");
                                    const userAccepted = confirm(`📦 This script requires external packages: [ ${pkgs} ].\n\nDo you want the local agent to install them and run the code?`);
                                    
                                    if (userAccepted) {
                                        btn.innerText = "⏳ Installing...";
                                        btn.style.backgroundColor = '#ff9800'; 
                                        
                                        if (stopBtn && stopBtn.parentNode) {
                                            // Remove any old event listeners by cloning the button
                                            const freshStopBtn = stopBtn.cloneNode(true);
                                            stopBtn.parentNode.replaceChild(freshStopBtn, stopBtn);
                                            
                                            // Assign new kill logic specifically for the pip installation process
                                            freshStopBtn.addEventListener('click', (stopEvent) => {
                                                stopEvent.stopPropagation();
                                                isAborted = true; 
                                                
                                                // Send kill signal to terminate pip/python
                                                chrome.runtime.sendMessage({ action: "force_stop" }); 
                                                
                                                freshStopBtn.remove();
                                                btn.innerText = "❌ Aborted";
                                                btn.style.backgroundColor = '#9e9e9e';
                                                feedBackToAI(`\n❌ [Installation Aborted] You manually stopped the installation of [ ${pkgs} ].\n`);
                                                setTimeout(() => resetBtn(btn), 3000);
                                            });
                                        }

                                        // Send confirmation to backend to start installing packages
                                        chrome.runtime.sendMessage({
                                            action: "confirm_install_and_run",
                                            code: codeContent,
                                            packages: response.packages
                                        }, (finalRes) => {
                                            if (isAborted) {
                                                return;
                                            }

                                            // Clean up the stop button when installation and execution are done
                                            const activeStopBtn = block.querySelector('.local-stop-btn');
                                            if (activeStopBtn) {
                                                activeStopBtn.remove();
                                            }

                                            // Handle success/failure of the run after installation
                                            if (finalRes && finalRes.status === "success") {
                                                btn.innerText = "✅ Success!";
                                                btn.style.backgroundColor = '#10a37f';
                                                if (finalRes.output && finalRes.output.trim() !== "") {
                                                    const feedback = `[Local Execution Success]\nDependencies installed. Output:\n\`\`\`text\n${finalRes.output}\n\`\`\`\n`;
                                                    feedBackToAI(feedback);
                                                }
                                            } else {
                                                btn.innerText = "❌ Failed";
                                                btn.style.backgroundColor = '#f44336';
                                                feedBackToAI(`[Local Execution Failed]\n${finalRes ? finalRes.msg : "Unknown error"}`);
                                            }
                                            setTimeout(() => resetBtn(btn), 3000);
                                        });
                                    } else {
                                        // If user declines the installation
                                        if (stopBtn && stopBtn.parentNode) {
                                            stopBtn.remove();
                                        }
                                        btn.innerText = "❌ Cancelled";
                                        btn.style.backgroundColor = '#9e9e9e';
                                        setTimeout(() => resetBtn(btn), 3000);
                                    }
                                }
                                // Handle General Execution Failure 
                                else {
                                    if (stopBtn.parentNode) {
                                        stopBtn.remove();
                                    }
                                    btn.innerText = "❌ Failed";
                                    btn.style.backgroundColor = '#f44336';

                                    // Construct feedback for general failure
                                    let feedback = `[Local Execution Failed]\n`;
                                    if (response && response.output && response.output.trim() !== "") {
                                        feedback += `The code ran partially. Here is the output before it crashed:\n\`\`\`text\n${response.output}\n\`\`\`\n\n`;
                                    }
                                    feedback += `Here is the error traceback:\n\`\`\`python\n${response ? response.msg : "No details provided"}\n\`\`\`\nPlease analyze the reason for this failure and provide the corrected Python code.`;
                                    feedBackToAI(feedback);

                                    setTimeout(() => resetBtn(btn), 3000);
                                }
                            });
                        } catch (err) {
                            // Interceptor for network/extension errors
                            if (isAborted) {
                                return;
                            }

                            // Ensure Stop button is removed on unexpected errors
                            if (stopBtn.parentNode) {
                                stopBtn.remove();
                            }
                            btn.innerText = "❌ Error";
                            btn.style.backgroundColor = '#f44336';
                            setTimeout(() => resetBtn(btn), 3000);
                        }
                    };

                    // Do NOT bypass security checks on the first try
                    sendExecutionRequest(false);
                });
            });
        });
    }

    /**
     * Resets the execution button to its original idle state.
     */
    function resetBtn(btn) {
        btn.innerText = "🚀 Run in Local";
        btn.style.backgroundColor = '#10a37f';
    }

    // Start the continuous DOM scanning loop (every 2 seconds)
    injectionInterval = setInterval(injectButtons, 2000);
    console.log("✅ Local Agent V1.7.0 successfully started (anti-shadow clone singleton lock + AI Feedback Engine + User Input + Force Stop Button + AST Security Sandbox + venv Isolation + venv Reset enabled)!");
}