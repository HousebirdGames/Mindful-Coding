# Mindful Coding

Mindful Coding helps you enhance your productivity and well-being by reminding you to take short breaks for window-gazing and stretching throughout your coding sessions.

## Features

Mindful Coding offers customizable reminders to:

- **Look Away**: Gaze out of a window every 20 minutes to reduce eye strain and refresh your mind.
- **Stretch**: Take a brief stretching break every 45 minutes to keep your body relaxed and prevent muscle stiffness.

Choose how you receive reminders:

- **Notification**: A gentle pop-up notification.
- **Status Bar**: A discreet message in the VSCode status bar.
- **Annoying Popup**: A more insistent pop-up to make sure you don't skip your break.

## Getting Started

1. **Install Mindful Coding** from the VSCode Marketplace.
2. **Configure your preferences** in the VSCode settings under `Extensions > Mindful Coding`.
    - Set reminder intervals (minimum time is 1 Minute).
    - Choose the reminder type.
    - Enable or disable specific reminders.

## Usage

Once installed and configured, Mindful Coding runs automatically in the background. Depending on your settings, you'll receive notifications reminding you to take breaks.

- Click on the reminder or the status bar message to acknowledge and dismiss the notification.
- Use the command `Open Mindful Coding Settings` from the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) to adjust settings at any time.

## Customization

Customize Mindful Coding via the settings:

```json
"mindfulCoding.reminderType": "Notification",
"mindfulCoding.enableWindowGazeReminder": true,
"mindfulCoding.windowGazeInterval": 20,
"mindfulCoding.enableStretchReminder": true,
"mindfulCoding.stretchInterval": 45
```

## Contributing

Contributions are welcome! Check out our [GitHub repository](https://github.com/HousebirdGames/Mindful-Coding.git) for source code, to report issues, or suggest improvements.