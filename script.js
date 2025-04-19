// Word feedback tracking
let wordFeedback = {
  positive: {},
  negative: {},
  neutral: {}
};

// Initialize word feedback from localStorage if available
function initWordFeedback() {
  const savedWordFeedback = localStorage.getItem('wordFeedback');
  if (savedWordFeedback) {
    wordFeedback = JSON.parse(savedWordFeedback);
  }
  updateWordFeedbackVisualization();
}

// Extract words from query
function extractWords(query) {
  return query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

// Update word feedback based on query and feedback type
function updateWordFeedback(query, feedbackType) {
  const words = extractWords(query);
  
  words.forEach(word => {
    // Remove word from other feedback categories if it exists
    ['positive', 'negative', 'neutral'].forEach(category => {
      if (category !== feedbackType && wordFeedback[category][word]) {
        delete wordFeedback[category][word];
      }
    });
    
    // Add or update word in the current feedback category
    if (!wordFeedback[feedbackType][word]) {
      wordFeedback[feedbackType][word] = 1;
    } else {
      wordFeedback[feedbackType][word]++;
    }
  });
  
  // Save to localStorage
  localStorage.setItem('wordFeedback', JSON.stringify(wordFeedback));
  
  // Update visualization
  updateWordFeedbackVisualization();
}

// Update the feedback visualization in the UI
function updateWordFeedbackVisualization() {
  const container = document.getElementById('word-feedback-container');
  
  // Clear previous content
  container.innerHTML = '';
  
  // Create stats section
  const statsDiv = document.createElement('div');
  statsDiv.className = 'word-stats';
  
  const positiveCount = Object.keys(wordFeedback.positive).length;
  const negativeCount = Object.keys(wordFeedback.negative).length;
  const neutralCount = Object.keys(wordFeedback.neutral).length;
  
  // Add stats boxes
  const createStatBox = (title, count) => {
    const box = document.createElement('div');
    box.className = 'stat-box';
    box.innerHTML = `<h3>${title}</h3><p>${count}</p>`;
    return box;
  };
  
  statsDiv.appendChild(createStatBox('Positive Words', positiveCount));
  statsDiv.appendChild(createStatBox('Negative Words', negativeCount));
  statsDiv.appendChild(createStatBox('Neutral Words', neutralCount));
  
  container.appendChild(statsDiv);
  
  // Create word cloud
  const wordCloudDiv = document.createElement('div');
  wordCloudDiv.className = 'word-cloud';
  
  // Function to add words to cloud
  const addWordsToCloud = (category, className) => {
    const words = Object.entries(wordFeedback[category])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20); // Limit to top 20 words
    
    words.forEach(([word, count]) => {
      const wordItem = document.createElement('div');
      wordItem.className = `word-item ${className}`;
      wordItem.textContent = `${word} (${count})`;
      wordCloudDiv.appendChild(wordItem);
    });
  };
  
  addWordsToCloud('positive', 'word-positive');
  addWordsToCloud('negative', 'word-negative');
  addWordsToCloud('neutral', 'word-neutral');
  
  container.appendChild(wordCloudDiv);
}

// Modify the existing feedback functions to include word-level feedback
document.addEventListener('DOMContentLoaded', function() {
  // ... existing code ...
  
  // Initialize word feedback
  initWordFeedback();
  
  // Update the thumbsUp event listener
  document.getElementById('thumbsUp').addEventListener('click', function() {
    // ... existing thumbsUp code ...
    updateWordFeedback(document.getElementById('searchInput').value, 'positive');
  });
  
  // Update the thumbsDown event listener
  document.getElementById('thumbsDown').addEventListener('click', function() {
    // ... existing thumbsDown code ...
    updateWordFeedback(document.getElementById('searchInput').value, 'negative');
  });
  
  // Update the feedback-neutral event listener
  document.getElementById('feedback-neutral').addEventListener('click', function() {
    // ... existing neutral feedback code ...
    updateWordFeedback(document.getElementById('searchInput').value, 'neutral');
  });
}); 