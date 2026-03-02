let enabled = true; // session-only toggle
let repeatCount = 0; // 0 => advance after first playthrough
let animTimer = null;
let frameIndex = 0;
const ANIM_FRAMES = 10; // icon(0)..icon(9)
const ANIM_INTERVAL_MS = 300; // ~3.3 FPS, light on CPU
const SHORTS_REGEX = /https?:\/\/([^.]+\.)?youtube\.com\/shorts\//;

function setIconFrame(i) {
  const framePath = `icons/anim/icon(${i}).png`;
  chrome.action.setIcon({
    path: {
      '16': framePath,
      '32': framePath
    }
  });
}

function startAnimation() {
  if (animTimer) return;
  frameIndex = 0;
  setIconFrame(frameIndex);
  animTimer = setInterval(() => {
    frameIndex = (frameIndex + 1) % ANIM_FRAMES;
    setIconFrame(frameIndex);
  }, ANIM_INTERVAL_MS);
}
function stopAnimation() {
  if (animTimer) {
    clearInterval(animTimer);
    animTimer = null;
  }
  // revert to static enabled/disabled icon
  const iconSet = enabled
    ? { '16': 'icons/icon_16x16.png', '32': 'icons/icon_32x32.png' }
    : { '16': 'icons/icon_grey_16x16.png', '32': 'icons/icon_grey_32x32.png' };
  chrome.action.setIcon({ path: iconSet });
}

function refreshAnimationState() {
  // Always remove badge text
  chrome.action.setBadgeText({ text: '' });
  if (!enabled) {
    stopAnimation();
    return;
  }
  // Check active tab in focused window
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tab = tabs[0];
    const isShorts = !!(tab && tab.url && SHORTS_REGEX.test(tab.url));
    if (isShorts) {
      startAnimation();
    } else {
      stopAnimation();
    }
  });
}

function broadcastState(tabIds) {
  for (const id of tabIds) {
    try { chrome.tabs.sendMessage(id, { type: 'SHORTS_AUTO_ADVANCE_TOGGLE', enabled, repeatCount }); } catch {}
  }
}

async function broadcastToShortsTabs() {
  const tabs = await chrome.tabs.query({ url: ['*://*.youtube.com/shorts/*', '*://youtube.com/shorts/*'] });
  broadcastState(tabs.map(t => t.id));
}

chrome.runtime.onInstalled.addListener(() => { refreshAnimationState(); createMenus(); });
chrome.runtime.onStartup.addListener(() => { refreshAnimationState(); createMenus(); });

chrome.action.onClicked.addListener(async () => {
  enabled = !enabled;
  refreshAnimationState();
  await broadcastToShortsTabs();
});

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'toggle', title: enabled ? 'Disable Auto-Advance' : 'Enable Auto-Advance', contexts: ['action'] });
    chrome.contextMenus.create({ id: 'repeat_0', title: 'Repeat 0 (advance after 1)', contexts: ['action'] });
    chrome.contextMenus.create({ id: 'repeat_1', title: 'Repeat 1 (play twice)', contexts: ['action'] });
    chrome.contextMenus.create({ id: 'repeat_2', title: 'Repeat 2 (play thrice)', contexts: ['action'] });
  });
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  switch (info.menuItemId) {
    case 'toggle':
      enabled = !enabled; refreshAnimationState(); createMenus(); await broadcastToShortsTabs(); break;
    case 'repeat_0':
      repeatCount = 0; await broadcastToShortsTabs(); break;
    case 'repeat_1':
      repeatCount = 1; await broadcastToShortsTabs(); break;
    case 'repeat_2':
      repeatCount = 2; await broadcastToShortsTabs(); break;
  }
  // After repeat change, animation state may remain (only if Shorts active)
  if (info.menuItemId.startsWith('repeat_')) refreshAnimationState();
});

// Active tab changed -> reevaluate
chrome.tabs.onActivated.addListener(() => refreshAnimationState());
// URL changed in active tab -> reevaluate
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) refreshAnimationState();
});
// Window focus change -> reevaluate (stop anim if browser unfocused)
chrome.windows.onFocusChanged.addListener((winId) => {
  if (winId === chrome.windows.WINDOW_ID_NONE) {
    stopAnimation();
  } else {
    refreshAnimationState();
  }
});

// Adjust webNavigation commit callback: only ensure content script; animation decided by active tab check.
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const url = details.url;
  if (!SHORTS_REGEX.test(url)) return;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      func: () => !!window.__SHORTS_AUTO_ADVANCE_LOADED
    });
    if (!result) {
      await chrome.scripting.executeScript({ target: { tabId: details.tabId }, files: ['content.js'] });
    }
    chrome.tabs.sendMessage(details.tabId, { type: 'SHORTS_AUTO_ADVANCE_TOGGLE', enabled, repeatCount });
    refreshAnimationState();
  } catch (e) {
    console.warn('Shorts Auto-Advance injection failed', e);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'SHORTS_AUTO_ADVANCE_QUERY') {
    sendResponse({ enabled, repeatCount });
    return true;
  }
});