chrome.action.onClicked.addListener((tab) => {
    if (!tab.id) {
        console.error("No active tab available.");
        return;
    }

    // Get the current timeout setting and send it to the content script
    chrome.storage.local.get("enableTimeout", (data) => {
        const enableTimeout = data.enableTimeout || false; // Default to false
        chrome.tabs.sendMessage(tab.id, { action: "renderLaTeX", enableTimeout }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error sending message to content script:", chrome.runtime.lastError.message);
            } else {
                console.log("Message sent successfully:", response);
            }
        });
    });
});