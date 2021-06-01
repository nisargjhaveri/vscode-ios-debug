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

	context.subscriptions.push(vscode.commands.registerCommand('ios-device.simulator.install', targetCommands.simulatorInatall));
	context.subscriptions.push(vscode.commands.registerCommand('ios-device.simulator.launch', targetCommands.simulatorLaunch));
	context.subscriptions.push(vscode.commands.registerCommand('ios-device.simulator.install+launch', targetCommands.simulatorInstallLaunch));
	context.subscriptions.push(vscode.commands.registerCommand('ios-device.device.install', targetCommands.deviceInstall));

	targetPicker.activate(context);
}

// this method is called when your extension is deactivated
export function deactivate() {}
