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
let justAttached = false;
let manualNavigation = false;
let manualNavigationTimeout = null;
let autoAdvanceTimer = null; // pending auto advance timeout id
// Track recent user input to distinguish manual navigation
let recentUserInputTs = 0;
let lastWrapIncrementTs = 0; // debounce duplicate wrap detections

function markUserInput() {
    recentUserInputTs = performance.now();
    // If an auto-advance is pending, cancel it because the user intervened.
    if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer);
        autoAdvanceTimer = null;
    }
}

['wheel','mousedown','touchstart','keydown'].forEach(ev => {
    window.addEventListener(ev, markUserInput, { capture:true, passive:true });
});

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
    if (autoAdvanceTimer) { // cancel any pending programmatic advance (prevents double skip)
        clearTimeout(autoAdvanceTimer);
        autoAdvanceTimer = null;
    }
    // Reset wrap debounce
    lastWrapIncrementTs = 0;
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
    manualNavigation = true;
    if (manualNavigationTimeout) clearTimeout(manualNavigationTimeout);
    // Longer suppression window if there was very recent user input (indicates manual scroll)
    const now = performance.now();
    const baseDelay = 600;
    const extra = (now - recentUserInputTs) < 800 ? 500 : 0; // add buffer if user just interacted
    manualNavigationTimeout = setTimeout(() => { manualNavigation = false; }, baseDelay + extra);

    function incrementWrap(cause) {
        if (!SETTINGS.enabled) return;
        if (manualNavigation) return; // suppressed during manual window
        const now = performance.now();
        // Debounce: sometimes both 'ended' and loop detection fire for same cycle.
        if (now - lastWrapIncrementTs < 350) {
            if (window.__SHORTS_ADV_DEBUG) console.log('[ShortsAdv] Skipping duplicate wrap via', cause);
            return;
        }
        lastWrapIncrementTs = now;
        wrapCount += 1;
        if (window.__SHORTS_ADV_DEBUG) console.log('[ShortsAdv] wrap++ =', wrapCount, 'cause=', cause, 'needed=', SETTINGS.repeats + 1);
        maybeAdvance();
    }

    const onTimeUpdate = () => {
        if (!video || !SETTINGS.enabled) return;
        if (manualNavigation) return;
        const t  = video.currentTime || 0;
        const dur = Number.isFinite(video.duration) ? video.duration : NaN;
        const nearEnd  = Number.isFinite(dur) ? (lastTime > Math.max(0, dur - WRAP_T_NEAR_END)) : (lastTime > 1.0);
        const nearZero = t < WRAP_T_NEAR_ZERO;
        const jumpedBack = t + 0.4 < lastTime;
        if ((nearEnd && nearZero) || jumpedBack) {
            if (lastTime > 1.0 && nearZero) {
                incrementWrap('timeupdate-loop');
            }
        }
        lastTime = t;
    };

    const onEnded = () => {
        if (!SETTINGS.enabled) return;
        if (manualNavigation) return;
        incrementWrap('ended');
    };

    const onSeeked = () => {
        if (!SETTINGS.enabled) return;
        if (manualNavigation) return;
        if (video?.currentTime < WRAP_T_NEAR_ZERO && lastTime > 1.0) {
            incrementWrap('seeked-loop');
        }
    };

    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);
    v.addEventListener("seeked", onSeeked);
    v.__autoAdvanceHandlers = { onTimeUpdate, onEnded, onSeeked };
}

function maybeAdvance() {
    if (advancedThisClip) return;
    if (manualNavigation) return; // never auto-advance during suppression window
    const neededPlaythroughs = SETTINGS.repeats + 1;
    if (wrapCount >= neededPlaythroughs) {
        if (performance.now() - recentUserInputTs < 300) {
            if (window.__SHORTS_ADV_DEBUG) console.log('[ShortsAdv] Abort advance due to recent user input; resetting counters');
            wrapCount = 0;
            lastTime = video?.currentTime || 0;
            lastWrapIncrementTs = performance.now();
            return;
        }
        advancedThisClip = true;
        if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); }
        autoAdvanceTimer = setTimeout(() => {
            autoAdvanceTimer = null;
            if (performance.now() - recentUserInputTs < 400) {
                if (window.__SHORTS_ADV_DEBUG) console.log('[ShortsAdv] Advance cancelled (late user input)');
                advancedThisClip = false;
                return;
            }
            if (window.__SHORTS_ADV_DEBUG) console.log('[ShortsAdv] Advancing to next short');
            if (!clickNextShortButton()) {
                if (!goToNextByAnchor()) {
                    simulateKeyNext();
                }
            }
        }, 120);
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
