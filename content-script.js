// Content script for injecting a redirect button to Perplexity into Google search pages

// Function to get the current search query from the URL
function getSearchQuery() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('q') || '';
}

// Function to inject CSS
function injectCSS() {
  const link = document.createElement('link');
  link.href = chrome.runtime.getURL('redirect-button.css');
  link.type = 'text/css';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}

// Function to create and inject the redirect button
function injectRedirectButton() {
  // Get the current search query
  const query = getSearchQuery();
  if (!query) return; // No query to redirect
  
  // Only inject if we're on a Google search results page
  if (!window.location.href.includes('google.com/search')) return;
  
  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'perplexity-redirect-container';
  
  // Create the redirect button
  const redirectButton = document.createElement('button');
  redirectButton.className = 'perplexity-redirect-button';
  redirectButton.innerText = 'Try this in Perplexity AI';
  
  // Create a small perplexity icon to add before the text
  const iconSpan = document.createElement('span');
  iconSpan.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 6px;">
      <circle cx="50" cy="50" r="45" fill="white"/>
      <path d="M50 0C22.4 0 0 22.4 0 50C0 77.6 22.4 100 50 100C77.6 100 100 77.6 100 50C100 22.4 77.6 0 50 0ZM77.9 76.2C75.7 78.4 72.3 78.4 70.1 76.2L50.1 56.2L30.1 76.2C27.9 78.4 24.5 78.4 22.3 76.2C20.1 74 20.1 70.6 22.3 68.4L42.3 48.4L22.3 28.4C20.1 26.2 20.1 22.8 22.3 20.6C24.5 18.4 27.9 18.4 30.1 20.6L50.1 40.6L70.1 20.6C72.3 18.4 75.7 18.4 77.9 20.6C80.1 22.8 80.1 26.2 77.9 28.4L57.9 48.4L77.9 68.4C80 70.5 80 73.9 77.9 76.2Z" fill="#9c27b0"/>
    </svg>
  `;
  
  // Add feedback message container
  const feedbackMessage = document.createElement('div');
  feedbackMessage.className = 'feedback-message';
  feedbackMessage.textContent = 'Training model to redirect similar queries';
  
  // Add click event listener to redirect and send feedback
  redirectButton.addEventListener('click', () => {
    // Show feedback message
    feedbackMessage.classList.add('show-feedback-message');
    
    // Send positive feedback to improve ML model for this query
    chrome.runtime.sendMessage({
      action: 'mlFeedback',
      query: query,
      shouldRedirect: true,
      feedbackId: `manual_${Date.now()}_${query.slice(0, 20)}`
    }, response => {
      console.log('Feedback response:', response);
      
      // Wait a moment before redirecting to show the feedback message
      setTimeout(() => {
        // Redirect to Perplexity
        const perplexityUrl = `https://www.perplexity.ai/search/new?q=${encodeURIComponent(query)}`;
        window.location.href = perplexityUrl;
      }, 800);
    });
  });
  
  redirectButton.prepend(iconSpan);
  buttonContainer.appendChild(redirectButton);
  buttonContainer.appendChild(feedbackMessage);
  
  // Append the button container to the body
  document.body.appendChild(buttonContainer);
}

// Inject CSS first
injectCSS();

// Run on page load
injectRedirectButton();

// Re-run if the page content changes (helps with dynamic SPA sites)
const observer = new MutationObserver(() => {
  // Check if our button is still in the DOM, if not re-add it
  if (!document.querySelector('.perplexity-redirect-container')) {
    injectRedirectButton();
  }
});

// Start observing the document for changes
observer.observe(document.body, { 
  childList: true,
  subtree: true 
}); 