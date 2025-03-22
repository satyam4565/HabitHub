/**
 * Main popup script for HabitHub extension
 */

// DOM elements
let dashboardTab, habitsTab, goalsTab, settingsTab;
let addGoalBtn, goalForm, goalFormSubmit, goalFormCancel;
let goalsContainer, habitsList, refreshBtn;
let progressToday, timeToday, alertContainer;
let loadingOverlay, emptyGoalsMessage;
let categoryChartContainer, weeklyChartContainer;

// State
let currentTab = 'dashboard';
let autoRefreshInterval = null;

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
  // Initialize DOM elements
  initializeDOMElements();
  
  // Show loading state
  showLoading();
  
  // Initialize tabs
  setupTabs();
  
  // Load initial data
  init().catch(error => {
    console.error('Error initializing popup:', error);
    showError('Error loading data. Please try again.');
  }).finally(() => {
    hideLoading();
  });
  
  // Set up event listeners
  setupEventListeners();
  
  // Start auto-refresh
  setupAutoRefresh();
});

// Initialize DOM elements
function initializeDOMElements() {
  // Tab elements
  dashboardTab = document.getElementById('dashboard-tab');
  habitsTab = document.getElementById('habits-tab');
  goalsTab = document.getElementById('goals-tab');
  settingsTab = document.getElementById('settings-tab');
  
  // Goal form elements
  addGoalBtn = document.getElementById('add-goal-btn');
  goalForm = document.getElementById('goal-form');
  goalFormSubmit = document.getElementById('goal-form-submit');
  goalFormCancel = document.getElementById('goal-form-cancel');
  
  // Container elements
  goalsContainer = document.getElementById('goals-container');
  habitsList = document.getElementById('habits-list');
  refreshBtn = document.getElementById('refresh-btn');
  
  // Dashboard elements
  progressToday = document.getElementById('progress-today');
  timeToday = document.getElementById('time-today');
  alertContainer = document.getElementById('alert-container');
  
  // Chart containers
  categoryChartContainer = document.getElementById('category-chart-container');
  weeklyChartContainer = document.getElementById('weekly-chart-container');
  
  // UI elements
  loadingOverlay = document.getElementById('loading-overlay');
  emptyGoalsMessage = document.getElementById('empty-goals-message');
  
  // Validate required elements
  const requiredElements = [
    { name: 'dashboardTab', element: dashboardTab },
    { name: 'habitsTab', element: habitsTab },
    { name: 'goalsTab', element: goalsTab },
    { name: 'settingsTab', element: settingsTab },
    { name: 'addGoalBtn', element: addGoalBtn },
    { name: 'goalForm', element: goalForm },
    { name: 'goalFormSubmit', element: goalFormSubmit },
    { name: 'goalFormCancel', element: goalFormCancel },
    { name: 'goalsContainer', element: goalsContainer },
    { name: 'habitsList', element: habitsList },
    { name: 'refreshBtn', element: refreshBtn },
    { name: 'progressToday', element: progressToday },
    { name: 'timeToday', element: timeToday },
    { name: 'alertContainer', element: alertContainer },
    { name: 'loadingOverlay', element: loadingOverlay },
    { name: 'emptyGoalsMessage', element: emptyGoalsMessage }
  ];
  
  const missingElements = requiredElements.filter(({ element }) => !element);
  
  if (missingElements.length > 0) {
    console.error('Missing required DOM elements:', missingElements.map(({ name }) => name));
    showError('Error: Some UI elements are missing. Please reload the extension.');
  }
  
  // Direct click handler as fallback
  if (addGoalBtn) {
    addGoalBtn.onclick = function() { 
      alert('Add Goal button clicked!');
      document.getElementById('goal-form').classList.add('visible');
    };
  }
}

// Loading and error handling
function showLoading() {
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  }
}

function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

function showAlert(message, type = 'info') {
  if (!alertContainer) {
    console.error('Alert container not found');
    return;
  }
  
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  
  alertContainer.innerHTML = '';
  alertContainer.appendChild(alert);
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    alert.remove();
  }, 3000);
}

function showError(message) {
  showAlert(message, 'danger');
}

