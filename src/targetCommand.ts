import * as vscode from 'vscode';
import { boot, install, launch } from './simulators';

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
		.then(() => boot(udid))
		.then(() => install(udid, path));
}

export async function simulatorLaunch(args: {udid: string, bundleId: string})
{
	let {udid, bundleId} = await resolveArgs(args);

	return Promise.resolve()
		.then(() => boot(udid))
		.then(() => launch(udid, bundleId, true))
		.then((pid) => pid.toString());
}

export async function simulatorInstallLaunch(args: {udid: string, path: string, bundleId: string})
{
	let {udid, path, bundleId} = await resolveArgs(args);

	return Promise.resolve()
		.then(() => boot(udid))
		.then(() => install(udid, path))
		.then(() => launch(udid, bundleId, true))
		.then((pid) => pid.toString());
}
