import * as vscode from 'vscode';
import * as simulator from './simulators';
import * as device from './devices';


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

					progress.report({increment: event.OverallPercent - lastProgress, message: event.Event});

					lastProgress = event.OverallPercent;
				}))
				.then((devicePath: string) => devicePath);
		});
}