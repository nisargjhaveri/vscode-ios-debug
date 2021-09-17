import * as vscode from 'vscode';
import * as logger from './logger';
import { Device, Simulator, Target } from './commonTypes';
import { listTargets, isValid as isValidTarget, getTarget } from './targets';

const SELECTED_TARGET_KEY = "selected_target";

interface TargetQuickPickItem extends vscode.QuickPickItem {
	target: Target;
}


let context: vscode.ExtensionContext;
let statusBarTargetPicker: vscode.StatusBarItem;


// Status bar
function setupStatusBarPicker()
{
	statusBarTargetPicker = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	statusBarTargetPicker.command = "ios-debug.pickTarget";
	statusBarTargetPicker.tooltip = "Select iOS target for debugging";
	updateStatusBarTargetPicker();
	statusBarTargetPicker.show();
}

function updateStatusBarTargetPicker()
{
	let target: Target|undefined = _getTarget();
	let targetName: string = target?.name || "Select target";
	statusBarTargetPicker.text = `$(device-mobile) ${targetName}`;
}

// Storage
async function _updateTarget(target: Target|undefined)
{
	await context.workspaceState.update(SELECTED_TARGET_KEY, target);
	updateStatusBarTargetPicker();
}

function _getTarget(): Target|undefined
{
	return context.workspaceState.get(SELECTED_TARGET_KEY);
}

// Command callbacks
export async function pickTarget()
{
	let targets = await listTargets();
	let quickPickItems = targets
		.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type.localeCompare(b.type);
			}
			if (a.type === "Simulator") {
				const simA = a as Simulator;
				const simB = b as Simulator;
				if (simA.state !== simB.state) {
					return simA.state === "Booted" ? -1 : simB.state === "Booted" ? 1 : 0; 
				}
			}

			return 0;
		})
		.map((t): TargetQuickPickItem => ({
			label: t.name,
			description:
				(t.type === "Simulator") ? 
					(t as Simulator).state === "Booted" ? "Booted" : "" :
					(t as Device).modelName,
			detail: `${t.type} ‧ ${t.runtime}`,
			target: t,
		}));

	let quickPickOptions: vscode.QuickPickOptions = {
		title: "Select iOS Target",
		matchOnDescription: true,
	};

	let target = (await vscode.window.showQuickPick(quickPickItems, quickPickOptions))?.target;

	if (target && target.udid)
	{
		await _updateTarget(target);
	}

	logger.log("Picked target", target);

	return target;
}

export async function _getOrPickTarget()
{
	let target: Target|undefined = _getTarget();
	let isValid = target && await isValidTarget(target);

	if (!isValid)
	{
		await _updateTarget(undefined);
		target = await pickTarget();
	}

	return target;
}

export async function getTargetFromUDID(udid: string)
{
	let target: Target|undefined = await getTarget(udid);

	if (target && target.udid)
	{
		await _updateTarget(target);
	}

	logger.log(`Got target for udid: ${udid}`, target);

	return target;
}

export async function targetUDID()
{
	let target: Target|undefined = await _getOrPickTarget();

	return target?.udid;
}

export async function targetType ()
{
	let target: Target|undefined = await _getOrPickTarget();

	return target?.type;
}

export async function targetName()
{
	let target: Target|undefined = await _getOrPickTarget();

	return target?.name;
}

export async function targetSdk()
{
	let target: Target|undefined = await _getOrPickTarget();

	return target?.sdk;
}


// Activation
export function activate(c: vscode.ExtensionContext)
{
	context = c;

	setupStatusBarPicker();
}
