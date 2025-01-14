const nicheKeywords = ["how", "what", "why", "when", "who", "which", "where", "does", "do", "is", "are", "can", "could", "would", "should", "?"];

function isNicheQuery(query) {
  const queryLower = query.toLowerCase();
  return nicheKeywords.some(keyword => queryLower.includes(keyword));
}

function formatQuery(query) {
  return query.trim().replace(/\s+/g, '+');
}

browser.webRequest.onBeforeRequest.addListener(
  function(details) {
    const url = new URL(details.url);
    const query = url.searchParams.get("q") || url.searchParams.get("query");

    if (query && isNicheQuery(query)) {
      const formattedQuery = formatQuery(query);
      const perplexityUrl = `https://www.perplexity.ai/search/new?q=${formattedQuery}`;
      return { redirectUrl: perplexityUrl };
    }
    return {};
  },
  { urls: ["*://www.google.com/search*"] },
  ["blocking"]
);
