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

// ML Model Configuration
const MODEL_CONFIG = {
  features: {
    queryLength: query => query.length,
    wordCount: query => query.trim().split(/\s+/).length,
    hasQuestion: query => query.includes('?') ? 1 : 0,
    avgWordLength: query => {
      const words = query.trim().split(/\s+/);
      return words.length > 0 ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 0;
    },
    hasNicheKeyword: query => nicheKeywords.some(keyword => query.toLowerCase().includes(keyword)) ? 1 : 0
  }
};

// Track word-level feedback
const WORD_FEEDBACK = {
  // Maps words to their feedback scores
  // A positive score means the word is associated with redirection
  // A negative score means the word is associated with NOT redirecting
  wordScores: {},
  
  // Add feedback for a word
  addFeedback: function(word, shouldRedirect) {
    word = word.toLowerCase().trim();
    // Skip very short words and common words
    if (word.length < 3 || this.isCommonWord(word)) return;
    
    // Initialize if needed
    if (!this.wordScores[word]) {
      this.wordScores[word] = 0;
    }
    
    // Update score - positive for redirect, negative for no redirect
    this.wordScores[word] += shouldRedirect ? 1 : -1;
    
    // Clamp values to prevent extreme bias
    this.wordScores[word] = Math.max(-5, Math.min(5, this.wordScores[word]));
    
    // Save updated scores
    this.saveScores();
    
    console.log(`Updated word feedback: "${word}" = ${this.wordScores[word]}`);
  },
  
  // Get feedback score for a word
  getWordScore: function(word) {
    word = word.toLowerCase().trim();
    return this.wordScores[word] || 0;
  },
  
  // Get combined score for a query
  getQueryScore: function(query) {
    const words = this.extractWords(query);
    if (words.length === 0) return 0;
    
    let totalScore = 0;
    let wordCount = 0;
    
    words.forEach(word => {
      const score = this.getWordScore(word);
      if (score !== 0) {
        totalScore += score;
        wordCount++;
      }
    });
    
    // If we have no word feedback, return neutral score
    if (wordCount === 0) return 0;
    
    // Return normalized score between -1 and 1
    return totalScore / (wordCount * 5);
  },
  
  // Extract meaningful words from a query
  extractWords: function(query) {
    // Convert to lowercase and split by non-alphanumeric characters
    return query.toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(word => word.length >= 3 && !this.isCommonWord(word));
  },
  
  // Check if a word is a common word (stop word)
  isCommonWord: function(word) {
    const stopWords = [
      'the', 'and', 'for', 'with', 'this', 'that', 'its', 'from',
      'not', 'has', 'was', 'are', 'have', 'had', 'but', 'all'
    ];
    return stopWords.includes(word.toLowerCase());
  },
  
  // Load scores from storage
  loadScores: function() {
    return new Promise(resolve => {
      storage.local.get('wordScores', data => {
        if (data.wordScores) {
          this.wordScores = data.wordScores;
          console.log('Loaded word scores from storage:', Object.keys(this.wordScores).length, 'words');
        }
        
        // Initialize question words with high confidence scores if they don't exist
        const questionWords = [
          'how', 'what', 'why', 'when', 'who', 'which', 'where',
          'does', 'do', 'is', 'are', 'can', 'could', 'would', 'should'
        ];
        
        let updatedScores = false;
        questionWords.forEach(word => {
          // Only initialize if the word doesn't already have a score or has a low score
          if (!this.wordScores[word] || this.wordScores[word] < 4) {
            this.wordScores[word] = 5; // Maximum positive score
            updatedScores = true;
          }
        });
        
        // Also give high confidence to question mark
        if (!this.wordScores['?'] || this.wordScores['?'] < 4) {
          this.wordScores['?'] = 5;
          updatedScores = true;
        }
        
        // Save if we updated any scores
        if (updatedScores) {
          this.saveScores();
          console.log('Initialized question words with high confidence scores');
        }
        
        resolve();
      });
    });
  },
  
  // Save scores to storage
  saveScores: function() {
    storage.local.set({ wordScores: this.wordScores });
  },
  
  // Get all tracked words and their scores
  getAllWords: function() {
    return { ...this.wordScores };
  },
  
  // Reset all word scores
  reset: function() {
    this.wordScores = {};
    this.saveScores();
    console.log('Reset all word scores');
  }
};

