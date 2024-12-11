import * as vscode from 'vscode';
import * as logger from './lib/logger';
import * as simulator from './lib/simulators';
import * as device from './lib/devices';
import { Device, Simulator, Target } from './lib/commonTypes';
import { getOrPickTarget } from './targetPicker';
import type { ChildProcess } from 'child_process';

let context: vscode.ExtensionContext;
let debugserverProcesses: {[port: number]: ChildProcess} = {};


async function resolveArgs<T extends {target?: Target}>(args: T): Promise<T>
{
	if (!args.target)
	{
		args.target = await getOrPickTarget();
	}

	return args;
}

function logAndThrow(e: any) {
	logger.error(e);
	throw e;
}

export async function simulatorInstall(args: {target: Simulator, path: string})
{
	let {target, path} = await resolveArgs(args);

	return vscode.window.withProgress({
		"location": vscode.ProgressLocation.Notification,
		"title": "Simulator",
		"cancellable": false
	}, (progress, token) => {
		return Promise.resolve()
			.then(() => progress.report({message: "Booting"}))
			.then(() => simulator.boot(target))
			.then(() => progress.report({message: "Installing app"}))
			.then(() => simulator.install(target, path))
			.catch((e) => {
				logger.error(e);
				vscode.window.showErrorMessage("Failed to install app on simulator");
			});;;
	});
}

export async function simulatorLaunch(a: {target: Simulator, bundleId: string, args: string[], env: {[key: string]: string}, stdio: {stdout: string, stderr: string}, waitForDebugger: boolean})
{
	let {target, bundleId, args, env, stdio: {stdout, stderr}, waitForDebugger} = await resolveArgs(a);

	return vscode.window.withProgress({
		"location": vscode.ProgressLocation.Notification,
		"title": "Simulator",
		"cancellable": false
	}, (progress, token) => {
		return Promise.resolve()
			.then(() => progress.report({message: "Booting"}))
			.then(() => simulator.boot(target))
			.then(() => progress.report({message: "Lauching app"}))
			.then(() => simulator.launch(target, bundleId, args, env, {stdout, stderr}, waitForDebugger))
			.then((pid) => pid.toString())
			.catch((e) => {
				logger.error(e);
				vscode.window.showErrorMessage("Failed to launch app on simulator");
			});;;
	});
}

export async function simulatorInstallAndLaunch(a: {target: Simulator, path: string, bundleId: string, args: string[], env: {[key: string]: string}, stdio: {stdout: string, stderr: string}, waitForDebugger: boolean})
{
	let {target, path, bundleId, args, env, stdio: {stdout, stderr}, waitForDebugger} = await resolveArgs(a);

	return vscode.window.withProgress({
		"location": vscode.ProgressLocation.Notification,
		"title": "Simulator",
		"cancellable": false
	}, (progress, token) => {
		return Promise.resolve()
			.then(() => progress.report({message: "Booting"}))
			.then(() => simulator.boot(target))
			.then(() => progress.report({message: "Installing app"}))
			.then(() => simulator.install(target, path))
			.then(() => progress.report({message: "Launching app"}))
			.then(() => simulator.launch(target, bundleId, args, env, {stdout, stderr}, waitForDebugger))
			.then((pid) => pid.toString())
			.catch((e) => {
				logger.error(e);
				vscode.window.showErrorMessage("Failed to install and launch app on simulator");
			});;;
	});
}

export async function simulatorGetPidFor(args: {target: Simulator, bundleId: string})
{
	let {target, bundleId} = await resolveArgs(args);

	return simulator.getPidFor(target, bundleId)
		.then((pid) => pid.toString())
		.catch(logAndThrow);
}

export async function deviceGetPidFor(args: {target: Device, bundleId: string})
{
	let {target, bundleId} = await resolveArgs(args);

	return device.getPidFor(target, bundleId)
		.then((pid) => pid.toString())
		.catch(logAndThrow);
}

export async function deviceAppPath(args: {target: Device, bundleId: string})
{
	let {target, bundleId} = await resolveArgs(args);

	return device.getAppDevicePath(target, bundleId)
		.catch(logAndThrow);
}

export async function deviceInstall(args: {target: Device, path: string})
{
	let {target, path} = await resolveArgs(args);

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
				.then(() => device.install(target, path, cancellationToken, (event) => {
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

export async function deviceLaunch(a: {target: Device, bundleId: string, args: string[], env: {[key: string]: string}, stdio: {stdout: string, stderr: string}, waitForDebugger: boolean})
{
	let {target, bundleId, args, env, stdio: {stdout, stderr}, waitForDebugger} = await resolveArgs(a);

	return vscode.window.withProgress({
			"location": vscode.ProgressLocation.Notification,
			"title": "Launching app",
			"cancellable": false
		}, (progress, token) => {
			return Promise.resolve()
				.then(() => device.launch(target, bundleId, args, env, {stdout, stderr}, waitForDebugger))
				.then((pid) => pid.toString())
				.catch((e) => {
					logger.error(e);
					vscode.window.showErrorMessage("Failed to launch app on device");
				});;;
		});
}

export async function deviceDebugserver(args: {target: Device})
{
	let {target} = await resolveArgs(args);

	return vscode.window.withProgress({
		"location": vscode.ProgressLocation.Notification,
		"title": "Starting debugserver",
		"cancellable": true
	}, (progress, token) => {
		let cancellationToken = {cancel: () => {}};

		token.onCancellationRequested((e) => cancellationToken.cancel());

		return Promise.resolve()
			.then(() => device.debugserver(target, cancellationToken))
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