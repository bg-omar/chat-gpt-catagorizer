// Prevent double-injection
if (window.__SHORTS_AUTO_ADVANCE_LOADED) {
  // already initialized; abort further execution
} else {
  window.__SHORTS_AUTO_ADVANCE_LOADED = true;

  // === settings (session only) ===
  let SETTINGS = { enabled: true }; // repeats removed; use repeatCount variable
  let repeatCount = 0; // ephemeral, set by background messages

  // Remove obsolete storage bootstrap (extension no longer requests storage)

  // === loop detection thresholds ===
  const WRAP_T_NEAR_ZERO = 0.4;
  const WRAP_T_NEAR_END  = 0.6;
  const URL_POLL_MS = 500;
  const POLL_INTERVAL_MS = 1000; // fallback loop detection when timeupdate is throttled

  let video = null;
  let wrapCount = 0;
  let lastTime = 0;
  let advancedThisClip = false;
  let hrefSeen = location.href;
  let manualNavigation = false;
  let manualNavigationTimeout = null;
  let autoAdvanceTimer = null; // pending auto advance timeout id
  let pollTimer = null; // interval ID for fallback polling loop
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


  // Remove storage bootstrap; default enabled=true
  SETTINGS.enabled = true;

  // Listen for background toggle messages
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'SHORTS_AUTO_ADVANCE_TOGGLE') {
      const prevEnabled = SETTINGS.enabled;
      SETTINGS.enabled = !!msg.enabled;
      if (typeof msg.repeatCount === 'number') repeatCount = Math.max(0, Math.min(2, msg.repeatCount));
      if (prevEnabled !== SETTINGS.enabled) {
        if (SETTINGS.enabled) reattach(); else detach();
      }
    }
  });

  // ---------- SPA handling ----------
  setInterval(() => {
      const sig = normalizedLocationSignature();
      if (sig !== hrefSeen) {
          hrefSeen = sig;
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

  function isIndividualShortPage() {
      // Accept /shorts/VIDEOID with optional trailing slash or query params.
      return /\/shorts\/[A-Za-z0-9_-]+/.test(location.pathname);
  }

  function attachToShort() {
      if (!SETTINGS.enabled) return; // respect toolbar toggle
      if (!isIndividualShortPage()) return; // do not auto-advance on the shorts feed grid
      const v = findActiveShortVideo();
      if (!v) {
          const mo = new MutationObserver(() => {
              if (!SETTINGS.enabled || !isIndividualShortPage()) return;
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
      if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
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
          if (!SETTINGS.enabled || !isIndividualShortPage()) return;
          if (manualNavigation) return;
          const now = performance.now();
          if (now - lastWrapIncrementTs < 350) return;
          lastWrapIncrementTs = now;
          wrapCount += 1;
          maybeAdvance();
      }

      const onTimeUpdate = () => {
          if (!video || !SETTINGS.enabled || !isIndividualShortPage()) return;
          if (manualNavigation) return;
          const t  = video.currentTime || 0;
          const dur = Number.isFinite(video.duration) ? video.duration : Number.NaN;
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

      // Start fallback poll
      pollTimer = setInterval(() => {
          if (!SETTINGS.enabled || manualNavigation || !isIndividualShortPage()) return;
          if (!video) return;
          const t = video.currentTime || 0;
          const dur = Number.isFinite(video.duration) ? video.duration : Number.NaN;
          if (Number.isFinite(dur)) {
              const nearEndPrev = lastTime > Math.max(0, dur - WRAP_T_NEAR_END);
              const nearZeroNow = t < WRAP_T_NEAR_ZERO;
              const looped = nearEndPrev && nearZeroNow && lastTime > 1.0;
              const jumpedBack = t + 0.4 < lastTime;
              if (looped || jumpedBack) {
                  // Reuse debounce & manual suppression by calling incrementWrap
                  incrementWrap('poll');
              }
          }
          lastTime = t;
      }, POLL_INTERVAL_MS);
  }

  function maybeAdvance() {
      if (advancedThisClip || manualNavigation || !isIndividualShortPage()) return;
      const neededPlaythroughs = repeatCount + 1;
      if (wrapCount >= neededPlaythroughs) {
          if (performance.now() - recentUserInputTs < 300) {
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
      const vids = Array.from(document.querySelectorAll('video'));
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

      // Additional selectors (YouTube sometimes changes structure)
      if (!btn) btn = document.querySelector('button[aria-label="Next"][data-id="navigation-button-down"]');
      if (!btn) btn = document.querySelector('button[aria-label="Next video"], ytd-reel-video-renderer button[aria-label="Next"]');

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
      else if (root instanceof Element) { roots.push(root); if (root.shadowRoot) roots.push(root.shadowRoot); }
      for (const r of roots) { const found = r.querySelector(sel); if (found) return found; }
      return null;
  }

  // ---------- Fallbacks ----------
  function goToNextByAnchor() {
      const currentId = getCurrentShortId();
      const anchors = Array.from(document.querySelectorAll('a[href^="/shorts/"]'));
      if (!anchors.length) return false;
      for (const a of anchors) {
          const id = extractShortId(a.getAttribute('href')) || extractShortId(a.href);
          if (id && id !== currentId) { a.click(); return true; }
      }
      return false;
  }
  function simulateKeyNext() {
      const ev = new KeyboardEvent('keydown', {
          key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40,
          bubbles: true, cancelable: true
      });
      window.dispatchEvent(ev);
  }
  function getCurrentShortId() {
      const m = location.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/);
      return m ? m[1] : null;
  }
  function extractShortId(href) {
      if (!href) return null;
      try {
          if (!href.startsWith('http')) href = location.origin + href;
          const u = new URL(href);
          const m = u.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/);
          return m ? m[1] : null;
      } catch { return null; }
  }

  function normalizedLocationSignature() {
      return location.origin + location.pathname + location.search;
  }
}