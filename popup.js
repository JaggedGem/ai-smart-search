document.addEventListener('DOMContentLoaded', function () {
  const storage = chrome.storage || browser.storage;

  // Extension Toggle
  const extensionToggle = document.getElementById('extensionToggle');
  storage.local.get('enabled', function (data) {
    extensionToggle.checked = data.enabled !== false;
  });
  extensionToggle.addEventListener('change', function () {
    storage.local.set({ enabled: extensionToggle.checked });
  });

  // Multi-tab Toggle
  const multiTabToggle = document.getElementById('multiTabToggle');
  storage.local.get('multiTab', function (data) {
    multiTabToggle.checked = data.multiTab === true;
  });
  multiTabToggle.addEventListener('change', function () {
    storage.local.set({ multiTab: multiTabToggle.checked });
  });

  // Theme Toggle
  const themeToggle = document.getElementById('themeToggle');
  storage.local.get('darkMode', function (data) {
    const isDark = data.darkMode === true;
    themeToggle.checked = isDark;
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
  });

  themeToggle.addEventListener('change', function () {
    const isDark = themeToggle.checked;
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    storage.local.set({ darkMode: isDark });
  });

  // Search History
  function updateSearchHistory() {
    storage.local.get('searchHistory', function (data) {
      const historyDiv = document.getElementById('searchHistory');
      const history = data.searchHistory || [];

      // Clear existing content
      historyDiv.textContent = '';

      if (history.length === 0) {
        const emEl = document.createElement('em');
        emEl.textContent = 'No recent searches';
        historyDiv.appendChild(emEl);
        return;
      }

      history
        .slice(-5)
        .reverse()
        .forEach((item) => {
          const itemDiv = document.createElement('div');
          itemDiv.className = 'history-item';
          itemDiv.style.cssText =
            'margin-bottom: 8px; padding: 8px; background: var(--bg-primary); border-radius: 4px;';

          const queryDiv = document.createElement('div');
          queryDiv.style.cssText = 'font-size: 14px; margin-bottom: 4px;';
          queryDiv.textContent = item.query;

          const bottomDiv = document.createElement('div');
          bottomDiv.style.cssText =
            'display: flex; justify-content: space-between; align-items: center;';

          const timeSmall = document.createElement('small');
          timeSmall.style.color = 'var(--text-secondary)';
          timeSmall.textContent = new Date(item.timestamp).toLocaleString();

          const link = document.createElement('a');
          link.href = item.url;
          link.target = '_blank';
          link.style.cssText = 'color: #2196F3; text-decoration: none;';
          link.textContent = 'View Result';

          bottomDiv.appendChild(timeSmall);
          bottomDiv.appendChild(link);

          itemDiv.appendChild(queryDiv);
          itemDiv.appendChild(bottomDiv);

          historyDiv.appendChild(itemDiv);
        });
    });
  }
  updateSearchHistory();

  // Statistics
  function updateStats() {
    storage.local.get('stats', function (data) {
      const stats = data.stats || { searches: 0, timesSaved: '0min' };
      document.getElementById('totalSearches').textContent = stats.searches;
      document.getElementById('timesSaved').textContent = stats.timesSaved;
    });
  }
  updateStats();

  function showToast(message) {
    const toast = document.getElementById('toastContainer');
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
    }, 2000);
  }

  // Button Event Listeners
  document.getElementById('manageEngines').addEventListener('click', () => {
    // TODO: Implement search engine management
    showToast('Search engine management coming soon!');
  });

  document.getElementById('manageShortcuts').addEventListener('click', () => {
    // TODO: Implement shortcuts management
    showToast('Shortcuts management coming soon!');
  });

  const editListSection = document.getElementById('editListSection');
  const whitelistInput = document.getElementById('whitelistInput');
  const blacklistInput = document.getElementById('blacklistInput');
  const saveListBtn = document.getElementById('saveListBtn');
  const backBtn = document.getElementById('backBtn');
  const manageListBtn = document.getElementById('manageListBtn');

  function showEditList() {
    storage.local.get(['whitelist', 'blacklist'], (data) => {
      whitelistInput.value = (data.whitelist || []).join(', ');
      blacklistInput.value = (data.blacklist || []).join(', ');
      editListSection.style.display = 'block';
    });
  }

  function hideEditList() {
    editListSection.style.display = 'none';
  }

  manageListBtn.addEventListener('click', () => {
    storage.local.get(['whitelist', 'blacklist'], (data) => {
      whitelistInput.value = (data.whitelist || []).join(', ');
      blacklistInput.value = (data.blacklist || []).join(', ');
      editListSection.style.display = 'block';
      editListSection.scrollIntoView({ behavior: 'smooth' });
    });
  });

  saveListBtn.addEventListener('click', () => {
    const wList = whitelistInput.value
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    const bList = blacklistInput.value
      .split(',')
      .map((b) => b.trim().toLowerCase())
      .filter(Boolean);
    storage.local.set({ whitelist: wList, blacklist: bList }, () => {
      showToast('Lists saved');
      hideEditList();
    });
  });

  backBtn.addEventListener('click', hideEditList);
});