// Tab functionality
function setupTabs() {
  if (!dashboardTab || !habitsTab || !goalsTab || !settingsTab) {
    console.error('Tab elements not found');
    return;
  }

  const tabs = [
    { element: dashboardTab, contentId: 'dashboard-content' },
    { element: habitsTab, contentId: 'habits-content' },
    { element: goalsTab, contentId: 'goals-content' },
    { element: settingsTab, contentId: 'settings-content' }
  ];

  tabs.forEach(tab => {
    tab.element.addEventListener('click', () => {
      // Update tab active state
      tabs.forEach(t => t.element.classList.remove('active'));
      tab.element.classList.add('active');
      
      // Update content visibility
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      const contentElement = document.getElementById(tab.contentId);
      if (contentElement) {
        contentElement.classList.add('active');
        currentTab = tab.contentId.replace('-content', '');
      }
    });
  });
}

// Auto-refresh functionality
function setupAutoRefresh() {
  // Refresh data every minute
  setInterval(function() {
    updateDashboard()
      .then(() => renderHabits())
      .then(() => renderGoals())
      .catch(error => console.error('Auto-refresh error:', error));
  }, 60000);
}

// Dashboard functionality
async function updateDashboard() {
  console.log('Updating dashboard');
  try {
    // Get today's stats
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let stats = {};
    
    try {
      if (typeof HabitHubStorage !== 'undefined') {
        stats = await HabitHubStorage.getStats(todayStr) || { totalTime: 0, websites: {} };
      } else {
        const result = await chrome.storage.local.get(['stats']);
        stats = (result.stats && result.stats[todayStr]) || { totalTime: 0, websites: {} };
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      stats = { totalTime: 0, websites: {} };
    }
    
    // Update time tracked today
    const timeInMinutes = Math.round((stats.totalTime || 0) / 60);
    if (timeToday) {
      timeToday.textContent = timeInMinutes + ' min';
    }
    
    // Get goals
    let goals = [];
    try {
      if (typeof HabitHubStorage !== 'undefined') {
        goals = await HabitHubStorage.getGoals();
      } else {
        const result = await chrome.storage.local.get(['goals']);
        goals = result.goals || [];
      }
    } catch (error) {
      console.error('Error loading goals:', error);
      goals = [];
    }
    
    const activeGoals = goals.filter(goal => goal.active);
    
    // Update progress bar based on goals
    let progressPercent = 0;
    if (activeGoals.length > 0) {
      // Calculate progress as average of all goals' progress
      let totalProgress = 0;
      
      for (const goal of activeGoals) {
        const website = goal.website;
        const websiteTime = (stats.websites[website]?.totalTime || 0);
        const limit = (goal.limit || goal.value) * 60; // convert to seconds
        
        // Progress is percentage of time against limit (capped at 100%)
        const goalProgress = Math.min(100, (websiteTime / limit) * 100);
        totalProgress += goalProgress;
        
        // Add alert if close to or exceeding limit
        if (goalProgress >= 80) {
          const alertType = goalProgress >= 100 ? 'danger' : 'warning';
          const alertMessage = goalProgress >= 100 
            ? `You've exceeded your ${goal.limit || goal.value} min limit for ${website}!`
            : `You're approaching your ${goal.limit || goal.value} min limit for ${website}`;
          
          showAlert(alertMessage, alertType);
        }
      }
      
      progressPercent = Math.round(totalProgress / activeGoals.length);
    }
    
    // Update progress bar and text
    if (progressToday) {
      progressToday.textContent = progressPercent + '%';
      
      const progressContainer = progressToday.closest('.progress-container');
      if (progressContainer) {
        const progressBar = progressContainer.querySelector('.progress-bar');
        if (progressBar) {
          progressBar.style.width = progressPercent + '%';
          
          // Update progress bar color based on progress
          progressBar.className = 'progress-bar';
          if (progressPercent >= 90) {
            progressBar.classList.add('danger');
          } else if (progressPercent >= 75) {
            progressBar.classList.add('warning');
          }
        }
      }
    }
    
    // Update charts
    updateCharts(stats);
    
  } catch (error) {
    console.error('Error updating dashboard:', error);
    showError('Failed to update dashboard.');
  }
}

// Update charts with data from stats
function updateCharts(stats) {
  try {
    // Check if HabitHubStorage is available for category data
    if (typeof HabitHubStorage !== 'undefined' && typeof HabitHubStorage.getCategoryData === 'function') {
      // Use the built-in category data function if available
      HabitHubStorage.getCategoryData()
        .then(categoryData => {
          updateCategoryChart(categoryData);
        })
        .catch(error => {
          console.error('Error getting category data:', error);
          generateCategoryData(stats);
        });
    } else {
      // Otherwise generate it ourselves
      generateCategoryData(stats);
    }
    
    // Get weekly data
    getWeeklyData().then(weeklyData => {
      updateWeeklyChart(weeklyData);
    }).catch(error => {
      console.error('Error getting weekly data:', error);
    });
  } catch (error) {
    console.error('Error updating charts:', error);
  }
}

// Generate category data from stats
function generateCategoryData(stats) {
  try {
    // Prepare category data
    let categoryData = [];
    if (stats && stats.websites) {
      // Group websites by category
      const categories = {
        'Social Media': ['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok', 'reddit'],
        'Entertainment': ['youtube', 'netflix', 'hulu', 'twitch', 'disney', 'spotify'],
        'Productivity': ['github', 'gmail', 'notion', 'trello', 'slack', 'asana'],
        'News': ['cnn', 'nytimes', 'bbc', 'reuters', 'forbes', 'techcrunch'],
        'Shopping': ['amazon', 'ebay', 'etsy', 'walmart', 'target', 'bestbuy']
      };
      
      // Initialize category totals
      const categoryTotals = {
        'Social Media': 0,
        'Entertainment': 0,
        'Productivity': 0,
        'News': 0,
        'Shopping': 0,
        'Other': 0
      };
      
      // Categorize websites
      Object.entries(stats.websites).forEach(([website, data]) => {
        let categorized = false;
        
        for (const [category, sites] of Object.entries(categories)) {
          if (sites.some(site => website.includes(site))) {
            categoryTotals[category] += data.totalTime || 0;
            categorized = true;
            break;
          }
        }
        
        if (!categorized) {
          categoryTotals['Other'] += data.totalTime || 0;
        }
      });
      
      // Convert to minutes and filter out empty categories
      categoryData = Object.entries(categoryTotals)
        .filter(([, time]) => time > 0)
        .map(([category, time]) => ({
          category,
          time: Math.round(time / 60)
        }));
    }
    
    // Update the chart
    updateCategoryChart(categoryData);
  } catch (error) {
    console.error('Error generating category data:', error);
  }
}

// Get weekly data for chart
async function getWeeklyData() {
  try {
    if (typeof HabitHubStorage !== 'undefined') {
      return await HabitHubStorage.getWeeklyStats();
    }
    
    const weekData = [];
    const today = new Date();
    
    // Get stats from storage
    const result = await chrome.storage.local.get(['stats']);
    const stats = result.stats || {};
    
    // Generate data for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayStats = stats[dateStr] || { totalTime: 0 };
      
      weekData.push({
        date: dateStr,
        totalTime: dayStats.totalTime || 0
      });
    }
    
    return weekData;
  } catch (error) {
    console.error('Error getting weekly data:', error);
    throw error;
  }
}

