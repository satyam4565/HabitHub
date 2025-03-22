/**
 * Utility functions for HabitHub extension
 */

// Format seconds to user-friendly time
function formatTime(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)} min`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

// Format a number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Format a date string
function formatDate(dateString, format = 'short') {
  const date = new Date(dateString);
  
  if (format === 'short') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (format === 'weekday') {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString();
  }
}

// Clean up domain name
function formatDomain(domain) {
  return domain.replace(/^www\./, '');
}

// Get color for a category
function getCategoryColor(category) {
  const colorMap = {
    'social': '#EF4444',     // Red
    'productivity': '#10B981', // Green
    'entertainment': '#F59E0B', // Yellow
    'shopping': '#EC4899',   // Pink
    'news': '#6366F1',       // Indigo
    'education': '#3B82F6',  // Blue
    'other': '#6B7280'       // Gray
  };
  
  return colorMap[category.toLowerCase()] || colorMap.other;
}

// Debounce function to limit rapid calls
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Export utilities for use in Chrome extension context
if (typeof window !== 'undefined') {
  window.Utils = {
    formatTime,
    formatNumber,
    formatDate,
    formatDomain,
    getCategoryColor,
    debounce
  };
} 