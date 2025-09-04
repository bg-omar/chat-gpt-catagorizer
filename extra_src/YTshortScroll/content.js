// === settings (live from chrome.storage.sync) ===
let SETTINGS = { enabled: true, repeats: 1 };

// === loop detection thresholds ===
const WRAP_T_NEAR_ZERO = 0.4;
const WRAP_T_NEAR_END  = 0.6;
const URL_POLL_MS = 500;

let video = null;
let wrapCount = 0;
let lastTime = 0;
let advancedThisClip = false;
let hrefSeen = location.href;

// --- settings bootstrap & live updates ---
(async function initSettings() {
    const s = await chrome.storage.sync.get({ enabled: true, repeats: 1 });
    SETTINGS.enabled = !!s.enabled;
    SETTINGS.repeats = Number.isFinite(s.repeats) ? s.repeats : 1;
})();

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.enabled) SETTINGS.enabled = !!changes.enabled.newValue;
    if (changes.repeats) {
        const v = parseInt(changes.repeats.newValue, 10);
        SETTINGS.repeats = Number.isFinite(v) ? Math.max(0, v) : 1;
    }
    // Re-evaluate current attachment if enable flips
    if (changes.enabled) {
        if (SETTINGS.enabled) attachSoon(); else detach();
    }
});

// ---------- SPA handling ----------
setInterval(() => {
    if (location.href !== hrefSeen) {
        hrefSeen = location.href;
        reattach();
    }
}, URL_POLL_MS);
window.addEventListener("yt-navigate-finish", reattach, { passive: true });
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) reattach();
}, { passive: true });

// Initial attach
attachSoon();

// ---------- Core wiring ----------
function attachSoon() { setTimeout(attachToShort, 250); }
function reattach()    { detach(); attachSoon(); }

function attachToShort() {
    if (!SETTINGS.enabled) return; // respect toolbar toggle
    const v = findActiveShortVideo();
    if (!v) {
        const mo = new MutationObserver(() => {
            if (!SETTINGS.enabled) return;
            const vv = findActiveShortVideo();
            if (vv) {
                mo.disconnect();
                attachVideo(vv);
            }
        });
        mo.observe(document.documentElement, { childList: true, subtree: true });
        return;
    }
    attachVideo(v);
}

function detach() {
    if (video?.__autoAdvanceHandlers) {
        const { onTimeUpdate, onEnded, onSeeked } = video.__autoAdvanceHandlers;
        video.removeEventListener("timeupdate", onTimeUpdate);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("seeked", onSeeked);
    }
    if (video) video.__autoAdvanceHandlers = null;
    video = null;
    wrapCount = 0;
    lastTime = 0;
    advancedThisClip = false;
}

function attachVideo(v) {
    detach();

    video = v;
    wrapCount = 0;
    lastTime = v.currentTime || 0;
    advancedThisClip = false;

    const onTimeUpdate = () => {
        if (!video || !SETTINGS.enabled) return;
        const t  = video.currentTime || 0;
        const dur = Number.isFinite(video.duration) ? video.duration : NaN;

        const nearEnd  = Number.isFinite(dur) ? (lastTime > Math.max(0, dur - WRAP_T_NEAR_END)) : (lastTime > 1.0);
        const nearZero = t < WRAP_T_NEAR_ZERO;
        const jumpedBack = t + 0.4 < lastTime;

        if ((nearEnd && nearZero) || jumpedBack) {
            if (lastTime > 1.0 && nearZero) {
                wrapCount += 1;
                maybeAdvance();
            }
        }
        lastTime = t;
    };

    const onEnded = () => {
        if (!SETTINGS.enabled) return;
        wrapCount += 1;
        maybeAdvance();
    };

    const onSeeked = () => {
        if (!SETTINGS.enabled) return;
        if (video?.currentTime < WRAP_T_NEAR_ZERO && lastTime > 1.0) {
            wrapCount += 1;
            maybeAdvance();
        }
    };

    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);
    v.addEventListener("seeked", onSeeked);
    v.__autoAdvanceHandlers = { onTimeUpdate, onEnded, onSeeked };
}

function maybeAdvance() {
    if (advancedThisClip) return;
    // Advance after N repeats (0 => after first playthrough)
    if (wrapCount >= SETTINGS.repeats) {
        advancedThisClip = true;
        setTimeout(() => {
            if (!clickNextShortButton()) {
                if (!goToNextByAnchor()) {
                    simulateKeyNext();
                }
            }
        }, 60);
    }
}

// ---------- Find active <video> ----------
function findActiveShortVideo() {
    const vids = Array.from(document.querySelectorAll("video"));
    if (!vids.length) return null;
    let best = null, bestArea = -1;
    const vw = innerWidth, vh = innerHeight;
    for (const v of vids) {
        const r = v.getBoundingClientRect();
        const ix = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
        const iy = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
        const area = ix * iy;
        if (area > bestArea) { bestArea = area; best = v; }
    }
    return best;
}

// ---------- Prefer the sidebar "down" button you shared ----------
function clickNextShortButton() {
    let btn =
        document.querySelector('#navigation-button-down button') ||
        document.querySelector('.navigation-container #navigation-button-down button');

    if (!btn) {
        btn = deepQuerySelector([
            '.navigation-container',
            '#navigation-button-down',
            'button'
        ]);
    }

    if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
        btn.click();
        return true;
    }
    return false;
}

function deepQuerySelector(chain) {
    let node = document;
    for (const sel of chain) {
        node = queryInNodeOrShadow(node, sel);
        if (!node) return null;
    }
    return node;
}
function queryInNodeOrShadow(root, sel) {
    const roots = [];
    if (root instanceof Document || root instanceof ShadowRoot) roots.push(root);
    else if (root instanceof Element) {
        roots.push(root);
        if (root.shadowRoot) roots.push(root.shadowRoot);
    }
    for (const r of roots) {
        const found = r.querySelector(sel);
        if (found) return found;
    }
    return null;
}

// ---------- Fallbacks ----------
function goToNextByAnchor() {
    const currentId = getCurrentShortId();
    const anchors = Array.from(document.querySelectorAll('a[href^="/shorts/"]'));
    if (!anchors.length) return false;
    for (const a of anchors) {
        const id = extractShortId(a.href);
        if (id && id !== currentId) { a.click(); return true; }
    }
    return false;
}
function simulateKeyNext() {
    const ev = new KeyboardEvent("keydown", {
        key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40,
        bubbles: true, cancelable: true
    });
    window.dispatchEvent(ev);
}
function getCurrentShortId() {
    const k = location.pathname.indexOf("/shorts/");
    if (k === -1) return null;
    const rest = location.pathname.slice(k + "/shorts/".length);
    return rest.split("/")[0].split("?")[0];
}
function extractShortId(href) {
    try {
        const u = new URL(href, location.origin);
        const seg = (u.pathname.split("/shorts/")[1] || "").split("/")[0];
        return seg.split("?")[0];
    } catch { return null; }
}
