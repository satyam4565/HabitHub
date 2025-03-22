# HabitHub - Browser Habit Tracker

HabitHub is a Chrome extension that helps you track and improve your browsing habits by monitoring website usage, setting goals, and providing insightful statistics.

## Features

- **Habit Tracking**: Monitor your browsing habits including websites visited and time spent
- **Goal Setting**: Set personalized goals like "spend less than 30 minutes on social media per day"
- **Notifications**: Receive alerts when you reach your goals or need to take a break
- **Statistics**: View detailed statistics about your browsing patterns with visual charts

## Installation

### From the Chrome Web Store (Coming soon)

1. Visit the Chrome Web Store
2. Search for "HabitHub" or go directly to the extension page
3. Click "Add to Chrome"

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The HabitHub icon should appear in your browser toolbar

## How to Use

1. **Dashboard**: View your daily progress, time spent browsing, and category breakdowns
2. **Habits**: See a list of your most visited websites and the time spent on each
3. **Goals**: Set and manage goals for specific websites or categories
4. **Settings**: Configure notifications, data retention, and other preferences

### Setting Goals

1. Navigate to the "Goals" tab
2. Click "Add Goal"
3. Choose between a time limit or visit limit
4. Enter the website domain or category
5. Set your limit (minutes or visits)
6. Choose a time period (daily or weekly)
7. Click "Save Goal"

## Privacy

HabitHub respects your privacy:

- All data is stored locally on your device
- No browsing data is sent to external servers
- You can clear your data at any time from the Settings tab

## Development

HabitHub is built using:

- HTML, CSS, and JavaScript
- Chart.js for data visualization
- Luxon for date/time handling
- Chrome Extension APIs

### Project Structure

- `manifest.json`: Extension configuration
- `popup.html`: Main UI for the extension
- `background.js`: Background tracking script
- `/js`: JavaScript modules
- `/css`: Styling files
- `/icons`: Extension icons

## Future Plans

- Customizable categories
- Export data functionality
- Enhanced visualization options
- Focus mode for productivity
- Site blocking features

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.
