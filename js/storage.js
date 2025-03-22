/**
 * HabitHub Storage Module
 * Handles all storage operations for the extension
 */

// Storage keys
const KEYS = {
  SETTINGS: 'habithub_settings',
  GOALS: 'habithub_goals',
  STATS: 'habithub_stats',
  CURRENT_SESSION: 'current_session',
  SESSIONS: 'habithub_sessions'
};

// Default settings
const DEFAULT_SETTINGS = {
  notifications: true,
  notificationFrequency: 15, // minutes
  dataRetention: 30, // days
  lastNotificationCheck: 0
};

// HabitHub Storage Module
const HabitHubStorage = {
  /**
   * Initialize storage with default values
   */
  init: async function() {
    try {
      // Check if settings exist, create default if not
      const settings = await this.getSettings();
      if (!settings) {
        await this.saveSettings(DEFAULT_SETTINGS);
        console.log('HabitHub: Storage initialized with default settings');
      }
      
      return true;
    } catch (error) {
      console.error('HabitHub: Error initializing storage', error);
      return false;
    }
  },
  
  /**
   * Get current settings
   * @returns {Promise<Object>} Settings object
   */
  getSettings: function() {
    return new Promise((resolve) => {
      chrome.storage.local.get(KEYS.SETTINGS, (data) => {
        resolve(data[KEYS.SETTINGS] || null);
      });
    });
  },
  
  /**
   * Save settings
   * @param {Object} settings - Settings object
   * @returns {Promise<boolean>} Success status
   */
  saveSettings: function(settings) {
    return new Promise((resolve, reject) => {
      const data = {};
      data[KEYS.SETTINGS] = settings;
      
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(true);
        }
      });
    });
  },
  
  /**
   * Get user goals
   * @returns {Promise<Array>} Goals array
   */
  getGoals: function() {
    return new Promise((resolve) => {
      chrome.storage.local.get(KEYS.GOALS, (data) => {
        resolve(data[KEYS.GOALS] || []);
      });
    });
  },
  
  /**
   * Save user goals
   * @param {Array} goals - Goals array
   * @returns {Promise<boolean>} Success status
   */
  saveGoals: function(goals) {
    return new Promise((resolve, reject) => {
      const data = {};
      data[KEYS.GOALS] = goals;
      
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(true);
        }
      });
    });
  },
  
  /**
   * Add a new goal
   * @param {Object} goal - Goal object
   * @returns {Promise<Array>} Updated goals array
   */
  addGoal: async function(goal) {
    try {
      const goals = await this.getGoals();
      
      // Generate a unique ID for the goal
      goal.id = Date.now().toString();
      
      // Set default values if not provided
      if (goal.active === undefined) goal.active = true;
      if (goal.notifiedWarning === undefined) goal.notifiedWarning = false;
      if (goal.notifiedExceeded === undefined) goal.notifiedExceeded = false;
      
      // Add to goals array
      goals.push(goal);
      
      // Save updated goals
      await this.saveGoals(goals);
      
      return goals;
    } catch (error) {
      console.error('Error adding goal:', error);
      throw error;
    }
  },
  
  /**
   * Update an existing goal
   * @param {Object} goal - Goal object with id
   * @returns {Promise<Array>} Updated goals array
   */
  updateGoal: async function(goal) {
    try {
      if (!goal.id) {
        throw new Error('Goal ID is required');
      }
      
      const goals = await this.getGoals();
      const index = goals.findIndex(g => g.id === goal.id);
      
      if (index === -1) {
        throw new Error('Goal not found');
      }
      
      // Update goal
      goals[index] = { ...goals[index], ...goal };
      
      // Save updated goals
      await this.saveGoals(goals);
      
      return goals;
    } catch (error) {
      console.error('Error updating goal:', error);
      throw error;
    }
  },
  
  /**
   * Delete a goal
   * @param {string} goalId - Goal ID
   * @returns {Promise<Array>} Updated goals array
   */
  deleteGoal: async function(goalId) {
    try {
      const goals = await this.getGoals();
      const updatedGoals = goals.filter(goal => goal.id !== goalId);
      
      // Save updated goals
      await this.saveGoals(updatedGoals);
      
      return updatedGoals;
    } catch (error) {
      console.error('Error deleting goal:', error);
      throw error;
    }
  },
  
  /**
   * Get current tracking session
   * @returns {Promise<Object|null>} Current session object or null
   */
  getCurrentSession: function() {
    return new Promise((resolve) => {
      chrome.storage.local.get(KEYS.CURRENT_SESSION, (data) => {
        resolve(data[KEYS.CURRENT_SESSION] || null);
      });
    });
  },
  
  /**
   * Save current tracking session
   * @param {Object} session - Session object
   * @returns {Promise<boolean>} Success status
   */
  saveCurrentSession: function(session) {
    return new Promise((resolve, reject) => {
      const data = {};
      data[KEYS.CURRENT_SESSION] = session;
      
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(true);
        }
      });
    });
  },
  
  /**
   * Update stats with current session data
   * @param {Object} session - Session object
   * @returns {Promise<boolean>} Success status
   */
  updateStatsWithSession: async function(session) {
    try {
      if (!session || !session.website || !session.startTime) {
        return false;
      }
      
      const now = Date.now();
      const duration = Math.floor((now - session.startTime) / 1000); // seconds
      
      if (duration <= 0) {
        return false;
      }
      
      // Create date string (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0];
      
      // Get today's stats
      let stats = await this.getStats(today);
      
      // Initialize stats if not exists
      if (!stats) {
        stats = {
          date: today,
          totalTime: 0,
          websites: {}
        };
      }
      
      // Initialize website stats if not exists
      if (!stats.websites[session.website]) {
        stats.websites[session.website] = {
          totalTime: 0,
          visits: 0
        };
      }
      
      // Update time spent
      stats.websites[session.website].totalTime += duration;
      stats.totalTime += duration;
      
      // Save updated stats
      await this.saveStats(today, stats);
      
      // Update session start time to now
      session.startTime = now;
      await this.saveCurrentSession(session);
      
      return true;
    } catch (error) {
      console.error('Error updating stats with session:', error);
      return false;
    }
  },
  
  /**
   * Get stats for a specific day
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Promise<Object|null>} Stats for the date or null
   */
  getStats: function(date) {
    return new Promise((resolve) => {
      chrome.storage.local.get(KEYS.STATS, (data) => {
        const allStats = data[KEYS.STATS] || {};
        resolve(allStats[date] || null);
      });
    });
  },
  
  /**
   * Get all stats
   * @returns {Promise<Object>} All stats
   */
  getAllStats: function() {
    return new Promise((resolve) => {
      chrome.storage.local.get(KEYS.STATS, (data) => {
        resolve(data[KEYS.STATS] || {});
      });
    });
  },
  
  /**
   * Save stats for a specific day
   * @param {string} date - Date string (YYYY-MM-DD)
   * @param {Object} dayStats - Stats for the day
   * @returns {Promise<boolean>} Success status
   */
  saveStats: function(date, dayStats) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(KEYS.STATS, (data) => {
        const allStats = data[KEYS.STATS] || {};
        allStats[date] = dayStats;
        
        const saveData = {};
        saveData[KEYS.STATS] = allStats;
        
        chrome.storage.local.set(saveData, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(true);
          }
        });
      });
    });
  },
  
  /**
   * Get weekly stats (last 7 days)
   * @returns {Promise<Array>} Weekly stats array
   */
  getWeeklyStats: async function() {
    try {
      const allStats = await this.getAllStats();
      const result = [];
      
      // Get dates for the last 7 days
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        // Get stats for this date
        const dayStats = allStats[dateString] || {
          date: dateString,
          totalTime: 0,
          websites: {}
        };
        
        result.unshift({
          date: dateString,
          totalTime: dayStats.totalTime || 0
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error getting weekly stats:', error);
      return [];
    }
  },
  
  /**
   * Get category data for charts
   * @returns {Promise<Array>} Category data array
   */
  getCategoryData: async function() {
    try {
      // Get today's date
      const today = new Date().toISOString().split('T')[0];
      
      // Get today's stats
      const stats = await this.getStats(today);
      
      if (!stats || !stats.websites) {
        return [];
      }
      
      // Create category map
      const categoryMap = {
        'social': ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'reddit.com'],
        'productivity': ['github.com', 'stackoverflow.com', 'docs.google.com', 'slack.com'],
        'entertainment': ['youtube.com', 'netflix.com', 'twitch.tv', 'spotify.com'],
        'shopping': ['amazon.com', 'ebay.com', 'walmart.com', 'etsy.com'],
        'news': ['cnn.com', 'bbc.com', 'nytimes.com', 'theguardian.com']
      };
      
      // Initialize category totals
      const categoryTotals = {};
      
      // Categorize websites
      for (const [website, data] of Object.entries(stats.websites)) {
        let category = 'other';
        
        // Check if website matches any category
        for (const [cat, domains] of Object.entries(categoryMap)) {
          if (domains.some(domain => website.includes(domain))) {
            category = cat;
            break;
          }
        }
        
        // Add to category total
        if (!categoryTotals[category]) {
          categoryTotals[category] = 0;
        }
        categoryTotals[category] += data.totalTime / 60; // Convert seconds to minutes
      }
      
      // Convert to array format
      const result = [];
      for (const [category, time] of Object.entries(categoryTotals)) {
        result.push({
          category: category.charAt(0).toUpperCase() + category.slice(1), // Capitalize
          time: Math.round(time)
        });
      }
      
      // Sort by time (descending)
      result.sort((a, b) => b.time - a.time);
      
      return result;
    } catch (error) {
      console.error('Error getting category data:', error);
      return [];
    }
  },
  
  /**
   * Clear old data based on retention policy
   * @returns {Promise<boolean>} Success status
   */
  clearOldData: async function() {
    try {
      // Get settings for data retention
      const settings = await this.getSettings();
      const retentionDays = settings.dataRetention || 30;
      
      // Calculate cutoff date
      const now = new Date();
      now.setDate(now.getDate() - retentionDays);
      const cutoffDate = now.toISOString().split('T')[0];
      
      // Get all stats
      const allStats = await this.getAllStats();
      let modified = false;
      
      // Remove stats older than cutoff date
      for (const date in allStats) {
        if (date < cutoffDate) {
          delete allStats[date];
          modified = true;
        }
      }
      
      // Save updated stats if changed
      if (modified) {
        const saveData = {};
        saveData[KEYS.STATS] = allStats;
        
        await new Promise((resolve, reject) => {
          chrome.storage.local.set(saveData, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(true);
            }
          });
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error clearing old data:', error);
      return false;
    }
  }
};

// Make it available globally (for background script)
try {
  if (typeof globalThis !== 'undefined') {
    globalThis.HabitHubStorage = HabitHubStorage;
  }
} catch (e) {
  console.error('Error exporting HabitHubStorage to global scope', e);
}

// Make it available to anything that includes this script
try {
  if (typeof self !== 'undefined') {
    self.HabitHubStorage = HabitHubStorage;
  }
} catch (e) {
  console.error('Error exporting HabitHubStorage to self', e);
} 