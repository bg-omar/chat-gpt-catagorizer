function setBadgeAndIcon(enabled) {
    chrome.action.setBadgeText({ text: enabled ? "ON" : "" });
    if (enabled) chrome.action.setBadgeBackgroundColor({ color: "#0b8457" });

    chrome.action.setIcon({
        path: enabled
            ? { "16": "icon.png", "32": "icon.png" }
            : { "16": "icon_grey.png", "32": "icon_grey.png" }
    });
}

async function init() {
    const { enabled = true } = await chrome.storage.sync.get("enabled");
    setBadgeAndIcon(enabled);
}

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.enabled) {
        setBadgeAndIcon(Boolean(changes.enabled.newValue));
    }
});
