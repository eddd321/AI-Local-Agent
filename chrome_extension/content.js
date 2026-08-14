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

            // Find all code blocks (Compatible with ChatGPT, Gemini, DeepSeek, etc.)
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

                // Tag the current code block to prevent future injections
                block.dataset.agentInjected = "true";

                // Create and style the execution button
                const btn = document.createElement('button');
                btn.innerText = "🚀 Run in Local";
                btn.className = "local-run-btn";
                
                // Style adjustments, leave space on the right to avoid overlapping with native copy buttons
                btn.style.position = 'absolute';
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
                    // Prevent triggering the website's native click events (e.g., expanding the block)
                    e.stopPropagation();

                    // Extract text content from the <code> tag or the block itself
                    const codeElement = block.querySelector('code');
                    let codeContent = codeElement ? codeElement.innerText : block.innerText;
                    
                    // Strip UI text, status messages, and Markdown formatting
                    codeContent = codeContent
                        .replace(/🚀 Run in Local|⏳ Running...|✅ Success!|❌ Failed|❌ Timeout/g, "")
                        .replace(/<run_code>|<\/run_code>/gi, "")
                        .replace(/^(python|Copy code|Copy|Download)\b/gim, "") 
                        .replace(/^```[a-zA-Z]*\n?/gm, "")
                        .replace(/```$/gm, "")
                        .trim();

                    // Update UI to active state
                    btn.innerText = "⏳ Running...";
                    btn.style.backgroundColor = '#ff9800';

                    // Prevent the UI from hanging infinitely
                    let hasResponded = false;
                    const timeoutTimer = setTimeout(() => {
                        if (!hasResponded) {
                            btn.innerText = "❌ Timeout";
                            btn.style.backgroundColor = '#f44336';
                            console.warn("Local Agent Notice: Connection timeout, backend host.py is not responding.");
                            setTimeout(() => resetBtn(btn), 3000);
                        }
                    }, 8000);

                    // Send the sanitized code to the background script
                    try {
                        chrome.runtime.sendMessage({
                            action: "execute_command",
                            code: codeContent
                        }, (response) => {
                            hasResponded = true;
                            clearTimeout(timeoutTimer);

                            // Handle Standard Success
                            if (response && response.status === "success") {
                                btn.innerText = "✅ Success!";
                                btn.style.backgroundColor = '#10a37f';
                                if (response.msg) {
                                    console.log("💻 Python execution result:\n", response.msg);
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
                                    
                                    chrome.runtime.sendMessage({
                                        action: "confirm_install_and_run",
                                        code: codeContent,
                                        packages: response.packages
                                    }, (finalRes) => {
                                        if (finalRes && finalRes.status === "success") {
                                            btn.innerText = "✅ Success!";
                                            btn.style.backgroundColor = '#10a37f';
                                            if (finalRes.msg) {
                                                console.log("💻 Python execution result:\n", finalRes.msg);
                                            }
                                        } else {
                                            btn.innerText = "❌ Failed";
                                            btn.style.backgroundColor = '#f44336';
                                            console.error("🐛 Python Code Error:\n", finalRes ? finalRes.msg : "Unknown error");
                                        }
                                        setTimeout(() => resetBtn(btn), 3000);
                                    });
                                } else {
                                    btn.innerText = "❌ Cancelled";
                                    btn.style.backgroundColor = '#9e9e9e';
                                    setTimeout(() => resetBtn(btn), 3000);
                                }
                            }
                            // Handle General Execution Failure 
                            else {
                                btn.innerText = "❌ Failed";
                                btn.style.backgroundColor = '#f44336';
                                console.error("🐛 Python Code Error:\n", response ? response.msg : "No details provided");
                                setTimeout(() => resetBtn(btn), 3000);
                            }
                        });
                    } catch (err) {
                        hasResponded = true;
                        clearTimeout(timeoutTimer);
                        btn.innerText = "❌ Error";
                        btn.style.backgroundColor = '#f44336';
                        setTimeout(() => resetBtn(btn), 3000);
                    }
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
    console.log("✅ Local Agent V4 successfully started (anti-shadow clone singleton lock enabled)!");
}