import * as vscode from 'vscode';
import * as targetCommands from './targetCommand';
import * as targetPicker from './targetPicker';

export function activate(context: vscode.ExtensionContext) {
	console.log('Activating extension "ios-device"');

	context.subscriptions.push(vscode.commands.registerCommand('ios-device.pickTarget', targetPicker.pickTarget));
	context.subscriptions.push(vscode.commands.registerCommand('ios-device._getOrPickTarget', targetPicker._getOrPickTarget));
	context.subscriptions.push(vscode.commands.registerCommand('ios-device.targetUDID', targetPicker.targetUDID));
	context.subscriptions.push(vscode.commands.registerCommand('ios-device.targetType', targetPicker.targetType));
	context.subscriptions.push(vscode.commands.registerCommand('ios-device.targetName', targetPicker.targetName));

	context.subscriptions.push(vscode.commands.registerCommand('ios-device.simulator.install', targetCommands.simulatorInstall));
	context.subscriptions.push(vscode.commands.registerCommand('ios-device.simulator.launch', targetCommands.simulatorLaunch));
	context.subscriptions.push(vscode.commands.registerCommand('ios-device.simulator.launchForDebug', (args) => {
		return targetCommands.simulatorLaunch({
			waitForDebugger: true, 
			...args
		});
	}));
	context.subscriptions.push(vscode.commands.registerCommand('ios-device.simulator.installAndlaunch', targetCommands.simulatorInstallAndLaunch));
	context.subscriptions.push(vscode.commands.registerCommand('ios-device.simulator.installAndlaunchForDebug', (args) => {
		return targetCommands.simulatorInstallAndLaunch({
			waitForDebugger: true,
			...args
		});
	}));
	context.subscriptions.push(vscode.commands.registerCommand('ios-device.device.install', targetCommands.deviceInstall));
	context.subscriptions.push(vscode.commands.registerCommand('ios-device.device.debugserver', targetCommands.deviceDebugserver));

	targetPicker.activate(context);
}

// this method is called when your extension is deactivated
export function deactivate() {}
