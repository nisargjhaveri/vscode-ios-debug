import * as vscode from 'vscode';
import * as logger from './lib/logger';
import { Device, Simulator, Target } from './lib/commonTypes';
import { setCompanionUsbmuxdSocketPath } from './lib/devices';
import { listTargets, isValid as isValidTarget, getTarget } from './lib/targets';
import { UsbmuxdReverseProxyServer } from './lib/remoteUsbmuxd';

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

// Remote devices
async function isCompanionAvailable() {
	let companionFound = false;
	try {
		await vscode.commands.executeCommand("ios-debug-companion.activate");
		companionFound = true;
	}
	catch (e) {
		companionFound = false;
	}

	return companionFound;
}

async function canStartUsbmuxdReverseProxy() {
	return await vscode.commands.executeCommand<boolean>("ios-debug-companion.canStartUsbmuxdReverseProxy") ?? false;
}

let companionInstallationPromptShown = false;
async function promptInstallCompanion() {
	// Don't show the prompt again if we already shown once in the session
	if (companionInstallationPromptShown) {
		return;
	}
	companionInstallationPromptShown = true;

	logger.log("Showing prompt to install companion");

	const INSTALL = "Install";
	const DONT_ASK_AGAIN = "Don't ask again";
	const choice = await vscode.window.showInformationMessage(
		"Install [iOS Debug Companion](https://marketplace.visualstudio.com/items?itemName=nisargjhaveri.ios-debug-companion) extension to enable debugging on locally connected devices.",
		INSTALL,
		DONT_ASK_AGAIN
	);

	if (choice === DONT_ASK_AGAIN) {
		await vscode.workspace.getConfiguration("ios-debug").update('shareLocalDevices', "never", true);
		return;
	}
	else if (choice !== INSTALL) {
		return;
	}
	
	await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
		const companionExtensionId = "nisargjhaveri.ios-debug-companion";
		logger.log(`Installing companion extension (${companionExtensionId})`);
		progress.report({message: `Installing companion extension (${companionExtensionId}) ...`});
		await vscode.commands.executeCommand("workbench.extensions.installExtension", companionExtensionId);
	});

	if (!await isCompanionAvailable()) {
		// Still not available.
		logger.error("Companion extension still not available. Could not install?");
		return;
	}
	
	logger.log("Companion extension installed.");

	// Retrigger companion connection. We reached here from that flow in the first place.
	// User already has an intent to use remote features.
	await ensureCompanionConnected();
}

let usbmuxdReverseProxyServer: UsbmuxdReverseProxyServer;
async function ensureCompanionConnected() {
	// Do nothing if not remote
	if (!vscode.env.remoteName) {
		return;
	}

	// Do nothing if we're not running on the remote end
	if (!context || context.extension.extensionKind !== vscode.ExtensionKind.Workspace) {
		return;
	}

	// If we're already connected, nothing more to do
	if (usbmuxdReverseProxyServer
		&& usbmuxdReverseProxyServer.proxyServerAddress
		&& usbmuxdReverseProxyServer.usbmuxdSocketPath) {
		return;
	}

	try {
		if (!usbmuxdReverseProxyServer) {
			const configShareLocalDevices = vscode.workspace.getConfiguration("ios-debug").get<string>('shareLocalDevices');
			if (configShareLocalDevices === "never") {
				return;
			}

			// Check if companion is available
			if (!await isCompanionAvailable()) {
				promptInstallCompanion().catch(e => {
					logger.error("Error installing companion extension:", e);
				});
				return;
			}

			// Can we start the reverse proxy?
			if (!await canStartUsbmuxdReverseProxy()) {
				return;
			}

			// Start the reverse proxy server
			usbmuxdReverseProxyServer = new UsbmuxdReverseProxyServer();

			await usbmuxdReverseProxyServer.start();

			usbmuxdReverseProxyServer.on("path-updated", (usbmuxdSocketPath) => {
				setCompanionUsbmuxdSocketPath(usbmuxdSocketPath);
			});
		}

		// Ask companion to connect if server is started
		if (usbmuxdReverseProxyServer && usbmuxdReverseProxyServer.proxyServerAddress && !usbmuxdReverseProxyServer.usbmuxdSocketPath) {
			let httpUrl = vscode.Uri.parse(usbmuxdReverseProxyServer.proxyServerAddress.replace(/^ws/, "http"));
			let externalHttpUrl = await vscode.env.asExternalUri(httpUrl);
			let wsUrl = externalHttpUrl.toString().replace(/^http/, "ws");

			vscode.commands.executeCommand("ios-debug-companion.startUsbmuxdReverseProxy", wsUrl);
			await usbmuxdReverseProxyServer.ensureUsbmuxdSocketPath();
		}
	} catch(e) {
		logger.log("Error connecting to companion:", e);
	}
}

// Command callbacks
export async function pickTarget()
{
	await ensureCompanionConnected();
	let quickPickItems = listTargets().then((targets) => {
		return targets
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
	});

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

export async function getOrPickTarget()
{
	await ensureCompanionConnected();
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
	await ensureCompanionConnected();
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
	let target: Target|undefined = await getOrPickTarget();

	return target?.udid;
}

export async function targetType ()
{
	let target: Target|undefined = await getOrPickTarget();

	return target?.type;
}

export async function targetName()
{
	let target: Target|undefined = await getOrPickTarget();

	return target?.name;
}

export async function targetSdk()
{
	let target: Target|undefined = await getOrPickTarget();

	return target?.sdk;
}


// Activation
export function activate(c: vscode.ExtensionContext)
{
	context = c;

	setupStatusBarPicker();
}
