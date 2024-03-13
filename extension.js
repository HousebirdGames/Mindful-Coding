const vscode = require('vscode');

let statusBarReminder, statusBarInfo, reminderIntervals = {};
const thankYouMessage = 'Great! Thanks for taking a break. 👍';

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

    if (reminderType === 'None' || (!config.get('enableWindowGazeReminder') && !config.get('enableStretchReminder'))) {
        displayStatusBarInfo('$(gear) Mindful Coding is disabled');
        return;
    }

    if (config.get('enableWindowGazeReminder')) {
        reminderIntervals['windowGaze'] = setupInterval('Time to gaze out of a window. 🌳', config.get('windowGazeInterval'), context);
    }

    if (config.get('enableStretchReminder')) {
        reminderIntervals['stretch'] = setupInterval('Time to stretch. 😺', config.get('stretchInterval'), context);
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

function deactivate() {
    Object.values(reminderIntervals).forEach(clearInterval);
}

module.exports = {
    activate,
    deactivate
};