(function(){
  const statusEl = document.getElementById('status');
  const toggleBtn = document.getElementById('toggle');
  const repeatButtons = Array.from(document.querySelectorAll('.repeat-options button'));

  function requestState() {
    chrome.runtime.sendMessage({ type: 'SHORTS_GET_STATE' }, (state) => {
      if (!state) return;
      render(state);
    });
  }

  function render(state) {
    statusEl.textContent = state.enabled ? 'Enabled' : 'Disabled';
    toggleBtn.textContent = state.enabled ? 'Disable' : 'Enable';
    toggleBtn.classList.toggle('off', !state.enabled);
    repeatButtons.forEach(btn => {
      const val = Number(btn.dataset.repeat);
      btn.classList.toggle('active', val === state.repeatCount);
    });
  }

  toggleBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'SHORTS_TOGGLE_ENABLED' }, render);
  });

  repeatButtons.forEach(btn => btn.addEventListener('click', () => {
    const val = Number(btn.dataset.repeat);
    chrome.runtime.sendMessage({ type: 'SHORTS_SET_REPEAT', repeatCount: val }, render);
  }));

  requestState();
})();