// Habit functionality
async function renderHabits() {
  console.log('Rendering habits');
  if (!habitsList) {
    console.error('Habits list element not found');
    return;
  }
  
  try {
    habitsList.innerHTML = '';
    
    // Get today's stats
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let stats = {};
    
    try {
      if (typeof HabitHubStorage !== 'undefined') {
        stats = await HabitHubStorage.getStats(todayStr) || { totalTime: 0, websites: {} };
      } else {
        const result = await chrome.storage.local.get(['stats']);
        stats = (result.stats && result.stats[todayStr]) || { totalTime: 0, websites: {} };
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      stats = { totalTime: 0, websites: {} };
    }
    
    if (!stats.websites || Object.keys(stats.websites).length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.innerHTML = `
        <p>No browsing habits tracked today.</p>
        <p>Start browsing to see your habits!</p>
      `;
      habitsList.appendChild(emptyMessage);
      return;
    }
    
    // Sort websites by time spent (descending)
    const websites = Object.entries(stats.websites)
      .sort(([, a], [, b]) => (b.totalTime || 0) - (a.totalTime || 0));
    
    // Create a habit card for each website
    websites.forEach(([website, data]) => {
      const habitCard = document.createElement('div');
      habitCard.className = 'habit-card';
      
      const minutes = Math.round((data.totalTime || 0) / 60);
      const visits = data.visits || 0;
      
      habitCard.innerHTML = `
        <div class="habit-info">
          <h3 class="habit-title">${website}</h3>
          <div class="habit-stats">
            <span class="habit-time"><i class="fas fa-clock"></i> ${minutes} min</span>
            <span class="habit-visits"><i class="fas fa-external-link-alt"></i> ${visits} visits</span>
          </div>
        </div>
      `;
      
      habitsList.appendChild(habitCard);
    });
  } catch (error) {
    console.error('Error rendering habits:', error);
    showError('Failed to load browsing habits.');
  }
}

// Goals functionality
async function renderGoals() {
  console.log('Rendering goals');
  if (!goalsContainer || !emptyGoalsMessage) {
    console.error('Goals elements not found');
    return;
  }
  
  try {
    goalsContainer.innerHTML = '';
    
    // Get goals
    let goals = [];
    try {
      if (typeof HabitHubStorage !== 'undefined') {
        goals = await HabitHubStorage.getGoals();
      } else {
        const result = await chrome.storage.local.get(['goals']);
        goals = result.goals || [];
      }
    } catch (error) {
      console.error('Error loading goals:', error);
      goals = [];
    }
    
    // Get today's stats
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let stats = {};
    
    try {
      if (typeof HabitHubStorage !== 'undefined') {
        stats = await HabitHubStorage.getStats(todayStr) || { totalTime: 0, websites: {} };
      } else {
        const result = await chrome.storage.local.get(['stats']);
        stats = (result.stats && result.stats[todayStr]) || { totalTime: 0, websites: {} };
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      stats = { totalTime: 0, websites: {} };
    }
    
    if (!goals || goals.length === 0) {
      emptyGoalsMessage.style.display = 'block';
      goalsContainer.style.display = 'none';
    } else {
      emptyGoalsMessage.style.display = 'none';
      goalsContainer.style.display = 'block';
      
      // Create a goal card for each goal
      goals.forEach((goal, index) => {
        const goalCard = document.createElement('div');
        goalCard.className = 'goal-card';
        
        const website = goal.website;
        const websiteTime = (stats.websites[website]?.totalTime || 0);
        const websiteVisits = (stats.websites[website]?.visits || 0);
        
        // Calculate goal progress based on type
        let progressValue, progressUnit, currentValue;
        if (goal.type === 'time' || goal.type === 'limit') {
          currentValue = Math.round(websiteTime / 60);
          progressValue = Math.min(100, (websiteTime / ((goal.limit || goal.value) * 60)) * 100);
          progressUnit = 'min';
        } else {
          currentValue = websiteVisits;
          progressValue = Math.min(100, (websiteVisits / (goal.limit || goal.value)) * 100);
          progressUnit = 'visits';
        }
        
        // Set progress bar color based on progress
        let progressClass = '';
        if (progressValue >= 90) {
          progressClass = 'danger';
        } else if (progressValue >= 75) {
          progressClass = 'warning';
        }
        
        goalCard.innerHTML = `
          <div class="goal-header">
            <h3 class="goal-title">${website}</h3>
            <div class="goal-actions">
              <label class="switch">
                <input type="checkbox" class="goal-toggle" data-index="${index}" ${goal.active ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
              <button class="btn btn-danger btn-small goal-delete" data-index="${index}">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="goal-info">
            <span class="goal-type">${(goal.type === 'time' || goal.type === 'limit') ? 'Time Limit' : 'Visit Limit'}</span>
            <span class="goal-value">${goal.limit || goal.value} ${progressUnit}</span>
          </div>
          <div class="goal-progress">
            <div class="progress-container">
              <div class="progress-bar ${progressClass}" style="width: ${progressValue}%"></div>
            </div>
            <span class="progress-text">${currentValue}/${goal.limit || goal.value} ${progressUnit} (${Math.round(progressValue)}%)</span>
          </div>
        `;
        
        goalsContainer.appendChild(goalCard);
      });
      
      // Add event listeners to toggle and delete buttons
      document.querySelectorAll('.goal-toggle').forEach(toggle => {
        toggle.addEventListener('change', async function() {
          const index = parseInt(this.dataset.index);
          
          try {
            let goals = [];
            
            if (typeof HabitHubStorage !== 'undefined') {
              goals = await HabitHubStorage.getGoals();
              if (index >= 0 && index < goals.length) {
                goals[index].active = this.checked;
                await HabitHubStorage.saveGoals(goals);
              }
            } else {
              const result = await chrome.storage.local.get(['goals']);
              goals = result.goals || [];
              
              if (index >= 0 && index < goals.length) {
                goals[index].active = this.checked;
                await chrome.storage.local.set({ goals });
              }
            }
            
            // Update dashboard to reflect changes
            updateDashboard();
          } catch (error) {
            console.error('Error updating goal:', error);
            showError('Failed to update goal.');
          }
        });
      });
      
      document.querySelectorAll('.goal-delete').forEach(button => {
        button.addEventListener('click', async function() {
          const index = parseInt(this.dataset.index);
          
          if (confirm('Are you sure you want to delete this goal?')) {
            try {
              let goals = [];
              
              if (typeof HabitHubStorage !== 'undefined') {
                goals = await HabitHubStorage.getGoals();
                if (index >= 0 && index < goals.length) {
                  goals.splice(index, 1);
                  await HabitHubStorage.saveGoals(goals);
                }
              } else {
                const result = await chrome.storage.local.get(['goals']);
                goals = result.goals || [];
                
                if (index >= 0 && index < goals.length) {
                  goals.splice(index, 1);
                  await chrome.storage.local.set({ goals });
                }
              }
              
              // Refresh goals and dashboard
              await renderGoals();
              updateDashboard();
            } catch (error) {
              console.error('Error deleting goal:', error);
              showError('Failed to delete goal.');
            }
          }
        });
      });
    }
  } catch (error) {
    console.error('Error rendering goals:', error);
    showError('Failed to load goals.');
  }
}

// Also add the missing init function that's called after DOM is loaded
async function init() {
  try {
    // Initialize storage
    if (typeof HabitHubStorage !== 'undefined') {
      await HabitHubStorage.init();
    } else {
      console.error('HabitHubStorage is not defined');
      showError('Storage module not available');
    }
    
    // Initialize charts
    initCharts({
      categoryData: [],
      weeklyData: []
    });
    
    // Load data
    await refreshData();
    
    return true;
  } catch (error) {
    console.error('Initialization error:', error);
    throw error;
  }
}

// Helper function to refresh all data
async function refreshData() {
  try {
    await updateDashboard();
    await renderHabits();
    await renderGoals();
  } catch (error) {
    console.error('Error refreshing data:', error);
    throw error;
  }
}

// Add setupEventListeners function
function setupEventListeners() {
  // Refresh button
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      showLoading();
      refreshData()
        .catch(error => {
          console.error('Error refreshing data:', error);
          showError('Failed to refresh data.');
        })
        .finally(() => {
          hideLoading();
        });
    });
  }
  
  // Add goal button and form
  if (addGoalBtn && goalForm && goalFormSubmit && goalFormCancel) {
    // Open form
    addGoalBtn.addEventListener('click', function() {
      console.log('Add Goal button clicked');
      goalForm.classList.add('visible');
    });
    
    // Cancel button
    goalFormCancel.addEventListener('click', function() {
      console.log('Cancel button clicked');
      goalForm.classList.remove('visible');
    });
    
    // Submit button
    goalFormSubmit.addEventListener('click', async function() {
      const websiteInput = document.getElementById('goal-website');
      const typeSelect = document.getElementById('goal-type');
      const limitInput = document.getElementById('goal-limit');
      
      if (!websiteInput || !typeSelect || !limitInput) {
        showError('Form elements not found');
        return;
      }
      
      const website = websiteInput.value.trim();
      const type = typeSelect.value;
      const limit = parseInt(limitInput.value);
      
      if (!website) {
        showError('Please enter a website domain');
        return;
      }
      
      if (isNaN(limit) || limit <= 0) {
        showError('Please enter a valid limit');
        return;
      }
      
      try {
        // Create new goal
        const newGoal = {
          website,
          type,
          limit,
          active: true,
          createdAt: new Date().toISOString()
        };
        
        // Save the goal
        if (typeof HabitHubStorage !== 'undefined') {
          await HabitHubStorage.addGoal(newGoal);
        } else {
          // Get existing goals
          let goals = [];
          try {
            const result = await chrome.storage.local.get(['goals']);
            goals = result.goals || [];
          } catch (error) {
            console.error('Error loading goals:', error);
            goals = [];
          }
          
          // Add new goal
          goals.push(newGoal);
          
          // Save goals
          await chrome.storage.local.set({ goals });
        }
        
        // Reset and hide form
        websiteInput.value = '';
        limitInput.value = '30';
        goalForm.classList.remove('visible');
        
        // Refresh goals
        await renderGoals();
        await updateDashboard();
        
        showAlert('Goal added successfully!', 'success');
      } catch (error) {
        console.error('Error adding goal:', error);
        showError('Failed to add goal.');
      }
    });
  }
  
  // Update goal type unit
  const goalType = document.getElementById('goal-type');
  const goalUnit = document.getElementById('goal-unit');
  
  if (goalType && goalUnit) {
    goalType.addEventListener('change', () => {
      goalUnit.textContent = goalType.value === 'time' ? 'minutes' : 'visits';
    });
  }
}