// Initialize Model
let model = null;
let normalizer = null;

// Feature extraction
function extractFeatures(query) {
  return Object.values(MODEL_CONFIG.features).map(featureFn => featureFn(query));
}

// Create and initialize model
async function initModel() {
  try {
    // Load model if it exists
    const savedModel = await loadModelFromStorage();
    if (savedModel) {
      model = savedModel.model;
      normalizer = savedModel.normalizer;
      console.log('Loaded existing model');
      return;
    }
    
    // Create new model if none exists
    model = tf.sequential();
    model.add(tf.layers.dense({
      units: 10, 
      activation: 'relu',
      inputShape: [Object.keys(MODEL_CONFIG.features).length]
    }));
    model.add(tf.layers.dense({
      units: 1, 
      activation: 'sigmoid'
    }));
    
    model.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    // Initialize feature normalizer with empty data
    normalizer = {
      mean: Array(Object.keys(MODEL_CONFIG.features).length).fill(0),
      std: Array(Object.keys(MODEL_CONFIG.features).length).fill(1)
    };
    
    console.log('Created new model');
    
    // Save initial model
    await saveModelToStorage();
  } catch (error) {
    console.error('Error initializing model:', error);
  }
}

// Normalize features 
function normalizeFeatures(features) {
  return features.map((value, index) => 
    (value - normalizer.mean[index]) / (normalizer.std[index] || 1)
  );
}

// Track recent predictions for visualization
const _recentPredictions = [];
const MAX_RECENT_PREDICTIONS = 20;

// Predict if query should be redirected
async function predictRedirect(query) {
  try {
    if (!model) {
      await initModel();
    }
    
    // Get word-level feedback score
    const wordScore = WORD_FEEDBACK.getQueryScore(query);
    
    // Check if query contains any of the question words
    const queryLower = query.toLowerCase();
    const hasQuestionWord = nicheKeywords.some(keyword => queryLower.includes(keyword));
    
    // If query has question words and strong positive word feedback, prioritize redirection
    if (hasQuestionWord && wordScore > 0.2) {
      console.log(`Using question word priority for query: "${query}" (score: ${wordScore})`);
      return true;
    }
    
    // If we have strong word feedback (positive or negative), use that directly
    if (wordScore > 0.4) {
      console.log(`Using positive word feedback for query: "${query}" (score: ${wordScore})`);
      return true;
    }
    
    if (wordScore < -0.4) {
      console.log(`Using negative word feedback for query: "${query}" (score: ${wordScore})`);
      return false;
    }
    
    // Otherwise, use the neural network
    const features = extractFeatures(query);
    const normalizedFeatures = normalizeFeatures(features);
    
    const prediction = model.predict(tf.tensor2d([normalizedFeatures]));
    const score = await prediction.data();
    prediction.dispose();
    
    // Blend the neural network score with the word-level feedback
    let finalScore = score[0];
    
    // If we have some word feedback (but not strong enough to decide directly),
    // blend it with the neural network prediction
    if (wordScore !== 0) {
      // Convert wordScore from [-1,1] to [0,1] for blending
      const wordScoreNormalized = (wordScore + 1) / 2;
      
      // Weight between neural network and word feedback
      // More weight to word feedback as we get more samples
      // Give even more weight if the query contains question words
      let wordFeedbackWeight = Math.min(0.7, Object.keys(WORD_FEEDBACK.getAllWords()).length / 100);
      
      // Increase weight for queries with question words
      if (hasQuestionWord) {
        wordFeedbackWeight = Math.min(0.9, wordFeedbackWeight + 0.2);
      }
      
      // Blend scores
      finalScore = (finalScore * (1 - wordFeedbackWeight)) + (wordScoreNormalized * wordFeedbackWeight);
      
      console.log(`Blended scores for "${query}": NN=${score[0].toFixed(2)}, Word=${wordScoreNormalized.toFixed(2)}, Final=${finalScore.toFixed(2)}`);
    }
    
    // Save prediction data for visualization
    _recentPredictions.push({
      query,
      features,
      normalizedFeatures,
      nnScore: score[0],
      wordScore: wordScore,
      finalScore: finalScore,
      score: finalScore, // For backwards compatibility
      timestamp: Date.now(),
      shouldRedirect: finalScore > 0.5
    });
    
    // Keep only recent predictions
    if (_recentPredictions.length > MAX_RECENT_PREDICTIONS) {
      _recentPredictions.shift();
    }
    
    return finalScore > 0.5;
  } catch (error) {
    console.error('Prediction error:', error);
    // Fall back to rule-based approach on error
    return isNicheQuery(query);
  }
}

