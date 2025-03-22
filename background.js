/**
 * Background script for HabitHub extension
 */

// Constants
const ALARM_CHECK_GOALS = 'check-goals';
const IDLE_THRESHOLD_SECONDS = 60; // 1 minute

// State variables
let activeTab = null;
let startTime = null;
let isTracking = true;

// Track the current active tab
let currentSession = {
  url: null,
  startTime: null,
  tabId: null
};

// Default settings
const DEFAULT_SETTINGS = {
  notifications: true,
  notificationFrequency: 15, // minutes
  dataRetention: 30 // days
};

// Initialize when extension is installed or updated
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('HabitHub installed or updated:', details.reason);
  
  try {
    // Initialize storage
    const storage = getStorageModule();
    if (storage) {
      await storage.init();
    } else {
      console.error('HabitHubStorage not available');
    }
    
    // Clear alarm and create a new one
    await clearAndCreateAlarm();
    
    // Start tracking current tab
    await updateCurrentTabInfo();
  } catch (error) {
    console.error('Error initializing extension:', error);
  }
});

// Set up event listeners when extension starts
chrome.runtime.onStartup.addListener(() => {
  console.log('HabitHub starting up');
  initializeExtension();
});

// Initialize the extension
async function initializeExtension() {
  try {
    // Make sure storage is initialized
    if (typeof chrome.storage !== 'undefined') {
      // Create initial settings if needed
      chrome.storage.local.get('habithub_settings', async (data) => {
        if (!data.habithub_settings) {
          // Default settings
          await chrome.storage.local.set({ 'habithub_settings': DEFAULT_SETTINGS });
          console.log('HabitHub settings initialized');
        }
      });
      
      // Create alarm for regular checks
      chrome.alarms.create('updateStats', {
        periodInMinutes: 1 // Check every minute
      });
    }
  } catch (error) {
    console.error('Error in initializeExtension:', error);
  }
}

// Handle tab updates (URL changes, page loads)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && isTrackableUrl(tab.url)) {
    updateActiveSession(tab);
  }
});

// Handle tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, tab => {
    if (chrome.runtime.lastError) {
      console.error('Error getting tab info:', chrome.runtime.lastError);
      return;
    }
    
    if (tab && isTrackableUrl(tab.url)) {
      updateActiveSession(tab);
    } else {
      pauseCurrentSession();
    }
  });
});

// Handle window focus changes
chrome.windows.onFocusChanged.addListener(windowId => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus, pause the current session
    pauseCurrentSession();
  } else {
    // Browser gained focus, update current tab info
    updateCurrentTabInfo();
  }
});

// Update current tab info when browser regains focus
async function updateCurrentTabInfo() {
  try {
    const tabs = await new Promise(resolve => {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs));
    });
    
    if (tabs && tabs.length > 0 && isTrackableUrl(tabs[0].url)) {
      updateActiveSession(tabs[0]);
    } else {
      pauseCurrentSession();
    }
  } catch (error) {
    console.error('Error updating current tab info:', error);
  }
}

// Update the current active session
async function updateActiveSession(tab) {
  try {
    // Parse the URL to get website domain
    const url = new URL(tab.url);
    const website = url.hostname;
    
    // Get the storage module
    const storage = getStorageModule();
    if (!storage) {
      console.error('Storage module not available');
      return;
    }
    
    // Get current session
    const currentSession = await storage.getCurrentSession();
    
    // Check if we need to update the current session
    if (!currentSession || !currentSession.isActive || currentSession.website !== website) {
      // If there's an existing active session, update stats with it first
      if (currentSession && currentSession.isActive) {
        await storage.updateStatsWithSession(currentSession);
      }
      
      // Create a new session
      const newSession = {
        startTime: Date.now(),
        website: website,
        url: tab.url,
        title: tab.title || website,
        isActive: true
      };
      
      await storage.saveCurrentSession(newSession);
      console.log(`Started tracking: ${website}`);
      
      // Update stats right away to record one visit
      await incrementVisitCount(website);
    }
  } catch (error) {
    console.error('Error updating active session:', error);
  }
}

