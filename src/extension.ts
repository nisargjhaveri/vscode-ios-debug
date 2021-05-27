import * as vscode from 'vscode';
import { Device, Simulator } from './commonTypes';
import { listTargets } from './targets';

export function activate(context: vscode.ExtensionContext) {
	console.log('Activating extension "ios-device"');

	let disposable = vscode.commands.registerCommand('ios-device.pickTarget', () => {
		let quickPickItems = listTargets().then((targets) => {
			return targets.map((t) : vscode.QuickPickItem => ({
				label: t.name,
				description:
					(t.type === "Simulator") ? 
						(t as Simulator).state === "Booted" ? "Booted" : "" :
						(t as Device).modelName,
				detail: `${t.type} - ${t.runtime}`,
			}));
		});

		let quickPickOptions: vscode.QuickPickOptions = {
			title: "Select iOS Target",
			matchOnDescription: true,
		};

		vscode.window.showQuickPick(quickPickItems, quickPickOptions);
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