// Train model with new example
async function trainModel(query, shouldRedirect) {
  try {
    if (!model) {
      await initModel();
    }
    
    console.log(`Training model with query: "${query}", shouldRedirect: ${shouldRedirect}`);
    
    // Apply word-level feedback
    const words = WORD_FEEDBACK.extractWords(query);
    console.log(`Extracted words for feedback:`, words);
    
    // Update feedback for each word in the query
    words.forEach(word => {
      WORD_FEEDBACK.addFeedback(word, shouldRedirect);
    });
    
    // Get training data
    const storedData = await getTrainingData();
    console.log(`Current training samples: ${storedData.features.length}`);
    
    // Create a hash for this query to check for duplicates
    const queryHash = hashString(query.toLowerCase().trim());
    
    // Check if this query is already in our training data
    const isDuplicate = storedData.queryHashes && storedData.queryHashes.includes(queryHash);
    
    if (isDuplicate) {
      console.log(`Skipping duplicate training example for query: "${query}"`);
      return;
    }
    
    const newFeatures = extractFeatures(query);
    
    // Add new example
    storedData.features.push(newFeatures);
    storedData.labels.push(shouldRedirect ? 1 : 0);
    
    // Initialize queryHashes if it doesn't exist
    if (!storedData.queryHashes) {
      storedData.queryHashes = [];
    }
    
    // Add hash to track this query
    storedData.queryHashes.push(queryHash);
    
    // Only keep last 1000 examples
    if (storedData.features.length > 1000) {
      storedData.features.shift();
      storedData.labels.shift();
      if (storedData.queryHashes.length > 1000) {
        storedData.queryHashes.shift();
      }
    }
    
    // Save updated training data
    await storage.local.set({ trainingData: storedData });
    console.log(`Updated training samples: ${storedData.features.length}`);
    
    // Update normalizer
    updateNormalizer(storedData.features);
    
    // Train model
    if (storedData.features.length >= 10) {
      const normalizedFeatures = storedData.features.map(feat => normalizeFeatures(feat));
      
      console.log('Starting model training...');
      await model.fit(
        tf.tensor2d(normalizedFeatures), 
        tf.tensor2d(storedData.labels.map(l => [l])), 
        {
          epochs: 5,
          batchSize: Math.min(32, storedData.features.length),
          shuffle: true,
          verbose: 0
        }
      );
      
      // Save updated model
      await saveModelToStorage();
      console.log('Model trained with new example');
    } else {
      console.log('Not enough samples to train model yet. Need at least 10 samples.');
    }
  } catch (error) {
    console.error('Training error:', error);
  }
}

// Update normalizer with new features
function updateNormalizer(features) {
  if (features.length === 0) return;
  
  // Calculate mean and std for each feature
  const featureCount = features[0].length;
  const sums = Array(featureCount).fill(0);
  
  // Calculate means
  features.forEach(feature => {
    feature.forEach((value, index) => {
      sums[index] += value;
    });
  });
  
  const means = sums.map(sum => sum / features.length);
  
  // Calculate std deviations
  const squaredDiffs = Array(featureCount).fill(0);
  
  features.forEach(feature => {
    feature.forEach((value, index) => {
      squaredDiffs[index] += Math.pow(value - means[index], 2);
    });
  });
  
  const stds = squaredDiffs.map(sum => Math.sqrt(sum / features.length) || 1);
  
  normalizer = { mean: means, std: stds };
}

// Get training data from storage
async function getTrainingData() {
  return new Promise((resolve) => {
    storage.local.get('trainingData', (data) => {
      resolve(data.trainingData || { features: [], labels: [] });
    });
  });
}

// Save model to storage
async function saveModelToStorage() {
  if (!model) return;
  
  try {
    const modelData = await model.save(tf.io.withSave(async modelArtifacts => {
      await storage.local.set({ modelArtifacts: modelArtifacts });
    }));
    
    await storage.local.set({ normalizer });
    console.log('Model saved to storage');
  } catch (error) {
    console.error('Error saving model:', error);
  }
}

