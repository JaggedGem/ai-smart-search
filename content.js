// Add this at the top of content.js
const storage = chrome.storage || browser.storage;

// Store feedback timer to prevent multiple timers
let feedbackTimer = null;

// Function to create Google search button
function createGoogleButton(query) {
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'flex items-center min-w-0 justify-center gap-xs';

  // Create SVG element
  const googleSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  googleSvg.setAttribute('viewBox', '0 0 24 24');
  googleSvg.setAttribute('width', '16');
  googleSvg.setAttribute('height', '16');
  googleSvg.style.fill = 'currentColor';

  // Simpler monochrome Google "G" logo
  googleSvg.innerHTML = `
    <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"/>
  `;

  buttonContainer.addEventListener('click', () => {
    // Track this as negative feedback for the ML model
    // The user was redirected but decided to use Google instead
    chrome.runtime.sendMessage({
      action: 'mlFeedback',
      query: query,
      shouldRedirect: false,
      feedbackId: `negative_${Date.now()}`
    });
    
    // Use escape parameter to prevent redirect
    window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}&escape=true`;
  });

  buttonContainer.appendChild(googleSvg);
  return buttonContainer;
}

// Add a function to track that the user is actually using the AI results
// This is positive feedback that the redirection was useful
function trackSuccessfulUse() {
  const url = window.location.href;
  if (!url.includes('perplexity.ai')) return;
  
  console.log('Checking for successful use...');
  
  // Clear any existing feedback timer
  if (feedbackTimer) {
    console.log('Clearing existing feedback timer');
    clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }
  
  storage.local.get(['lastRedirect', 'feedbackSent'], data => {
    const { lastRedirect, feedbackSent } = data;
    console.log('lastRedirect:', lastRedirect);
    console.log('feedbackSent:', feedbackSent);
    
    // Only send feedback once per session and if we haven't already sent it
    // Check if feedback was already sent for this specific query
    const feedbackKey = lastRedirect ? `feedback_${lastRedirect.query.replace(/\s+/g, '_')}` : null;
    
    if (lastRedirect && 
        !feedbackSent && 
        lastRedirect.timestamp > Date.now() - 300000) { // within 5 minutes
      
      // Check if we've already sent feedback for this query
      storage.local.get(feedbackKey, (feedbackData) => {
        if (feedbackData[feedbackKey]) {
          console.log(`Feedback already sent for query: ${lastRedirect.query}`);
          return;
        }
        
        console.log('Setting up positive feedback timer...');
        // Track user staying on page for more than 10 seconds as positive feedback
        feedbackTimer = setTimeout(() => {
          // Generate unique feedback ID
          const feedbackId = `positive_${Date.now()}`;
          console.log('Sending positive feedback for query:', lastRedirect.query);
          
          chrome.runtime.sendMessage({
            action: 'mlFeedback',
            query: lastRedirect.query,
            shouldRedirect: true,
            feedbackId: feedbackId
          }, response => {
            console.log('Feedback response:', response);
            
            // Mark feedback as sent for this specific query
            const storageUpdate = { feedbackSent: true };
            storageUpdate[feedbackKey] = true;
            storage.local.set(storageUpdate);
            
            // Clear redirect data to prevent further feedback
            storage.local.remove('lastRedirect');
          });
        }, 10000); // 10 seconds
      });
    }
  });
}

// Update the checkAndReplaceButton function
async function checkAndReplaceButton() {
  try {
    const url = window.location.href;
    if (!url.includes('perplexity.ai')) return;

    const result = await storage.local.get('lastRedirect');
    const lastRedirect = result.lastRedirect;

    // Fallback query from URL if none in lastRedirect
    const paramQuery = new URL(window.location.href).searchParams.get('q') || '';
    const usedQuery = lastRedirect && lastRedirect.query ? lastRedirect.query : paramQuery;

    console.log('Used query for button:', usedQuery);

    // Always create the Google button on perplexity.ai
    const questionButton = document.querySelector('.fa-question');
    console.log('Found question button:', questionButton); // For debugging

    if (questionButton) {
      const container = questionButton.closest('.flex.items-center');
      if (container) {
        console.log('Found container, creating Google button');
        // Replace it with our Google button
        const googleButton = createGoogleButton(usedQuery);
        if (lastRedirect?.multiTabUsed) {
          googleButton.addEventListener('click', () => {
            console.log('Google button clicked (multi-tab mode)');
            chrome.runtime.sendMessage({
              action: 'closePerplexityAndFocusGoogle',
              query: encodeURIComponent(usedQuery),
            });
          });
        }
        container.parentNode.replaceChild(googleButton, container);
      }
    }
    
    // Track that user viewed this page (positive feedback)
    trackSuccessfulUse();
  } catch (error) {
    console.error('Error:', error); // For debugging
  }
}

// Clean up feedback timer when page unloads
window.addEventListener('beforeunload', () => {
  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }
});

// Run when page loads
checkAndReplaceButton();

// Also run when React updates the DOM
const observer = new MutationObserver(() => {
  checkAndReplaceButton();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
