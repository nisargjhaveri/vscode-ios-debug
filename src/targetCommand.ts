import * as vscode from 'vscode';
import * as simulator from './simulators';
import * as device from './devices';
import { PromiseWithChild } from 'child_process';


async function resolveArgs(args: any)
{
	if (!args.udid)
	{
		args.udid = await vscode.commands.executeCommand('ios-device.targetUDID');
	}

	return args;
}

export async function simulatorInatall(args: {udid: string, path: string})
{
	let {udid, path} = await resolveArgs(args);

	return Promise.resolve()
		.then(() => simulator.boot(udid))
		.then(() => simulator.install(udid, path));
}

export async function simulatorLaunch(args: {udid: string, bundleId: string})
{
	let {udid, bundleId} = await resolveArgs(args);

	return Promise.resolve()
		.then(() => simulator.boot(udid))
		.then(() => simulator.launch(udid, bundleId, true))
		.then((pid) => pid.toString());
}

export async function simulatorInstallLaunch(args: {udid: string, path: string, bundleId: string})
{
	let {udid, path, bundleId} = await resolveArgs(args);

	return Promise.resolve()
		.then(() => simulator.boot(udid))
		.then(() => simulator.install(udid, path))
		.then(() => simulator.launch(udid, bundleId, true))
		.then((pid) => pid.toString());
}

export async function deviceInstall(args: {udid: string, path: string})
{
	let {udid, path} = await resolveArgs(args);

	return vscode.window.withProgress({
			"location": vscode.ProgressLocation.Notification,
			"title": "Installing",
			"cancellable": false
		}, (progress, token) => {
			let lastProgress = 0;
			progress.report({ increment: 0 });

			return Promise.resolve()
				.then(() => device.install(udid, path, (event) => {
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
				.then((devicePath: string) => devicePath);
		});
}

export async function deviceDebugserver(args: {udid: string})
{
	let {udid} = await resolveArgs(args);

	return vscode.window.withProgress({
		"location": vscode.ProgressLocation.Notification,
		"title": "Starting debugserver",
		"cancellable": false
	}, (progress, token) => {
		return Promise.resolve()
			.then(() => device.debugserver(udid))
			.then(({port, exec}) => {

				let task = new vscode.Task({type: "ios-device"}, vscode.TaskScope.Workspace, "debugserver", "ios-device", new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
					return new DebugserverTaskTerminal(exec, port);
				}));

				vscode.tasks.executeTask(task);

				return port.toString();
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