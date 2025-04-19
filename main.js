// Word-level feedback tracking
let wordFeedback = {};

// Function to extract words from a query
function extractWords(query) {
  // Remove special characters and split by spaces
  return query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0);
}

// Update word-level feedback based on user interactions
function updateWordFeedback(query, isPositive) {
  const words = extractWords(query);
  
  words.forEach(word => {
    if (!wordFeedback[word]) {
      wordFeedback[word] = { positive: 0, negative: 0, total: 0 };
    }
    
    if (isPositive) {
      wordFeedback[word].positive += 1;
    } else {
      wordFeedback[word].negative += 1;
    }
    
    wordFeedback[word].total += 1;
  });
  
  // Persist to localStorage
  localStorage.setItem('wordFeedback', JSON.stringify(wordFeedback));
  
  // Update the visualization
  updateWordFeedbackVisualization();
}

// Load word feedback data from localStorage
function loadWordFeedback() {
  const savedData = localStorage.getItem('wordFeedback');
  if (savedData) {
    wordFeedback = JSON.parse(savedData);
  }
  updateWordFeedbackVisualization();
}

// Update the word feedback visualization
function updateWordFeedbackVisualization() {
  const container = document.getElementById('word-feedback-container');
  if (!container) return;
  
  // Clear previous content
  container.innerHTML = '';
  
  // Create stats section
  const statsDiv = document.createElement('div');
  statsDiv.className = 'word-stats';
  
  // Count total tracked words
  const totalWords = Object.keys(wordFeedback).length;
  
  // Count positive and negative words (where positive > negative or negative > positive)
  let positiveWords = 0;
  let negativeWords = 0;
  
  Object.values(wordFeedback).forEach(stats => {
    if (stats.positive > stats.negative) positiveWords++;
    if (stats.negative > stats.positive) negativeWords++;
  });
  
  // Create stat boxes
  const statBoxes = [
    { label: 'Total Words', value: totalWords },
    { label: 'Positive Words', value: positiveWords },
    { label: 'Negative Words', value: negativeWords }
  ];
  
  statBoxes.forEach(stat => {
    const box = document.createElement('div');
    box.className = 'word-stat-box';
    box.innerHTML = `
      <h4>${stat.label}</h4>
      <div class="stat-number">${stat.value}</div>
    `;
    statsDiv.appendChild(box);
  });
  
  container.appendChild(statsDiv);
  
  // Create word cloud
  const cloudDiv = document.createElement('div');
  cloudDiv.className = 'word-cloud';
  
  // Sort words by total frequency
  const sortedWords = Object.entries(wordFeedback)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 50); // Limit to top 50 words
  
  // Find max frequency for sizing
  const maxFreq = sortedWords.length > 0 ? sortedWords[0][1].total : 0;
  
  sortedWords.forEach(([word, stats]) => {
    const wordEl = document.createElement('span');
    
    // Determine word sentiment class
    let sentimentClass = 'word-neutral';
    if (stats.positive > stats.negative) {
      sentimentClass = 'word-positive';
    } else if (stats.negative > stats.positive) {
      sentimentClass = 'word-negative';
    }
    
    // Determine size class (1-8 scale)
    const sizeClass = `word-size-${Math.ceil((stats.total / maxFreq) * 8)}`;
    
    wordEl.className = `word-item ${sentimentClass} ${sizeClass}`;
    wordEl.textContent = word;
    
    // Add tooltip with stats
    wordEl.title = `${word}: ${stats.positive} positive, ${stats.negative} negative`;
    
    cloudDiv.appendChild(wordEl);
  });
  
  container.appendChild(cloudDiv);
}

// Update the existing feedback functions to track word-level feedback
function registerPositiveFeedback(query) {
  updateWordFeedback(query, true);
  // ... existing code ...
}

function registerNegativeFeedback(query) {
  updateWordFeedback(query, false);
  // ... existing code ...
}

// Initialize word feedback when document loads
document.addEventListener('DOMContentLoaded', function() {
  loadWordFeedback();
  // ... existing code ...
}); 