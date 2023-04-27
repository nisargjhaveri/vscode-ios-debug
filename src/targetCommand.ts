import * as vscode from 'vscode';
import * as logger from './logger';
import * as simulator from './simulators';
import * as device from './devices';
import { targetUDID } from './targetPicker';
import { ChildProcess, PromiseWithChild } from 'child_process';

let context: vscode.ExtensionContext;
let debugserverProcesses: {[port: number]: ChildProcess} = {};


async function resolveArgs(args: any)
{
	if (!args.udid)
	{
		args.udid = await targetUDID();
	}

	return args;
}

export async function simulatorInstall(args: {udid: string, path: string})
{
	let {udid, path} = await resolveArgs(args);

	return vscode.window.withProgress({
		"location": vscode.ProgressLocation.Notification,
		"title": "Simulator",
		"cancellable": false
	}, (progress, token) => {
		return Promise.resolve()
			.then(() => progress.report({message: "Booting"}))
			.then(() => simulator.boot(udid))
			.then(() => progress.report({message: "Installing app"}))
			.then(() => simulator.install(udid, path))
			.catch((e) => {
				logger.error(e);
				vscode.window.showErrorMessage("Failed to install app on simulator");
			});;;
	});
}

export async function simulatorLaunch(a: {udid: string, bundleId: string, args?: string[], env?: {[key: string]: string}, waitForDebugger: boolean})
{
	let {udid, bundleId, args, env, waitForDebugger} = await resolveArgs(a);

	return vscode.window.withProgress({
		"location": vscode.ProgressLocation.Notification,
		"title": "Simulator",
		"cancellable": false
	}, (progress, token) => {
		return Promise.resolve()
			.then(() => progress.report({message: "Booting"}))
			.then(() => simulator.boot(udid))
			.then(() => progress.report({message: "Lauching app"}))
			.then(() => simulator.launch(udid, bundleId, args, env, waitForDebugger))
			.then((pid) => pid.toString())
			.catch((e) => {
				logger.error(e);
				vscode.window.showErrorMessage("Failed to launch app on simulator");
			});;;
	});
}

export async function simulatorInstallAndLaunch(a: {udid: string, path: string, bundleId: string, args?: string[], env?: {[key: string]: string}, stdio?: {stdout?: string, stderr?: string}, waitForDebugger: boolean})
{
	let {udid, path, bundleId, args, env, stdio: {stdout, stderr}, waitForDebugger} = await resolveArgs(a);

	return vscode.window.withProgress({
		"location": vscode.ProgressLocation.Notification,
		"title": "Simulator",
		"cancellable": false
	}, (progress, token) => {
		return Promise.resolve()
			.then(() => progress.report({message: "Booting"}))
			.then(() => simulator.boot(udid))
			.then(() => progress.report({message: "Installing app"}))
			.then(() => simulator.install(udid, path))
			.then(() => progress.report({message: "Lauching app"}))
			.then(() => simulator.launch(udid, bundleId, args, env, {stdout, stderr}, waitForDebugger))
			.then((pid) => pid.toString())
			.catch((e) => {
				logger.error(e);
				vscode.window.showErrorMessage("Failed to install and launch app on simulator");
			});;;
	});
}

export async function simulatorGetPidFor(args: {udid: string, bundleId: string})
{
	let {udid, bundleId} = await resolveArgs(args);

	return simulator.getPidFor(udid, bundleId)
		.then((pid) => pid.toString());
}

export async function deviceAppPath(args: {udid: string, bundleId: string})
{
	let {udid, bundleId} = await resolveArgs(args);

	return device.getAppDevicePath(udid, bundleId);
}

export async function deviceInstall(args: {udid: string, path: string})
{
	let {udid, path} = await resolveArgs(args);

	return vscode.window.withProgress({
			"location": vscode.ProgressLocation.Notification,
			"title": "Installing",
			"cancellable": true
		}, (progress, token) => {
			let lastProgress = 0;
			progress.report({ increment: 0 });

			let cancellationToken = {cancel: () => {}};

			token.onCancellationRequested((e) => { cancellationToken.cancel(); });

			return Promise.resolve()
				.then(() => device.install(udid, path, cancellationToken, (event) => {
					logger.log(event);

					let message;
					if (event.Event === "BundleCopy")
					{
						message = "Copying " + event.Path.replace(new RegExp(`^${path}/?`), "");
					}
					else if (event.Event === "BundleInstall")
					{
						message = event.Status;
					}

					progress.report({increment: event.OverallPercent - lastProgress, message});

					lastProgress = event.OverallPercent;
				}))
				.then((devicePath: string) => devicePath)
				.catch((e) => {
					logger.error(e);
					vscode.window.showErrorMessage("Failed to install app on device");
				});;
		});
}

export async function deviceDebugserver(args: {udid: string})
{
	let {udid} = await resolveArgs(args);

	return vscode.window.withProgress({
		"location": vscode.ProgressLocation.Notification,
		"title": "Starting debugserver",
		"cancellable": true
	}, (progress, token) => {
		let cancellationToken = {cancel: () => {}};

		token.onCancellationRequested((e) => cancellationToken.cancel());

		return Promise.resolve()
			.then(() => device.debugserver(udid, cancellationToken))
			.then(({port, exec}) => {

				debugserverProcesses[port] = exec.child;

				return port;
			})
			.catch((e) => {
				logger.error(e);
				vscode.window.showErrorMessage("Failed to start debugserver");
			});
	});
}

export function deviceDebugserverCleanup(port: number) {
	logger.log(`Cleaning up debugserver at port ${port}`);

	if (!(port in debugserverProcesses)) {
		return;
	}

	let proc = debugserverProcesses[port];

	if (proc.killed || proc.exitCode !== null) {
		// Process is already killed, do nothing
	}
	else {
		proc.kill();
	}

	delete debugserverProcesses[port];
}

export function activate(c: vscode.ExtensionContext) {
	context = c;

	// Clean all open debugserver processes
	context.subscriptions.push({
		dispose() {
			for(const port in debugserverProcesses) {
				deviceDebugserverCleanup(Number(port));
			}
		}
	});
}