// Pause the current session
async function pauseCurrentSession() {
  try {
    // Get the storage module
    const storage = getStorageModule();
    if (!storage) {
      console.error('Storage module not available');
      return;
    }
    
    const currentSession = await storage.getCurrentSession();
    
    if (currentSession && currentSession.isActive) {
      // Update stats with session before pausing
      await storage.updateStatsWithSession(currentSession);
      
      // Mark session as inactive
      currentSession.isActive = false;
      await storage.saveCurrentSession(currentSession);
      console.log(`Paused tracking: ${currentSession.website}`);
    }
  } catch (error) {
    console.error('Error pausing session:', error);
  }
}

// Update current session stats
async function updateCurrentSession() {
  try {
    // Get the storage module
    const storage = getStorageModule();
    if (!storage) {
      console.error('Storage module not available');
      return;
    }
    
    const currentSession = await storage.getCurrentSession();
    
    if (currentSession && currentSession.isActive) {
      await storage.updateStatsWithSession(currentSession);
    }
  } catch (error) {
    console.error('Error updating current session:', error);
  }
}

// Get storage module safely
function getStorageModule() {
  try {
    // In background script, we can't use window
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      // Try to access global storage module directly
      if (typeof HabitHubStorage !== 'undefined') {
        return HabitHubStorage;
      }
      
      // Try to get from background page (not available in service workers)
      if (chrome.runtime.getBackgroundPage) {
        const bgPage = chrome.runtime.getBackgroundPage();
        if (bgPage && bgPage.HabitHubStorage) {
          return bgPage.HabitHubStorage;
        }
      }
    }
    
    // Fallback to direct storage operations
    return createFallbackStorageModule();
  } catch (error) {
    console.error('Error getting storage module:', error);
    return createFallbackStorageModule();
  }
}

// Create a fallback storage module that uses chrome.storage directly
function createFallbackStorageModule() {
  return {
    // Initialize storage with default values
    init: async function() {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get('habithub_settings', (data) => {
          if (!data.habithub_settings) {
            chrome.storage.local.set({ 'habithub_settings': DEFAULT_SETTINGS }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          } else {
            resolve();
          }
        });
      });
    },
    
    // Get current session
    getCurrentSession: async function() {
      return new Promise((resolve) => {
        chrome.storage.local.get('current_session', (data) => {
          resolve(data.current_session || null);
        });
      });
    },
    
    // Save current session
    saveCurrentSession: async function(session) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ 'current_session': session }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    },
    
    // Update stats with current session
    updateStatsWithSession: async function(session) {
      if (!session || !session.website || !session.startTime) {
        return Promise.resolve();
      }
      
      const now = Date.now();
      const duration = Math.floor((now - session.startTime) / 1000); // seconds
      
      if (duration <= 0) {
        return Promise.resolve();
      }
      
      // Create date string (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0];
      
      return new Promise((resolve, reject) => {
        chrome.storage.local.get('habithub_stats', (data) => {
          const stats = data.habithub_stats || {};
          
          // Initialize today's stats if needed
          if (!stats[today]) {
            stats[today] = {
              date: today,
              totalTime: 0,
              websites: {}
            };
          }
          
          // Initialize website stats if needed
          if (!stats[today].websites[session.website]) {
            stats[today].websites[session.website] = {
              totalTime: 0,
              visits: 0
            };
          }
          
          // Update time spent
          stats[today].websites[session.website].totalTime += duration;
          stats[today].totalTime += duration;
          
          // Save updated stats
          chrome.storage.local.set({ 'habithub_stats': stats }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              // Also update the session start time
              session.startTime = now;
              chrome.storage.local.set({ 'current_session': session }, () => {
                resolve();
              });
            }
          });
        });
      });
    },
    
    // Get stats for a specific day
    getStats: async function(date) {
      return new Promise((resolve) => {
        chrome.storage.local.get('habithub_stats', (data) => {
          const stats = data.habithub_stats || {};
          resolve(stats[date] || null);
        });
      });
    },
    
    // Save stats for a specific day
    saveStats: async function(date, dayStats) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get('habithub_stats', (data) => {
          const stats = data.habithub_stats || {};
          stats[date] = dayStats;
          
          chrome.storage.local.set({ 'habithub_stats': stats }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      });
    },
    
    // Get settings
    getSettings: async function() {
      return new Promise((resolve) => {
        chrome.storage.local.get('habithub_settings', (data) => {
          resolve(data.habithub_settings || DEFAULT_SETTINGS);
        });
      });
    },
    
    // Save settings
    saveSettings: async function(settings) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ 'habithub_settings': settings }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    },
    
    // Get goals
    getGoals: async function() {
      return new Promise((resolve) => {
        chrome.storage.local.get('habithub_goals', (data) => {
          resolve(data.habithub_goals || []);
        });
      });
    },
    
    // Save goals
    saveGoals: async function(goals) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ 'habithub_goals': goals }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    },
    
    // Clear old data
    clearOldData: async function() {
      return new Promise(async (resolve) => {
        try {
          // Get settings for data retention
          const settings = await this.getSettings();
          const retentionDays = settings.dataRetention || 30;
          
          // Calculate cutoff date
          const now = new Date();
          now.setDate(now.getDate() - retentionDays);
          const cutoffDate = now.toISOString().split('T')[0];
          
          // Get current stats
          chrome.storage.local.get('habithub_stats', (data) => {
            if (!data.habithub_stats) {
              resolve();
              return;
            }
            
            const stats = data.habithub_stats;
            let modified = false;
            
            // Remove stats older than cutoff date
            for (const date in stats) {
              if (date < cutoffDate) {
                delete stats[date];
                modified = true;
              }
            }
            
            // Save updated stats if changed
            if (modified) {
              chrome.storage.local.set({ 'habithub_stats': stats }, () => {
                resolve();
              });
            } else {
              resolve();
            }
          });
        } catch (error) {
          console.error('Error clearing old data:', error);
          resolve();
        }
      });
    }
  };
}

