chrome.action.onClicked.addListener((tab) => {
    // Send a message to the active tab to trigger LaTeX rendering
    chrome.tabs.sendMessage(tab.id, { action: "renderLaTeX" });
});
