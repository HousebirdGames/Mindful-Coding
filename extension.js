const vscode = require('vscode');

let statusBarReminder, statusBarInfo, reminderIntervals = {};
const thankYouMessage = 'Great! 👍';

let config = vscode.workspace.getConfiguration('mindfulCoding');
let reminderType = config.get('reminderType', 'None');

function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('mindfulCoding.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'mindfulCoding');
            statusBarInfo.hide();
        }),
        vscode.commands.registerCommand('mindfulCoding.dismissReminder', () => {
            statusBarReminder.hide();
            displayStatusBarMessage(thankYouMessage);
        })
    );

    setupStatusBarItems(context);

    if (!context.globalState.get('hasBeenPromptedForReminderSettings', false)) {
        promptForSettingsReset(context).then(() => {
            context.globalState.update('hasBeenPromptedForReminderSettings', true);
        });
    } else {
        setupReminders(context);
    }

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (['windowGazeInterval', 'stretchInterval', 'reminderType', 'enableWindowGazeReminder', 'enableStretchReminder']
            .some(setting => e.affectsConfiguration(`mindfulCoding.${setting}`))) {
            setupReminders(context, true);
        }
    }));

    context.subscriptions.push(
        vscode.commands.registerCommand('mindfulCoding.manageCustomReminders', () => {
            manageCustomReminders(context);
        })
    );
}

function setupStatusBarItems(context) {
    statusBarInfo = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    statusBarInfo.command = "mindfulCoding.openSettings";
    statusBarInfo.tooltip = "Click to customize Mindful Coding settings";
    context.subscriptions.push(statusBarInfo);

    statusBarReminder = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarReminder.command = "mindfulCoding.dismissReminder";
    statusBarReminder.tooltip = "Click when done";
    context.subscriptions.push(statusBarReminder);
}

async function promptForSettingsReset(context) {
    const reminderTypeConfig = vscode.workspace.getConfiguration('mindfulCoding').get('reminderType');
    if (reminderTypeConfig !== undefined) {
        const selection = await vscode.window.showInformationMessage('You have existing settings for Mindful Coding. Would you like to keep them or reset to defaults?', 'Keep', 'Reset');
        if (selection === 'Reset') {
            await resetSettings();
            askReminderModeNotification(context);
        }
    }
}

async function resetSettings() {
    config = vscode.workspace.getConfiguration('mindfulCoding');
    await Promise.all([
        'reminderType', 'windowGazeInterval', 'stretchInterval', 'enableWindowGazeReminder', 'enableStretchReminder'
    ].map(setting => config.update(setting, undefined, vscode.ConfigurationTarget.Global)));
}

function setupReminders(context, updatedSettings = false) {
    config = vscode.workspace.getConfiguration('mindfulCoding');
    reminderType = config.get('reminderType', 'None');

    Object.values(reminderIntervals).forEach(clearInterval);

    if (reminderType === 'None') {
        displayStatusBarInfo('$(gear) Mindful Coding is disabled');
        return;
    }

    if (config.get('enableWindowGazeReminder')) {
        reminderIntervals['windowGaze'] = setupInterval('Time to gaze out of a window. 🌳', config.get('windowGazeInterval'), context);
    }

    if (config.get('enableStretchReminder')) {
        reminderIntervals['stretch'] = setupInterval('Time to stretch. 😺', config.get('stretchInterval'), context);
    }

    // Check if custom reminders are enabled
    if (config.get('enableCustomReminders', true)) {
        const customReminders = config.get('customReminders', []);
        customReminders.forEach((reminder, index) => {
            reminderIntervals[`custom_${index}`] = setupInterval(reminder.text, reminder.interval, context);
        });
    }

    if (updatedSettings) {
        displayStatusBarInfo('$(gear) Mindful Coding settings updated');
    } else {
        displayStatusBarInfo('$(gear) Mindful Coding is active. Click to customize.');
    }
}

function setupInterval(message, intervalInMinutes, context) {
    const interval = Math.max(intervalInMinutes * 60000, 60000);
    return setInterval(() => showReminder(message, context), interval);
}

const lastPopupTimestampKey = 'mindfulCoding.lastPopupTimestamp';
function showReminder(message, context) {
    if (reminderType === 'None') {
        return;
    }

    if (!context || !context.globalState) {
        console.error('Context or global state is undefined');
        return;
    }

    const now = new Date().getTime();
    const lastPopupTimestamp = context.globalState.get(lastPopupTimestampKey, 0);
    const popupCooldown = 50000;

    if (reminderType === 'Status Bar') {
        statusBarReminder.text = `$(clock) ${message}`;
        statusBarReminder.tooltip = "Click when done";
        statusBarReminder.show();
    } else if (reminderType === 'Annoying Popup') {
        if (now - lastPopupTimestamp > popupCooldown) {
            vscode.window.showInformationMessage(message, { modal: true }, 'Done').then(selection => {
                if (selection === 'Done') {
                    displayStatusBarMessage(thankYouMessage);
                    context.globalState.update(lastPopupTimestampKey, now);
                }
            });
        }
    } else {
        vscode.window.showInformationMessage(message, 'Done').then(selection => {
            if (selection === 'Done' && reminderType === 'Notification') {
                displayStatusBarMessage(thankYouMessage);
            }
        });
    }
}

