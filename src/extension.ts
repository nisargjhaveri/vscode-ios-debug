import * as vscode from 'vscode';
import { Device, Simulator, Target } from './commonTypes';
import { listTargets, isValid as isValidTarget } from './targets';

const SELECTED_TARGET_KEY = "selected_target";

interface TargetQuickPickItem extends vscode.QuickPickItem {
	target: Target;
}

let statusBarTargetPicker: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
	console.log('Activating extension "ios-device"');

	context.subscriptions.push(vscode.commands.registerCommand('ios-device.pickTarget', async () => {
		let quickPickItems = listTargets().then((targets) => {
			return targets.map((t) : TargetQuickPickItem => ({
				label: t.name,
				description:
					(t.type === "Simulator") ? 
						(t as Simulator).state === "Booted" ? "Booted" : "" :
						(t as Device).modelName,
				detail: `${t.type} ‧ ${t.runtime}`,
				target: t,
			}));
		});

		let quickPickOptions: vscode.QuickPickOptions = {
			title: "Select iOS Target",
			matchOnDescription: true,
		};

		let target = (await vscode.window.showQuickPick(quickPickItems, quickPickOptions))?.target;

		if (target && target.udid)
		{
			await vscode.commands.executeCommand('ios-device._updateTarget', target);
		}

		console.log(target);

		return target;
	}));

	context.subscriptions.push(vscode.commands.registerCommand('ios-device._updateTarget', async (target: Target|undefined) => {
		await context.workspaceState.update(SELECTED_TARGET_KEY, target);
		vscode.commands.executeCommand('ios-device._updateStatusBarTargetPicker');
	}));

	context.subscriptions.push(vscode.commands.registerCommand('ios-device._getTarget', () => {
		return context.workspaceState.get(SELECTED_TARGET_KEY);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('ios-device._getOrPickTarget', async () => {
		let target: Target|undefined = await vscode.commands.executeCommand('ios-device._getTarget');
		let isValid = target && await isValidTarget(target);

		if (!isValid)
		{
			await vscode.commands.executeCommand('ios-device._updateTarget', undefined);
			target = await vscode.commands.executeCommand('ios-device.pickTarget');
		}

		console.log(target);

		if (!target)
		{
			throw new Error('Target not selected.');
		}

		return target;
	}));

	context.subscriptions.push(vscode.commands.registerCommand('ios-device.targetUDID', async () => {
		let target: Target|undefined = await vscode.commands.executeCommand('ios-device._getOrPickTarget');

		return target?.udid;
	}));

	context.subscriptions.push(vscode.commands.registerCommand('ios-device.targetType', async () => {
		let target: Target|undefined = await vscode.commands.executeCommand('ios-device._getOrPickTarget');

		return target?.type;
	}));

	context.subscriptions.push(vscode.commands.registerCommand('ios-device.targetName', async () => {
		let target: Target|undefined = await vscode.commands.executeCommand('ios-device._getOrPickTarget');

		return target?.name;
	}));

	context.subscriptions.push(vscode.commands.registerCommand('ios-device._updateStatusBarTargetPicker', async () => {
		let target: Target|undefined = await vscode.commands.executeCommand('ios-device._getTarget');
		let targetName: string = target?.name || "Select target";
		statusBarTargetPicker.text = `$(device-mobile) ${targetName}`;
	}));


	statusBarTargetPicker = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	statusBarTargetPicker.command = "ios-device.pickTarget";
	statusBarTargetPicker.tooltip = "Select iOS target for debugging";
	vscode.commands.executeCommand('ios-device._updateStatusBarTargetPicker');
	statusBarTargetPicker.show();
}

// this method is called when your extension is deactivated
export function deactivate() {}