// Load model from storage
async function loadModelFromStorage() {
  return new Promise((resolve) => {
    storage.local.get(['modelArtifacts', 'normalizer'], async (data) => {
      if (data.modelArtifacts && data.normalizer) {
        try {
          const loadedModel = await tf.loadLayersModel(tf.io.fromMemory(data.modelArtifacts));
          resolve({ model: loadedModel, normalizer: data.normalizer });
        } catch (error) {
          console.error('Error loading model:', error);
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}

// Modify the existing onBeforeRequest listener to use ML model
chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    return new Promise(async (resolve) => {
      storage.local.get(
        ['enabled', 'multiTab', 'stats', 'searchEngine', 'whitelist', 'blacklist', 'mlEnabled'],
        async function (data) {
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

            if (inWhitelist) {
              // Always redirect if whitelisted
              performRedirect(resolve, data, query, engine);
              return;
            }

            try {
              // Check if ML is enabled, otherwise use rule-based approach
              if (data.mlEnabled !== false) {
                // Use ML model to predict if we should redirect
                const shouldRedirect = await predictRedirect(query);
                
                if (shouldRedirect) {
                  performRedirect(resolve, data, query, engine);
                  return;
                }
              } else if (isNicheQuery(query)) {
                // Fallback to rule-based approach if ML is disabled
                performRedirect(resolve, data, query, engine);
                return;
              }
            } catch (error) {
              console.error('Error in ML prediction:', error);
              // Fall back to rule-based approach on error
              if (isNicheQuery(query)) {
                performRedirect(resolve, data, query, engine);
                return;
              }
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

// Extract redirect logic into a separate function for cleaner code
function performRedirect(resolve, data, query, engine) {
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
}

// Initialize model on extension load
initModel();

// Initialize storage with default values
storage.local.get(['enabled', 'multiTab', 'stats', 'mlEnabled'], function (data) {
  if (data.enabled === undefined) {
    storage.local.set({ enabled: true });
  }
  if (data.multiTab === undefined) {
    storage.local.set({ multiTab: false });
  }
  if (data.mlEnabled === undefined) {
    storage.local.set({ mlEnabled: true });
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

// Keep track of processed feedback IDs to prevent duplicates
const processedFeedback = new Set();

// Add to the message listener to handle requests
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
  } else if (request.action === 'mlFeedback') {
    // Handle machine learning feedback
    const { query, shouldRedirect, feedbackId } = request;
    
    console.log('Received ML feedback:', request);
    
    // Check if we've already processed this feedback
    if (feedbackId && processedFeedback.has(feedbackId)) {
      console.log(`Duplicate feedback (${feedbackId}) ignored`);
      if (sendResponse) {
        sendResponse({ status: 'Duplicate feedback ignored' });
      }
      return true;
    }
    
    // Add to processed feedback set if ID is provided
    if (feedbackId) {
      processedFeedback.add(feedbackId);
      // Limit the size of processedFeedback set to prevent memory issues
      if (processedFeedback.size > 1000) {
        // Convert to array, remove oldest entries, convert back to set
        const feedbackArray = Array.from(processedFeedback);
        processedFeedback.clear();
        feedbackArray.slice(-500).forEach(id => processedFeedback.add(id));
      }
    }
    
    if (query) {
      console.log(`ML Feedback received: Query "${query}" should ${shouldRedirect ? '' : 'not'} redirect`);
      // Train the model with this feedback
      trainModel(query, shouldRedirect);
      
      // Send response to confirm receipt
      if (sendResponse) {
        sendResponse({ status: 'Feedback received' });
      }
    }
    return true; // Keep connection open for async response
  } else if (request.action === 'resetML') {
    // Reset the ML model
    storage.local.remove(['modelArtifacts', 'normalizer', 'trainingData'], async () => {
      // Reinitialize model
      model = null;
      normalizer = null;
      processedFeedback.clear(); // Clear processed feedback set
      await initModel();
      console.log('ML model reset');
      
      if (sendResponse) {
        sendResponse({ status: 'Model reset complete' });
      }
    });
    return true; // Keep connection open for async response
  }
});

// Simple hash function for strings
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

// Load word scores on startup
WORD_FEEDBACK.loadScores();
