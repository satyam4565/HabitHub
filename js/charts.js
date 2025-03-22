/**
 * Charts module for HabitHub extension
 * Uses Chart.js for visualization
 */

// Store chart instances
const chartInstances = {
  categoryChart: null,
  weeklyChart: null
};

/**
 * Initialize charts with data
 * @param {Object} data - Chart data
 * @param {Array} data.categoryData - Category data
 * @param {Array} data.weeklyData - Weekly data
 */
function initCharts(data = { categoryData: [], weeklyData: [] }) {
  console.log('Initializing charts');
  
  // Clean up any existing charts
  if (chartInstances.categoryChart) {
    chartInstances.categoryChart.destroy();
    chartInstances.categoryChart = null;
  }
  
  if (chartInstances.weeklyChart) {
    chartInstances.weeklyChart.destroy();
    chartInstances.weeklyChart = null;
  }
  
  try {
    // Create new charts
    createCategoryChart(data.categoryData || []);
    createWeeklyChart(data.weeklyData || []);
  } catch (error) {
    console.error('Error initializing charts:', error);
  }
}

/**
 * Create pie chart for category data
 * @param {Array} data - Category data
 */
function createCategoryChart(data) {
  try {
    const ctx = document.getElementById('category-chart');
    if (!ctx) {
      console.error('Category chart element not found');
      return;
    }
    
    // Check if we have valid data
    const hasData = data && data.length > 0;
    
    // Default empty data with message
    let chartData = {
      labels: hasData ? data.map(item => item.category) : ['No Data'],
      datasets: [{
        data: hasData ? data.map(item => item.time) : [1],
        backgroundColor: hasData ? [
          '#4CAF50', '#2196F3', '#FFC107', '#F44336', 
          '#9C27B0', '#00BCD4', '#FF9800', '#795548'
        ] : ['#e0e0e0'],
        borderWidth: 1
      }]
    };
    
    chartInstances.categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: hasData,
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 10
            }
          },
          tooltip: {
            enabled: hasData
          }
        },
        cutout: '70%'
      },
      plugins: [{
        id: 'noDataText',
        afterDraw: function(chart) {
          if (!hasData) {
            // No data available
            const ctx = chart.ctx;
            const width = chart.width;
            const height = chart.height;
            
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#666';
            ctx.fillText('No data available', width / 2, height / 2);
            ctx.restore();
          }
        }
      }]
    });
  } catch (error) {
    console.error('Error creating category chart:', error);
  }
}

/**
 * Create line chart for weekly data
 * @param {Array} data - Weekly data
 */
function createWeeklyChart(data) {
  try {
    const ctx = document.getElementById('weekly-chart');
    if (!ctx) {
      console.error('Weekly chart element not found');
      return;
    }
    
    // Check if we have valid data
    const hasData = data && data.length > 0 && data.some(day => day.totalTime > 0);
    
    // Create labels and chart data
    let labels = [];
    let chartData = [];
    
    if (hasData) {
      // Extract data from provided array
      data.forEach(day => {
        const date = new Date(day.date);
        labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        chartData.push(Math.round(day.totalTime / 60)); // Convert seconds to minutes
      });
    } else {
      // Generate placeholder for last 7 days
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        chartData.push(0);
      }
    }
    
    chartInstances.weeklyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Minutes',
          data: chartData,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: hasData
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      },
      plugins: [{
        id: 'noDataText',
        afterDraw: function(chart) {
          if (!hasData) {
            // No data available
            const ctx = chart.ctx;
            const width = chart.width;
            const height = chart.height;
            
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#666';
            ctx.fillText('No activity data available', width / 2, height / 2);
            ctx.restore();
          }
        }
      }]
    });
  } catch (error) {
    console.error('Error creating weekly chart:', error);
  }
}

/**
 * Update category chart with new data
 * @param {Array} data - Category data array [{category, time}]
 */
function updateCategoryChart(data) {
  try {
    if (!chartInstances.categoryChart) {
      createCategoryChart(data);
      return;
    }
    
    // Check if we have valid data
    const hasData = data && data.length > 0;
    
    if (hasData) {
      chartInstances.categoryChart.data.labels = data.map(item => item.category);
      chartInstances.categoryChart.data.datasets[0].data = data.map(item => item.time);
      chartInstances.categoryChart.options.plugins.legend.display = true;
      chartInstances.categoryChart.options.plugins.tooltip.enabled = true;
    } else {
      chartInstances.categoryChart.data.labels = ['No Data'];
      chartInstances.categoryChart.data.datasets[0].data = [1];
      chartInstances.categoryChart.options.plugins.legend.display = false;
      chartInstances.categoryChart.options.plugins.tooltip.enabled = false;
    }
    
    chartInstances.categoryChart.update();
  } catch (error) {
    console.error('Error updating category chart:', error);
  }
}

/**
 * Update weekly chart with new data
 * @param {Array} data - Weekly data array [{date, totalTime}]
 */
function updateWeeklyChart(data) {
  try {
    if (!chartInstances.weeklyChart) {
      createWeeklyChart(data);
      return;
    }
    
    // Check if we have valid data
    const hasData = data && data.length > 0 && data.some(day => day.totalTime > 0);
    
    // Create labels and chart data
    let labels = [];
    let chartData = [];
    
    if (hasData) {
      // Extract data from provided array
      data.forEach(day => {
        const date = new Date(day.date);
        labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        chartData.push(Math.round(day.totalTime / 60)); // Convert seconds to minutes
      });
      
      chartInstances.weeklyChart.data.labels = labels;
      chartInstances.weeklyChart.data.datasets[0].data = chartData;
      chartInstances.weeklyChart.options.plugins.tooltip.enabled = true;
    } else {
      // Generate placeholder for last 7 days
      const today = new Date();
      labels = [];
      chartData = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        chartData.push(0);
      }
      
      chartInstances.weeklyChart.data.labels = labels;
      chartInstances.weeklyChart.data.datasets[0].data = chartData;
      chartInstances.weeklyChart.options.plugins.tooltip.enabled = false;
    }
    
    chartInstances.weeklyChart.update();
  } catch (error) {
    console.error('Error updating weekly chart:', error);
  }
}

// Make sure charts are initialized when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    initCharts();
  } catch (error) {
    console.error('Error initializing charts on DOM content loaded:', error);
  }
});

// Export functions for use in popup.js
try {
  if (typeof window !== 'undefined') {
    window.initCharts = initCharts;
    window.updateCategoryChart = updateCategoryChart;
    window.updateWeeklyChart = updateWeeklyChart;
  }
} catch (error) {
  console.error('Error exporting chart functions to window:', error);
} 