// Increment visit count for a website
async function incrementVisitCount(website) {
  try {
    // Get the storage module
    const storage = getStorageModule();
    if (!storage) {
      console.error('Storage module not available');
      return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    let stats = await storage.getStats(today);
    
    // Initialize stats if not exists
    if (!stats) {
      stats = {
        date: today,
        totalTime: 0,
        websites: {}
      };
    }
    
    // Initialize website stats if not exists
    if (!stats.websites[website]) {
      stats.websites[website] = {
        totalTime: 0,
        visits: 0
      };
    }
    
    // Increment visit count
    stats.websites[website].visits += 1;
    
    // Save updated stats
    await storage.saveStats(today, stats);
  } catch (error) {
    console.error('Error incrementing visit count:', error);
  }
}

// Check if URL should be tracked (excludes chrome:// pages, etc.)
function isTrackableUrl(url) {
  if (!url) return false;
  
  return url.startsWith('http') && 
         !url.startsWith('chrome://') && 
         !url.startsWith('chrome-extension://') &&
         !url.startsWith('chrome-devtools://') &&
         !url.startsWith('about:') &&
         !url.startsWith('file://');
}

// Handle alarm (periodic updates)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'updateStats') {
    try {
      // Update stats for the current session
      await updateCurrentSession();
      
      // Check for goal notifications
      await checkGoalNotifications();
      
      // Clear old data periodically
      if (Math.random() < 0.1) { // Approximately once every 10 alarms (10 minutes)
        const storage = getStorageModule();
        if (storage) {
          await storage.clearOldData();
        }
      }
    } catch (error) {
      console.error('Error handling alarm:', error);
    }
  }
});