let statusBarInfoTimeout, statusBarMessageTimeout;

function displayStatusBarInfo(message) {
    statusBarInfo.text = message;
    statusBarInfo.show();

    if (statusBarInfoTimeout) {
        clearTimeout(statusBarInfoTimeout);
    }

    statusBarInfoTimeout = setTimeout(() => {
        statusBarInfo.hide();
    }, 5000);
}

function displayStatusBarMessage(message) {
    statusBarReminder.text = `$(check) ${message}`;
    statusBarReminder.show();

    if (statusBarMessageTimeout) {
        clearTimeout(statusBarMessageTimeout);
    }

    statusBarMessageTimeout = setTimeout(() => {
        statusBarReminder.hide();
    }, 5000);
}

function manageCustomReminders(context) {
    const config = vscode.workspace.getConfiguration('mindfulCoding');
    const customReminders = config.get('customReminders', []);

    const quickPickItems = customReminders.map((reminder, index) => ({
        label: `${reminder.text} (every ${reminder.interval} minutes)`,
        description: `Custom Reminder ${index + 1}`,
        reminder: reminder,
        index: index
    }));

    quickPickItems.push({ label: '$(add) Add new custom reminder', description: 'Create a new custom reminder' });

    vscode.window.showQuickPick(quickPickItems, {
        placeHolder: 'Select a custom reminder to edit, delete, or add a new one'
    }).then(selected => {
        if (selected) {
            if (selected.reminder) {
                vscode.window.showQuickPick(['Edit', 'Delete'], {
                    placeHolder: 'Edit or delete this reminder?'
                }).then(action => {
                    if (action === 'Edit') {
                        editCustomReminder(context, selected.index);
                    } else if (action === 'Delete') {
                        deleteCustomReminder(context, selected.index);
                    }
                });
            } else {
                addCustomReminder(context);
            }
        }
    });
}

async function addCustomReminder(context) {
    const text = await vscode.window.showInputBox({
        prompt: 'Enter the reminder text',
        validateInput: validateReminderText
    });
    if (!text) return;

    const interval = await vscode.window.showInputBox({
        prompt: 'Enter the interval in minutes (minimum 1 minute)',
        validateInput: validateNumber
    });
    if (!interval) return;

    const config = vscode.workspace.getConfiguration('mindfulCoding');
    const customReminders = config.get('customReminders', []);
    customReminders.push({ text, interval: parseInt(interval) });
    await config.update('customReminders', customReminders, vscode.ConfigurationTarget.Global);
    setupReminders(context, true);
}

async function editCustomReminder(context, index) {
    const config = vscode.workspace.getConfiguration('mindfulCoding');
    const customReminders = config.get('customReminders', []);
    const reminder = customReminders[index];

    const text = await vscode.window.showInputBox({
        prompt: 'Enter the new reminder text',
        value: reminder.text,
        validateInput: validateReminderText
    });
    if (!text) return;

    const interval = await vscode.window.showInputBox({
        prompt: 'Enter the new interval in minutes (minimum 1 minute)',
        value: reminder.interval.toString(),
        validateInput: validateNumber
    });
    if (!interval) return;

    customReminders[index] = { text, interval: parseInt(interval) };
    await config.update('customReminders', customReminders, vscode.ConfigurationTarget.Global);
    setupReminders(context, true);
}

async function deleteCustomReminder(context, index) {
    const config = vscode.workspace.getConfiguration('mindfulCoding');
    const customReminders = config.get('customReminders', []);

    customReminders.splice(index, 1);
    await config.update('customReminders', customReminders, vscode.ConfigurationTarget.Global);
    setupReminders(context, true);

    vscode.window.showInformationMessage('Custom reminder deleted successfully.');
}

function validateNumber(value) {
    const num = parseInt(value);
    if (isNaN(num)) {
        return 'Please enter a valid number';
    }
    if (num < 1) {
        return 'The minimum interval is 1 minute';
    }
    return null;
}

function validateReminderText(value) {
    if (!value || value.trim() === '') {
        return 'The reminder message cannot be empty';
    }
    return null;
}

function deactivate() {
    Object.values(reminderIntervals).forEach(clearInterval);
}

module.exports = {
    activate,
    deactivate
};