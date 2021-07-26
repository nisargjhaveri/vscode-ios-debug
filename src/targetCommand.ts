import * as vscode from 'vscode';
import * as simulator from './simulators';
import * as device from './devices';
import { PromiseWithChild } from 'child_process';


async function resolveArgs(args: any)
{
	if (!args.udid)
	{
		args.udid = await vscode.commands.executeCommand('ios-debug.targetUDID');
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
				vscode.window.showErrorMessage("Failed to launch app on simulator");
			});;;
	});
}

export async function simulatorInstallAndLaunch(a: {udid: string, path: string, bundleId: string, args?: string[], env?: {[key: string]: string}, waitForDebugger: boolean})
{
	let {udid, path, bundleId, args, env, waitForDebugger} = await resolveArgs(a);

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
			.then(() => simulator.launch(udid, bundleId, args, env, waitForDebugger))
			.then((pid) => pid.toString())
			.catch((e) => {
				vscode.window.showErrorMessage("Failed to install and launch app on simulator");
			});;;
	});
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
					console.log(event);

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

				let task = new vscode.Task({type: "ios-debug"}, vscode.TaskScope.Workspace, "debugserver", "ios-debug", new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
					return new DebugserverTaskTerminal(exec, port);
				}));
				task.presentationOptions = {
					focus: false,
					reveal: vscode.TaskRevealKind.Never
				};

				vscode.tasks.executeTask(task);

				return port.toString();
			})
			.catch((e) => {
				vscode.window.showErrorMessage("Failed to start debugserver");
			});
	});
}

class DebugserverTaskTerminal implements vscode.Pseudoterminal {
	private writeEmitter = new vscode.EventEmitter<string>();
	onDidWrite: vscode.Event<string> = this.writeEmitter.event;
	private closeEmitter = new vscode.EventEmitter<number>();
	onDidClose?: vscode.Event<number> = this.closeEmitter.event;

	constructor(private exec: PromiseWithChild<any>, private port: Number) {}

	open(initialDimensions: vscode.TerminalDimensions | undefined): void {
		this.writeEmitter.fire(`Debugserver started on port: ${this.port}\r\n`);

		if (this.exec.child.killed || this.exec.child.exitCode !== null) 
		{
			this.writeEmitter.fire(`Debugserver closed with exit code: ${this.exec.child.exitCode}\r\n`);
			this.closeEmitter.fire(0);
			return;
		}

		this.exec.child.on('close', (code, signal) => {
			this.writeEmitter.fire(`Debugserver closed on signal: ${signal} with exit code: ${code}\r\n`);
			this.closeEmitter.fire(0);
		});
	}

	close(): void {}

	handleInput(data: string): void {
		if (data === "\u0003")
		{
			this.exec.child.kill();
			this.writeEmitter.fire("^C");
		}
	}
}