// Check goals and send notifications if needed
async function checkGoalNotifications() {
  try {
    // Get the storage module
    const storage = getStorageModule();
    if (!storage) {
      console.error('Storage module not available');
      return;
    }
    
    // Get settings
    const settings = await storage.getSettings();
    
    // Skip if notifications are disabled
    if (!settings || !settings.notifications) {
      return;
    }
    
    // Only check every X minutes based on settings
    const now = Date.now();
    const lastCheck = settings.lastNotificationCheck || 0;
    const checkInterval = settings.notificationFrequency * 60 * 1000; // Convert minutes to ms
    
    if (now - lastCheck < checkInterval) {
      return;
    }
    
    // Update last check time
    settings.lastNotificationCheck = now;
    await storage.saveSettings(settings);
    
    // Get goals and today's stats
    const goals = await storage.getGoals();
    const today = new Date().toISOString().split('T')[0];
    const stats = await storage.getStats(today);
    
    if (!goals || !stats) {
      return;
    }
    
    // Check each active goal
    for (const goal of goals.filter(g => g.active)) {
      const website = goal.website;
      const websiteStats = stats.websites[website];
      
      if (!websiteStats) continue;
      
      const currentValue = goal.type === 'limit' 
        ? websiteStats.totalTime / 60 // Convert seconds to minutes
        : websiteStats.visits;
      
      const targetValue = goal.value;
      const progress = (currentValue / targetValue) * 100;
      
      // Notify if exceeding limit or close to it
      if (progress >= 100 && !goal.notifiedExceeded) {
        showNotification(
          'Goal Exceeded',
          `You've exceeded your ${goal.type === 'limit' ? 'time' : 'visit'} limit for ${website}`
        );
        
        // Mark as notified
        goal.notifiedExceeded = true;
        await storage.saveGoals(goals);
        
      } else if (progress >= 90 && !goal.notifiedWarning) {
        showNotification(
          'Goal Warning',
          `You're approaching your ${goal.type === 'limit' ? 'time' : 'visit'} limit for ${website}`
        );
        
        // Mark as notified
        goal.notifiedWarning = true;
        await storage.saveGoals(goals);
      }
    }
  } catch (error) {
    console.error('Error checking goal notifications:', error);
  }
}

// Show a notification
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message
  });
}

// Reset notification flags at midnight
function resetNotificationFlags() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  
  const timeUntilMidnight = midnight - now;
  
  setTimeout(async () => {
    try {
      // Get the storage module
      const storage = getStorageModule();
      if (!storage) {
        console.error('Storage module not available');
        return;
      }
      
      // Reset notification flags on goals
      const goals = await storage.getGoals();
      
      if (goals && goals.length > 0) {
        const updatedGoals = goals.map(goal => {
          goal.notifiedWarning = false;
          goal.notifiedExceeded = false;
          return goal;
        });
        
        await storage.saveGoals(updatedGoals);
      }
      
      // Set the next reset
      resetNotificationFlags();
    } catch (error) {
      console.error('Error resetting notification flags:', error);
    }
  }, timeUntilMidnight);
}

// Start the reset notification flags cycle
resetNotificationFlags();

// Setup messaging between popup and background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getStats') {
    // Update current session before sending stats
    updateCurrentSession().then(() => {
      getStats().then(sendResponse);
    });
    return true; // Indicates we will send response asynchronously
  } else if (message.type === 'updateSettings') {
    updateSettings(message.settings).then(sendResponse);
    return true;
  } else if (message.type === 'clearData') {
    clearAllData().then(sendResponse);
    return true;
  }
});

// Handle a tab change - ends previous session and starts a new one
async function handleTabChange(tab) {
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    // Don't track chrome internal pages
    await endCurrentSession();
    return;
  }
  
  // End previous tracking session if there is one
  await endCurrentSession();
  
  // Start tracking the new tab
  activeTab = tab;
  startTime = Date.now();
  startNewSession(tab);
}

// Start tracking a new URL
function startNewSession(tab) {
  currentSession = {
    url: tab.url,
    startTime: Date.now(),
    tabId: tab.id,
    title: tab.title
  };
}

