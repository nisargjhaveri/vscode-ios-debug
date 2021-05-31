import { boot, install, launch } from './simulators';

export async function simulatorInatall({udid, path}: {udid: string, path: string})
{
	return Promise.resolve()
		.then(() => boot(udid))
		.then(() => install(udid, path));
}

export async function simulatorLaunch({udid, bundleId}: {udid: string, bundleId: string})
{
	return Promise.resolve()
		.then(() => boot(udid))
		.then(() => launch(udid, bundleId, true))
		.then((pid) => pid.toString());
}

export async function simulatorInstallLaunch({udid, path, bundleId}: {udid: string, path: string, bundleId: string})
{
	return Promise.resolve()
		.then(() => boot(udid))
		.then(() => install(udid, path))
		.then(() => launch(udid, bundleId, true))
		.then((pid) => pid.toString());
}

