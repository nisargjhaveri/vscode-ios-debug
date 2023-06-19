import * as vscode from 'vscode';
import * as debugConfigProvider from './debugConfigProvider';
import * as debugLifecycleManager from './debugLifecycleManager';
import * as targetPicker from './targetPicker';
import * as targetCommand from './targetCommand';
import * as logger from './lib/logger';

export function activate(context: vscode.ExtensionContext) {
	logger.activate(vscode.window.createOutputChannel("iOS Debug"));
	logger.log('Activating extension "ios-debug"');

	targetPicker.activate(context);
	targetCommand.activate(context);
	debugConfigProvider.activate(context);
	debugLifecycleManager.activate(context);

	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.pickTarget', targetPicker.pickTarget));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug._getOrPickTarget', targetPicker._getOrPickTarget));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.targetUDID', targetPicker.targetUDID));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.targetType', targetPicker.targetType));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.targetName', targetPicker.targetName));
	context.subscriptions.push(vscode.commands.registerCommand('ios-debug.targetSdk', targetPicker.targetSdk));

	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('lldb', new debugConfigProvider.DebugConfigurationProvider()));
}

// this method is called when your extension is deactivated
export function deactivate() {}