// Record a website visit in storage
async function recordVisit(tab, start, end, duration) {
  try {
    const url = new URL(tab.url);
    const domain = url.hostname;
    const category = await getDomainCategory(domain);
    const date = new Date(start).toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Get existing data
    const { visits = [], timeByDomain = {}, timeByCategory = {} } = await chrome.storage.local.get(['visits', 'timeByDomain', 'timeByCategory']);
    
    // Add new visit
    const visit = {
      id: Date.now().toString(),
      url: tab.url,
      domain,
      title: tab.title || domain,
      category,
      start,
      end,
      duration
    };
    
    visits.push(visit);
    
    // Update domain stats
    if (!timeByDomain[domain]) {
      timeByDomain[domain] = {};
    }
    if (!timeByDomain[domain][date]) {
      timeByDomain[domain][date] = 0;
    }
    timeByDomain[domain][date] += duration;
    
    // Update category stats
    if (!timeByCategory[category]) {
      timeByCategory[category] = {};
    }
    if (!timeByCategory[category][date]) {
      timeByCategory[category][date] = 0;
    }
    timeByCategory[category][date] += duration;
    
    // Save updated data
    await chrome.storage.local.set({ visits, timeByDomain, timeByCategory });
    
    // Also record using storage API directly instead of using HabitHubStorage
    const session = {
      url: tab.url,
      title: tab.title || domain,
      duration: Math.round(duration / 1000), // Convert ms to seconds
      date: date,
      timestamp: Date.now(),
      visits: 1
    };
    
    // Directly create/update session in storage
    chrome.storage.local.get('sessions', function(data) {
      const sessions = data.sessions || [];
      
      // Check if we already have a session for this URL today
      const existingIndex = sessions.findIndex(s => 
        s.url === url.href && s.date === date
      );
      
      if (existingIndex >= 0) {
        // Update existing session
        sessions[existingIndex].duration += Math.round(duration / 1000);
        sessions[existingIndex].visits += 1;
      } else {
        // Add new session
        sessions.push(session);
      }
      
      // Save updated sessions
      chrome.storage.local.set({ sessions: sessions });
    });
    
  } catch (error) {
    console.error('Error recording visit:', error);
  }
}

// Record a browsing session
function recordSession(url, durationSeconds, title) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const session = {
      url: url,
      title: title || url,
      duration: durationSeconds,
      date: today,
      timestamp: Date.now(),
      visits: 1
    };
    
    // Save directly to storage
    chrome.storage.local.get('sessions', function(data) {
      const sessions = data.sessions || [];
      
      // Check if we already have a session for this URL today
      const existingIndex = sessions.findIndex(s => 
        s.url === url && s.date === today
      );
      
      if (existingIndex >= 0) {
        // Update existing session
        sessions[existingIndex].duration += durationSeconds;
        sessions[existingIndex].visits += 1;
      } else {
        // Add new session
        sessions.push(session);
      }
      
      // Save updated sessions
      chrome.storage.local.set({ sessions: sessions });
    });
  } catch (error) {
    console.error('Error recording session:', error);
  }
}

// Simple domain categorization (in a real extension, this could be more sophisticated)
async function getDomainCategory(domain) {
  // Basic categories based on domain patterns
  const categories = {
    'social': ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'pinterest.com', 'reddit.com', 'tiktok.com', 'snapchat.com'],
    'productivity': ['github.com', 'gitlab.com', 'slack.com', 'trello.com', 'asana.com', 'notion.so', 'docs.google.com', 'office.com'],
    'entertainment': ['youtube.com', 'netflix.com', 'twitch.tv', 'spotify.com', 'hulu.com', 'disneyplus.com', 'primevideo.com'],
    'shopping': ['amazon.com', 'ebay.com', 'walmart.com', 'target.com', 'bestbuy.com', 'etsy.com', 'aliexpress.com'],
    'news': ['cnn.com', 'nytimes.com', 'bbc.com', 'wsj.com', 'reuters.com', 'bloomberg.com', 'apnews.com'],
    'education': ['udemy.com', 'coursera.org', 'edx.org', 'khanacademy.org', 'wikipedia.org', 'stackoverflow.com', 'medium.com'],
  };
  
  // Check if the domain matches any category
  for (const [category, domains] of Object.entries(categories)) {
    if (domains.some(d => domain.includes(d))) {
      return category;
    }
  }
  
  // Check for custom categories from storage
  const { customCategories = {} } = await chrome.storage.local.get('customCategories');
  for (const [category, domains] of Object.entries(customCategories)) {
    if (domains.some(d => domain.includes(d))) {
      return category;
    }
  }
  
  return 'other';
}

// Set up alarm for checking goals
async function setupGoalCheckAlarm() {
  // Clear existing alarm
  await chrome.alarms.clear(ALARM_CHECK_GOALS);
  
  // Get notification frequency from settings
  const { settings } = await chrome.storage.local.get('settings');
  if (settings && settings.enableNotifications) {
    const minutes = settings.notificationFrequency || 15;
    chrome.alarms.create(ALARM_CHECK_GOALS, {
      periodInMinutes: minutes
    });
  }
}

