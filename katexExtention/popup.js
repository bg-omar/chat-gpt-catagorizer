document.addEventListener("DOMContentLoaded", () => {
    // Get the toggle element
    const timeoutToggle = document.getElementById("timeoutToggle");
    if (!timeoutToggle) {
        console.error("Element with ID 'timeoutToggle' not found.");
    } else {
        console.log("Found element:", timeoutToggle);
    }
    if (!timeoutToggle) {
        console.error("Element with ID 'timeoutToggle' not found.");
        return;
    }

    // Load the saved state of the toggle
    chrome.storage.local.get("enableTimeout", (data) => {
        timeoutToggle.checked = data.enableTimeout || false;
    });

    // Save the toggle state when changed
    timeoutToggle.addEventListener("change", () => {
        chrome.storage.local.set({ enableTimeout: timeoutToggle.checked });
    });
});