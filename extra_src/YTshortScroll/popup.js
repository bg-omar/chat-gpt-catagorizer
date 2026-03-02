const $ = (id) => document.getElementById(id);
const enabledEl = $("enabled");
const statusEl  = $("status");
const savedEl   = $("saved");

async function load() {
    const { enabled } = await chrome.storage.sync.get({ enabled: true });
    enabledEl.checked = !!enabled;
    statusEl.textContent = enabledEl.checked ? "Active on Shorts" : "Disabled";
}

function softSaved() {
    savedEl.style.opacity = "1";
    setTimeout(() => (savedEl.style.opacity = "0"), 800);
}

enabledEl.addEventListener("change", async () => {
    const enabled = enabledEl.checked;
    await chrome.storage.sync.set({ enabled });
    statusEl.textContent = enabled ? "Active on Shorts" : "Disabled";
    softSaved();
});

load();