// Check goals and send notification if needed
async function checkAndNotifyGoals() {
  const { goals = [], settings } = await chrome.storage.local.get(['goals', 'settings']);
  
  if (!settings || !settings.enableNotifications || goals.length === 0) return;
  
  const today = new Date().toISOString().split('T')[0];
  const { timeByDomain = {}, timeByCategory = {} } = await chrome.storage.local.get(['timeByDomain', 'timeByCategory']);
  
  for (const goal of goals) {
    if (!goal.active) continue;
    
    let currentValue = 0;
    
    if (goal.type === 'limit') {
      // Time limit goal
      if (goal.targetType === 'domain') {
        currentValue = (timeByDomain[goal.target] && timeByDomain[goal.target][today]) 
          ? timeByDomain[goal.target][today] / 60000 // Convert ms to minutes
          : 0;
      } else if (goal.targetType === 'category') {
        currentValue = (timeByCategory[goal.target] && timeByCategory[goal.target][today]) 
          ? timeByCategory[goal.target][today] / 60000
          : 0;
      }
      
      // Check if we're approaching the limit (80% or more)
      if (currentValue >= goal.limit * 0.8 && currentValue < goal.limit) {
        sendNotification(
          'Approaching Limit',
          `You've spent ${Math.round(currentValue)} minutes on ${goal.target} (limit: ${goal.limit} min)`
        );
      } 
      // Check if we've exceeded the limit
      else if (currentValue >= goal.limit) {
        sendNotification(
          'Limit Exceeded',
          `You've spent ${Math.round(currentValue)} minutes on ${goal.target} (limit: ${goal.limit} min)`
        );
      }
    }
  }
}

// Send a browser notification
function sendNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message
  });
}

// Update extension settings
async function updateSettings(newSettings) {
  await chrome.storage.local.set({ settings: newSettings });
  
  // Update alarms based on new settings
  await setupGoalCheckAlarm();
  
  return { success: true };
}

// Clean up old data based on retention policy
async function cleanupOldData() {
  const { settings, visits = [] } = await chrome.storage.local.get(['settings', 'visits']);
  if (!settings || !visits.length) return;
  
  const retentionDays = settings.dataRetention || 30;
  const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  
  // Filter out old visits
  const newVisits = visits.filter(visit => visit.start >= cutoffTime);
  
  // Only update if we actually removed something
  if (newVisits.length < visits.length) {
    // Recalculate time stats based on remaining visits
    const timeByDomain = {};
    const timeByCategory = {};
    
    for (const visit of newVisits) {
      const date = new Date(visit.start).toISOString().split('T')[0];
      
      // Update domain stats
      if (!timeByDomain[visit.domain]) {
        timeByDomain[visit.domain] = {};
      }
      if (!timeByDomain[visit.domain][date]) {
        timeByDomain[visit.domain][date] = 0;
      }
      timeByDomain[visit.domain][date] += visit.duration;
      
      // Update category stats
      if (!timeByCategory[visit.category]) {
        timeByCategory[visit.category] = {};
      }
      if (!timeByCategory[visit.category][date]) {
        timeByCategory[visit.category][date] = 0;
      }
      timeByCategory[visit.category][date] += visit.duration;
    }
    
    await chrome.storage.local.set({ visits: newVisits, timeByDomain, timeByCategory });
  }
}

// Clear all tracking data
async function clearAllData() {
  await chrome.storage.local.remove(['visits', 'timeByDomain', 'timeByCategory', 'sessions']);
  
  // Keep settings and goals
  return { success: true };
}

