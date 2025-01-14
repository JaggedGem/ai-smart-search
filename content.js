// Add this at the top of content.js
const storage = chrome.storage || browser.storage;

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
    // Use escape parameter to prevent redirect
    window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}&escape=true`;
  });

  buttonContainer.appendChild(googleSvg);
  return buttonContainer;
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

    // Always create the Google button on perplexity.ai
    const questionButton = document.querySelector('.fa-question');
    console.log('Found question button:', questionButton); // For debugging

    if (questionButton) {
      const container = questionButton.closest('.flex.items-center');
      if (container) {
        // Replace it with our Google button
        const googleButton = createGoogleButton(usedQuery);
        if (lastRedirect?.multiTabUsed) {
          googleButton.addEventListener('click', () => {
            chrome.runtime.sendMessage({
              action: 'closePerplexityAndFocusGoogle',
              query: encodeURIComponent(usedQuery),
            });
          });
        }
        container.parentNode.replaceChild(googleButton, container);

        // Clear the redirect data
        storage.local.remove('lastRedirect');
      }
    }
  } catch (error) {
    console.error('Error:', error); // For debugging
  }
}

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
