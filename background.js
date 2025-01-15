const storage = chrome.storage.local;

const nicheKeywords = [
  'how',
  'what',
  'why',
  'when',
  'who',
  'which',
  'where',
  'does',
  'do',
  'is',
  'are',
  'can',
  'could',
  'would',
  'should',
  '?',
];

const SEARCH_ENGINES = {
  perplexity: {
    name: 'Perplexity AI',
    url: (query) => `https://www.perplexity.ai/search/new?q=${query}`,
    domain: 'perplexity.ai',
  },
  chatgpt: {
    name: 'ChatGPT',
    url: () => 'https://chat.openai.com',
    domain: 'chat.openai.com',
  },
};

function calculateTimeSaved(query) {
  const baseTime = 30;
  const wordsCount = query.trim().split(/\s+/).length;
  const specialChars = (query.match(/[?!]/g) || []).length;
  return baseTime + wordsCount * 5 + specialChars * 2;
}

function isNicheQuery(query) {
  const queryLower = query.toLowerCase();
  return nicheKeywords.some((keyword) => queryLower.includes(keyword));
}

function formatQuery(query) {
  return query.trim().replace(/\s+/g, '+');
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
}

async function openSearchTabs(query, engine, multiTab) {
  const urls = [SEARCH_ENGINES[engine].url(query)];

  if (engine === 'chatgpt') {
    await copyToClipboard(query);
  }

  if (multiTab) {
    urls.push(`https://www.google.com/search?q=${query}&escape=true`);
  }

  for (const url of urls) {
    chrome.tabs.create({ url });
  }
}

function trackSearchHistory(query, initialUrl) {
  chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
    if (changeInfo.url && changeInfo.url.includes('perplexity.ai/search/')) {
      if (!changeInfo.url.includes('/new/') && !changeInfo.url.includes('/pending/')) {
        storage.get('searchHistory', function (data) {
          const history = data.searchHistory || [];
          history.push({
            query: query,
            url: changeInfo.url,
            timestamp: Date.now(),
          });

          if (history.length > 50) {
            history.shift();
          }

          storage.set({ searchHistory: history });
        });

        chrome.tabs.onUpdated.removeListener(listener);
      }
    }
  });
}

async function handleSearch(details) {
  const url = new URL(details.url);
  const query = url.searchParams.get('q') || url.searchParams.get('query');
  const escape = url.searchParams.get('escape');

  if (!query || escape) {
    return;
  }

  const data = await storage.get([
    'enabled',
    'multiTab',
    'stats',
    'searchEngine',
    'whitelist',
    'blacklist',
  ]);

  // Check if extension is enabled
  if (data.enabled === false) {
    return;
  }

  const lowerQuery = query.toLowerCase();
  const inBlacklist = (data.blacklist || []).some((word) => lowerQuery.includes(word));
  const inWhitelist = (data.whitelist || []).some((word) => lowerQuery.includes(word));

  if (inBlacklist) {
    return;
  }

  if (isNicheQuery(query) || inWhitelist) {
    const formattedQuery = formatQuery(query);
    const engine = data.searchEngine || 'perplexity';

    // Track search history
    trackSearchHistory(query, SEARCH_ENGINES[engine].url(formattedQuery));

    // Update statistics
    const stats = data.stats || { searches: 0, timesSaved: '0min', totalSeconds: 0 };
    stats.searches++;
    stats.totalSeconds = (stats.totalSeconds || 0) + calculateTimeSaved(query);
    stats.timesSaved = `${Math.floor(stats.totalSeconds / 60)}min`;
    await storage.set({ stats });

    // Store last redirect info
    await storage.set({
      lastRedirect: {
        query: query,
        timestamp: Date.now(),
        engine: engine,
        multiTabUsed: data.multiTab,
      },
    });

    if (engine === 'chatgpt') {
      await openSearchTabs(formattedQuery, engine, data.multiTab);
      return { cancel: true };
    }

    // Handle Perplexity redirect
    const searchUrl = SEARCH_ENGINES[engine].url(formattedQuery);
    if (data.multiTab) {
      await openSearchTabs(formattedQuery, engine, true);
      return { cancel: true };
    }

    return { redirectUrl: searchUrl };
  }
}

// Initialize extension on install or update
chrome.runtime.onInstalled.addListener(() => {
  storage.get(['enabled', 'multiTab', 'stats', 'whitelist', 'blacklist'], function (data) {
    const defaults = {
      enabled: data.enabled ?? true,
      multiTab: data.multiTab ?? false,
      stats: data.stats ?? { searches: 0, timesSaved: '0min', totalSeconds: 0 },
      whitelist: data.whitelist ?? [],
      blacklist: data.blacklist ?? [],
    };
    storage.set(defaults);

    // Set up declarativeNetRequest rules
    setupRedirectRules();
  });
});

// Set up declarativeNetRequest rules
async function setupRedirectRules() {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: [
      {
        id: 1,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            {
              header: 'x-search-redirect',
              operation: 'set',
              value: 'true',
            },
          ],
        },
        condition: {
          urlFilter: '*://www.google.com/search*',
          resourceTypes: ['main_frame'],
        },
      },
    ],
  });
}

// Listen for search requests
chrome.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    if (details.url.includes('google.com/search')) {
      const result = await handleSearch(details);
      if (result?.redirectUrl) {
        chrome.tabs.update(details.tabId, { url: result.redirectUrl });
      } else if (result?.cancel) {
        chrome.tabs.remove(details.tabId);
      }
    }
  },
  {
    url: [
      {
        hostContains: 'google.com',
        pathContains: 'search',
      },
    ],
  }
);

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'closePerplexityAndFocusGoogle') {
    const { query } = request;
    chrome.tabs.query({}, (tabs) => {
      const match = tabs.find(
        (t) => t.url.includes('https://www.google.com/search') && t.url.includes(query)
      );
      if (match) {
        chrome.tabs.update(match.id, { active: true });
      }
      if (sender.tab.id) {
        chrome.tabs.remove(sender.tab.id);
      }
    });
  }
});
