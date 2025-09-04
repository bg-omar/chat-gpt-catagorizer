const $ = (id) => document.getElementById(id);
const enabledEl = $("enabled");
const repeatsEl = $("repeats");
const statusEl  = $("status");
const savedEl   = $("saved");

async function load() {
    const { enabled, repeats } = await chrome.storage.sync.get({
        enabled: true,
        repeats: 1
    });
    enabledEl.checked = !!enabled;
    repeatsEl.value = Number.isFinite(repeats) ? repeats : 1;
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

repeatsEl.addEventListener("change", async () => {
    let v = parseInt(repeatsEl.value, 10);
    if (!Number.isFinite(v) || v < 0) v = 0;
    if (v > 9) v = 9;
    repeatsEl.value = v;
    await chrome.storage.sync.set({ repeats: v });
    softSaved();
});

load();
