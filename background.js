const storage = chrome.storage || browser.storage;
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

// Add at the top with other constants
const SEARCH_ENGINES = {
  perplexity: {
    name: 'Perplexity AI',
    url: (query) => `https://www.perplexity.ai/search/new?q=${query}`,
    domain: 'perplexity.ai',
  },
  chatgpt: {
    name: 'ChatGPT',
    // Just go to main page since we can't directly input query
    url: () => 'https://chat.openai.com',
    domain: 'chat.openai.com',
  },
};

// Replace the constant with a function
function calculateTimeSaved(query) {
  const baseTime = 30; // base seconds saved
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

// Add function to copy text to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch((err) => {
    console.error('Failed to copy text: ', err);
  });
}

// Update openPerplexityTabs to be more generic
async function openSearchTabs(query, engine, multiTab) {
  const urls = [SEARCH_ENGINES[engine].url(query)];

  if (engine === 'chatgpt') {
    copyToClipboard(query);
  }

  if (multiTab) {
    urls.push(`https://www.google.com/search?q=${query}&escape=true`);
  }

  for (const url of urls) {
    chrome.tabs.create({ url });
  }
}

// Add this function to background.js
function trackSearchHistory(query, initialUrl) {
  // Listen for URL updates in the tab where we redirected
  chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
    if (changeInfo.url && changeInfo.url.includes('perplexity.ai/search/')) {
      // If this is the final URL (not /new/ or /pending/)
      if (!changeInfo.url.includes('/new/') && !changeInfo.url.includes('/pending/')) {
        // Store in history
        storage.local.get('searchHistory', function (data) {
          const history = data.searchHistory || [];
          history.push({
            query: query,
            url: changeInfo.url,
            timestamp: Date.now(),
          });

          // Keep only last 50 searches
          if (history.length > 50) {
            history.shift();
          }

          storage.local.set({ searchHistory: history });
        });

        // Remove the listener
        chrome.tabs.onUpdated.removeListener(listener);
      }
    }
  });
}

// Update the onBeforeRequest listener to track stats when redirecting
chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    return new Promise((resolve) => {
      storage.local.get(
        ['enabled', 'multiTab', 'stats', 'searchEngine', 'whitelist', 'blacklist'],
        function (data) {
          const url = new URL(details.url);
          const query = url.searchParams.get('q') || url.searchParams.get('query');
          const escape = url.searchParams.get('escape');

          // Use selected search engine or default to perplexity
          const engine = data.searchEngine || 'perplexity';

          // Check if extension is enabled
          if (data.enabled === false) {
            resolve({});
            return;
          }

          // Don't redirect if escape parameter is present
          if (escape) {
            resolve({});
            return;
          }

          if (query) {
            const lowerQuery = query.toLowerCase();
            const inBlacklist = (data.blacklist || []).some((word) => lowerQuery.includes(word));
            const inWhitelist = (data.whitelist || []).some((word) => lowerQuery.includes(word));

            if (inBlacklist) {
              resolve({}); // No redirect if blacklisted
              return;
            }

            if (isNicheQuery(query) || inWhitelist) {
              const formattedQuery = formatQuery(query);

              // Track the search history
              trackSearchHistory(query, SEARCH_ENGINES[engine].url(formattedQuery));

              // Update statistics
              const stats = data.stats || { searches: 0, timesSaved: '0min', totalSeconds: 0 };
              stats.searches++;

              // Calculate time saved using the new function
              stats.totalSeconds = (stats.totalSeconds || 0) + calculateTimeSaved(query);
              stats.timesSaved = `${Math.floor(stats.totalSeconds / 60)}min`;

              // Save updated stats
              storage.local.set({ stats });

              if (engine === 'chatgpt') {
                // For ChatGPT, always open in new tab and copy query to clipboard
                openSearchTabs(formattedQuery, engine, data.multiTab);
                resolve({ cancel: true });
                return;
              }

              // Handle Perplexity normally
              const searchUrl = SEARCH_ENGINES[engine].url(formattedQuery);
              if (data.multiTab) {
                storage.local.set({
                  lastRedirect: {
                    query: query,
                    timestamp: Date.now(),
                    engine: engine,
                    multiTabUsed: true,
                  },
                });
                openSearchTabs(formattedQuery, engine, true);
                resolve({ cancel: true });
                return;
              }

              storage.local.set({
                lastRedirect: {
                  query: query,
                  timestamp: Date.now(),
                  engine: engine,
                  multiTabUsed: false,
                },
              });
              resolve({ redirectUrl: searchUrl });
              return;
            }
          }
          resolve({});
        }
      );
    });
  },
  { urls: ['*://www.google.com/search*'] },
  ['blocking']
);

// Initialize storage with default values
storage.local.get(['enabled', 'multiTab', 'stats'], function (data) {
  if (data.enabled === undefined) {
    storage.local.set({ enabled: true });
  }
  if (data.multiTab === undefined) {
    storage.local.set({ multiTab: false });
  }
  if (!data.stats) {
    storage.local.set({
      stats: {
        searches: 0,
        timesSaved: '0min',
        totalSeconds: 0,
      },
    });
  }
});

// Initialize white/black lists if undefined
storage.local.get(['whitelist', 'blacklist'], function (data) {
  if (!data.whitelist) {
    storage.local.set({ whitelist: [] });
  }
  if (!data.blacklist) {
    storage.local.set({ blacklist: [] });
  }
});

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
