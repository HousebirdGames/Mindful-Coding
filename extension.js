const vscode = require('vscode');

let statusBarReminder;

let windowGazeIntervalId;
let stretchIntervalId;
let reminderType = 'None';

const thankYouMessage = 'Great! Thanks for taking a break. 👍';

function activate(context) {
    let disposable = vscode.commands.registerCommand('mindfulCoding.openSettings', function () {
        vscode.commands.executeCommand('workbench.action.openSettings', 'mindfulCoding');
    });
    context.subscriptions.push(disposable);

    statusBarReminder = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarReminder.command = "extension.dismissReminder";
    context.subscriptions.push(statusBarReminder);
    context.subscriptions.push(vscode.commands.registerCommand('extension.dismissReminder', () => {
        statusBarReminder.hide();
        displayStatusBarMessage(thankYouMessage);
    }));

    const hasBeenPrompted = context.globalState.get('hasBeenPromptedForReminderSettings', false);

    if (!hasBeenPrompted) {
        promptForSettingsReset(context).then(() => {
            context.globalState.update('hasBeenPromptedForReminderSettings', true);
        });
    } else {
        setupReminders(context);
    }

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('mindfulCoding.windowGazeInterval')
            || e.affectsConfiguration('mindfulCoding.stretchInterval')
            || e.affectsConfiguration('mindfulCoding.reminderType')
            || e.affectsConfiguration('mindfulCoding.enableWindowGazeReminder')
            || e.affectsConfiguration('mindfulCoding.enableStretchReminder')
        ) {
            setupReminders(context, true);
        }
    }));
}

async function promptForSettingsReset(context) {
    const reminderType = vscode.workspace.getConfiguration('mindfulCoding').get('reminderType');
    if (reminderType !== undefined) {
        const selection = await vscode.window.showInformationMessage('You have existing settings for Mindful Coding. Would you like to keep them or reset to defaults?', 'Keep', 'Reset');
        if (selection === 'Reset') {
            await resetSettings();
            askReminderModeNotification(context);
        }
    }
}

function askReminderModeNotification(context) {
    vscode.window.showInformationMessage('Select your preferred reminder mode:', 'Notification', 'Status Bar', 'Annoying Popup', 'None').then(selection => {
        if (selection) {
            vscode.workspace.getConfiguration('mindfulCoding').update('reminderType', selection, vscode.ConfigurationTarget.Global);
            setupReminders(context);
        } else {
            vscode.workspace.getConfiguration('mindfulCoding').update('reminderType', 'None', vscode.ConfigurationTarget.Global);
            setupReminders(context);
        }
    });
}

function resetSettings() {
    const config = vscode.workspace.getConfiguration('mindfulCoding');
    return Promise.all([
        config.update('reminderType', undefined, vscode.ConfigurationTarget.Global),
        config.update('windowGazeInterval', undefined, vscode.ConfigurationTarget.Global),
        config.update('stretchInterval', undefined, vscode.ConfigurationTarget.Global),
        config.update('enableWindowGazeReminder', undefined, vscode.ConfigurationTarget.Global),
        config.update('enableStretchReminder', undefined, vscode.ConfigurationTarget.Global)
    ]);
}

function askReminderMode(context) {
    const config = vscode.workspace.getConfiguration('mindfulCoding');
    vscode.window.showQuickPick(['Notification', 'Status Bar', 'Annoying Popup', 'None'], {
        placeHolder: 'How do you want your reminders? Annoying Popup requires action to dismiss.',
    }).then(selection => {
        const reminderMode = selection ? selection : 'None';
        config.update('reminderType', reminderMode, vscode.ConfigurationTarget.Global);
        setupReminders(context);
    });
}

function setupReminders(context, updatedSettings = false) {
    const config = vscode.workspace.getConfiguration('mindfulCoding');
    reminderType = config.get('reminderType');


    if (windowGazeIntervalId) clearInterval(windowGazeIntervalId);
    if (stretchIntervalId) clearInterval(stretchIntervalId);

    if (reminderType === 'None') {
        displayStatusBarMessage('Mindful Coding is disabled');
        return;
    }

    const enableWindowGazeReminder = config.get('enableWindowGazeReminder', true);
    const enableStretchReminder = config.get('enableStretchReminder', true);
    let windowGazeTimer = config.get('windowGazeInterval') * 60000;
    let stretchTimer = config.get('stretchInterval') * 60000;

    if (windowGazeTimer < 60000) {
        windowGazeTimer = 60000;
    }

    if (stretchTimer < 60000) {
        stretchTimer = 60000;
    }

    if (enableWindowGazeReminder) {
        windowGazeIntervalId = setInterval(() => {
            showReminder('Time to gaze out of a window. 🌳', context);
        }, windowGazeTimer);
    }

    if (enableStretchReminder) {
        stretchIntervalId = setInterval(() => {
            showReminder('Time to stretch. 😺', context);
        }, stretchTimer);
    }

    if (updatedSettings) {
        displayStatusBarMessage('Mindful Coding settings updated');
    }
    else {
        vscode.window.showInformationMessage('Mindful Coding is active. You can change the reminders anytime in the settings.', 'Settings', 'Alright').then(selection => {
            if (selection === 'Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'mindfulCoding');
            }
        });
        displayStatusBarMessage('Mindful Coding is active (' + reminderType + ')');
    }
}

let lastPopupTimestampKey = 'mindfulCoding.lastPopupTimestamp';

function showReminder(message, context) {
    if (reminderType === 'None') {
        return;
    }

    if (!context || !context.globalState) {
        console.error('Context or global state is undefined');
        return;
    }

    let now = new Date().getTime();
    let lastPopupTimestamp = context.globalState.get(lastPopupTimestampKey, 0);
    let popupCooldown = 50000;

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

function displayStatusBarMessage(message) {
    statusBarReminder.text = `$(check) ${message}`;
    statusBarReminder.tooltip = "Acknowledge the message";
    statusBarReminder.show();

    setTimeout(() => statusBarReminder.hide(), 5000);
}

function deactivate() {
    if (statusBarReminder) {
        statusBarReminder.dispose();
    }
}

module.exports = {
    activate,
    deactivate
};