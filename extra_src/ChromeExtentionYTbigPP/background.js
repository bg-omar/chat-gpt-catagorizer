




// Function to handle the "popupClicked" action
async function handlePopupClicked() {
    console.log("Popup button was clicked!");
    return { status: "Success" };
}

// Function to handle the "openTab" action
async function handleOpenTab(message) {
    if (message.url) {
        // Open a new tab with the received URL
        chrome.tabs.create({ url: message.url });
        return { status: "Tab opened successfully" };
    } else {
        return { status: "Error", message: "URL is missing" };
    }
}

// Listener for incoming messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "popupClicked") {
        handlePopupClicked().then(sendResponse);
        return true; // Indicate async response
    } else if (message.action === "openTab") {
        handleOpenTab(message).then(sendResponse);
        return true; // Indicate async response
    } else {
        sendResponse({ status: "Error", message: "Unknown action" });
    }
});

