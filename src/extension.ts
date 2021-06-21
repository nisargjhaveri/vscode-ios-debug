import * as vscode from 'vscode';
import * as targetCommands from './targetCommand';
import * as targetPicker from './targetPicker';

export function activate(context: vscode.ExtensionContext) {
	console.log('Activating extension "ios-debug"');

	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.pickTarget', targetPicker.pickTarget));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug._getOrPickTarget', targetPicker._getOrPickTarget));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.targetUDID', targetPicker.targetUDID));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.targetType', targetPicker.targetType));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.targetName', targetPicker.targetName));

	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.simulator.install', targetCommands.simulatorInstall));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.simulator.launch', targetCommands.simulatorLaunch));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.simulator.launchForDebug', (args) => {
		return targetCommands.simulatorLaunch({
			waitForDebugger: true, 
			...args
		});
	}));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.simulator.installAndlaunch', targetCommands.simulatorInstallAndLaunch));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.simulator.installAndlaunchForDebug', (args) => {
		return targetCommands.simulatorInstallAndLaunch({
			waitForDebugger: true,
			...args
		});
	}));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.device.install', targetCommands.deviceInstall));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.device.debugserver', targetCommands.deviceDebugserver));

	targetPicker.activate(context);
}

// this method is called when your extension is deactivated
export function deactivate() {}