// Get stats for popup
async function getStats() {
  // First update the current session if there is one
  await updateCurrentSession();
  
  const { visits = [], goals = [], timeByDomain = {}, timeByCategory = {} } = 
    await chrome.storage.local.get(['visits', 'goals', 'timeByDomain', 'timeByCategory']);
  
  const today = new Date().toISOString().split('T')[0];
  
  // Calculate today's total time
  let todayTotal = 0;
  Object.values(timeByCategory).forEach(categoryData => {
    if (categoryData[today]) {
      todayTotal += categoryData[today];
    }
  });
  
  // Get today's top domains
  const todayDomains = [];
  for (const [domain, dates] of Object.entries(timeByDomain)) {
    if (dates[today]) {
      todayDomains.push({
        domain,
        time: dates[today],
        minutes: Math.round(dates[today] / 60000) // ms to minutes
      });
    }
  }
  
  // Sort by time spent (descending)
  todayDomains.sort((a, b) => b.time - a.time);
  
  // Get category data for charts
  const categoryData = {};
  for (const [category, dates] of Object.entries(timeByCategory)) {
    if (dates[today]) {
      categoryData[category] = dates[today];
    }
  }
  
  // Get weekly data (last 7 days)
  const weeklyData = {};
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    
    let dailyTotal = 0;
    Object.values(timeByCategory).forEach(categoryData => {
      if (categoryData[dateString]) {
        dailyTotal += categoryData[dateString];
      }
    });
    
    weeklyData[dateString] = dailyTotal;
  }
  
  // Check goal progress
  const goalProgress = [];
  for (const goal of goals) {
    if (!goal.active) continue;
    
    let currentValue = 0;
    
    if (goal.type === 'limit') {
      if (goal.targetType === 'domain') {
        currentValue = (timeByDomain[goal.target] && timeByDomain[goal.target][today]) 
          ? timeByDomain[goal.target][today] / 60000 // Convert ms to minutes
          : 0;
      } else if (goal.targetType === 'category') {
        currentValue = (timeByCategory[goal.target] && timeByCategory[goal.target][today]) 
          ? timeByCategory[goal.target][today] / 60000
          : 0;
      }
    }
    
    // Calculate progress as percentage of limit
    const percent = goal.limit > 0 ? (currentValue / goal.limit) * 100 : 0;
    
    goalProgress.push({
      id: goal.id,
      target: goal.target,
      limit: goal.limit,
      current: Math.round(currentValue),
      percent: Math.min(100, Math.round(percent)),
      status: percent < 80 ? 'under' : percent < 100 ? 'near' : 'over'
    });
  }
  
  return {
    todayTotal: Math.round(todayTotal / 60000), // ms to minutes
    todayDomains,
    categoryData,
    weeklyData,
    goalProgress
  };
}

// Add this function to fix the missing reference
async function endCurrentSession() {
  try {
    // Get current session
    const data = await new Promise(resolve => {
      chrome.storage.local.get('current_session', resolve);
    });
    
    const currentSession = data.current_session;
    
    if (currentSession && currentSession.startTime) {
      const now = Date.now();
      const domain = new URL(currentSession.url).hostname;
      
      // Calculate duration
      const duration = Math.floor((now - currentSession.startTime) / 1000); // in seconds
      
      if (duration > 1) { // Only track sessions longer than 1 second
        // Create a session record
        const session = {
          url: currentSession.url,
          domain: domain,
          date: new Date(currentSession.startTime).toISOString().split('T')[0],
          duration: duration,
          visits: 1
        };
        
        // Save this session
        await saveSession(session);
      }
      
      // Clear current session
      chrome.storage.local.set({ 'current_session': null });
    }
  } catch (error) {
    console.error('Error ending current session:', error);
  }
}

// Clear old alarm and create a new one
async function clearAndCreateAlarm() {
  // Clear any existing alarms
  await new Promise(resolve => {
    chrome.alarms.clearAll(() => resolve());
  });
  
  // Create a new alarm that fires every minute
  chrome.alarms.create('updateStats', { periodInMinutes: 1 });
  console.log('Created alarm: updateStats (every 1 minute)');
}

// Save a session to storage
async function saveSession(session) {
  return new Promise((resolve, reject) => {
    try {
      // Get all sessions
      chrome.storage.local.get('habithub_sessions', (data) => {
        const sessions = data.habithub_sessions || [];
        
        // Check if this is a new session or updating an existing one
        const existingIndex = sessions.findIndex(s => 
          s.url === session.url && 
          s.date === session.date
        );
        
        if (existingIndex >= 0) {
          // Update existing session
          sessions[existingIndex].duration += session.duration;
          sessions[existingIndex].visits += 1;
          sessions[existingIndex].lastUpdated = Date.now();
        } else {
          // Add new session
          session.lastUpdated = Date.now();
          sessions.push(session);
        }
        
        // Save sessions
        chrome.storage.local.set({ 'habithub_sessions': sessions }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(sessions);
          }
        });
      });
    } catch (error) {
      reject(error);
    }
  });
} 