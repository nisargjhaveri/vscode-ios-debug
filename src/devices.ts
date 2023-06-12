import { Device } from './commonTypes';
import * as path from 'path';
import * as fs from 'fs';
import * as logger from './logger';
import { _execFile } from './utils';
import { PromiseWithChild, spawn } from 'child_process';
import * as StreamValues from 'stream-json/streamers/StreamValues';

let IOS_DEPLOY = "ios-deploy";

{
    const iosDeployPackagePath = require.resolve('ios-deploy/package.json');
    const binRelativePath = require(iosDeployPackagePath).bin['ios-deploy'] || 'build/Release/ios-deploy';
    const iosDeployPath = path.join(path.dirname(iosDeployPackagePath), binRelativePath);

    if (fs.existsSync(iosDeployPath))
    {
        IOS_DEPLOY = iosDeployPath;
    }
}

export async function listDevices(): Promise<Device[]>
{
    logger.log(`Listing devices using ${IOS_DEPLOY}`);

    return _execFile(IOS_DEPLOY, ['--detect', '--timeout', '1', '--json'])
        .then(({stdout, stderr}): Device[] => {
            if (stderr) { logger.error(stderr); }

            stdout = `[${stdout.replace(/\n\}\{\n/g, '\n},{\n')}]`;

            let devices: Device[] = JSON.parse(stdout) || {};

            devices = devices
                .filter((d: any) => d.Event === 'DeviceDetected')
                .map((d: any) => d.Device)
                .map((d: any): Device => ({
                    udid: d.DeviceIdentifier as string,
                    name: d.DeviceName,
                    type: "Device",
                    version: d.ProductVersion,
                    buildVersion: d.BuildVersion,
                    runtime: `iOS ${d.ProductVersion}`,
                    sdk: "iphoneos",
                    modelName: d.modelName,
                }));

                logger.log(`Found ${devices.length} devices`);

            return devices;
        }).catch((e: any) => {
            logger.log(`Could not find any connected device: ${e.toString().trimEnd()}`);
            e.stderr && logger.error(e.stderr);

            return [];
        });
}

export async function isValid(target: Device): Promise<boolean>
{
    logger.log(`Checking if device (udid: ${target.udid}) is still valid`);

    return new Promise((resolve, reject) => {
        let found = false;

        let p = spawn(IOS_DEPLOY, ['--detect', '--timeout', '1']);

        p.on('error', (e) => {
            if (!found)
            {
                reject(e);
            }
        });

        p.on('close', (code, signal) => {
            if (!found)
            {
                resolve(false);
            }
        });

        p.stderr.on('data', (data) => logger.log(data));
        p.stdout.on('data', (data: Buffer) => {
            if (found) { return; }

            let match = data.toString().match(/^\[....\] Found (.*?) \(/);

            if (match && match.length > 1)
            {
                let udid = match[1];
                logger.log(`Found device with udid: ${udid}`);

                if (udid === target.udid)
                {
                    found = true;
                    p.kill();

                    resolve(true);
                }
            }
        });
    });
}

export async function install(udid: string, path: string, cancellationToken: {cancel?(): void}, progressCallback?: (event: any) => void): Promise<string>
{
    logger.log(`Installing app (path: ${path}) to device (udid: ${udid})`);
    let time = new Date().getTime();

    let installationPath: string|undefined = undefined;

    let p = _execFile(IOS_DEPLOY, ['--id', udid, '--faster-path-search', '--timeout', '3', '--bundle', path, '--app_deltas', '/tmp/', '--json']);

    cancellationToken.cancel = () => p.child.kill();

    p.child.stdout?.pipe(StreamValues.withParser())
        .on('data', (data) => {
            let event = data.value;

            if (event.Event === "BundleInstall" && event.Status === "Complete")
            {
                installationPath = event.Path;
            }

            progressCallback && progressCallback(event);
        });

    await p;

    logger.log(`Installed in ${new Date().getTime() - time} ms`);
    logger.log(`Path: ${installationPath}`);

    if (!installationPath) 
    {
        throw Error('Could not install and get path');
    }

    return installationPath;
}

export async function debugserver(udid: string, cancellationToken: {cancel(): void}, progressCallback?: (event: any) => void): Promise<{port: number, exec: PromiseWithChild<{stdout:string, stderr:string}>}>
{
    logger.log(`Starting debugserver for device (udid: ${udid})`);
    let time = new Date().getTime();

    let p = _execFile(IOS_DEPLOY, ['--id', udid, '--nolldb', '--faster-path-search', '--json']);

    cancellationToken.cancel = () => p.child.kill();

    let port: number = await new Promise((resolve, reject) => {
        p.catch(reject);

        p.child.stdout?.pipe(StreamValues.withParser())
            .on('data', (data) => {
                let event = data.value;

                if (event.Event === "DebugServerLaunched")
                {
                    resolve(event.Port);
                }

                progressCallback && progressCallback(event);
            });
    });

    logger.log(`Debugserver started in ${new Date().getTime() - time} ms`);

    if (!port)
    {
        throw Error('Could not start debugserver and get port');
    }
    logger.log(`Debugserver Port: ${port}`);

    return {
        port: port,
        exec: p,
    };
}

export async function getAppDevicePath(udid: string, appBundleId: string) {
    logger.log(`Getting path for app (bundle id: ${appBundleId}) on device (udid: ${udid})`);
    let time = new Date().getTime();

    let p = _execFile(IOS_DEPLOY, ['--id', udid, '--list_bundle_id', '--json', '-k', 'Path']);

    let appDevicePath: string|undefined = await new Promise((resolve, reject) => {
        p.catch(reject);

        let eventFound = false;
        p.child.stdout?.pipe(StreamValues.withParser())
            .on('data', (data) => {
                let event = data.value;

                if (event.Event === "ListBundleId")
                {
                    eventFound = true;

                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    let apps: {[appBundleId: string]: {"CFBundleIdentifier": string, "Path": string}} = event.Apps;
                    resolve(appBundleId in apps ? apps[appBundleId]?.Path : undefined);
                }
            })
            .on("end", () => {
                if (!eventFound) {
                    resolve(undefined);
                }
            });
    });

    await p;

    logger.log(`App device path (${appDevicePath}) retrieved in ${new Date().getTime() - time} ms`);

    return appDevicePath;
}

export async function getPidFor(udid: string, appBundleId: string): Promise<Number>
{
    logger.log(`Getting pid for app (bundle id: ${appBundleId}) on device (udid: ${udid})`);
    let time = new Date().getTime();

    let p = _execFile(IOS_DEPLOY, ['--id', udid, '--faster-path-search', '--timeout', '3', '--get_pid', '--bundle_id', appBundleId, '--json']);

    let pid: number = await new Promise((resolve, reject) => {
        p.catch(reject);

        let eventFound = false;
        p.child.stdout?.pipe(StreamValues.withParser())
            .on('data', (data) => {
                let event = data.value;

                if (event.Event === "GetPid")
                {
                    eventFound = true;

                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    let pid: number = event.pid;
                    if (pid >= 0) {
                        resolve(pid);
                    }
                    else {
                        reject(new Error(`Could not find pid for ${appBundleId}`));
                    }
                }
            })
            .on("end", () => {
                if (!eventFound) {
                    reject(new Error(`Could not find pid for ${appBundleId}`));
                }
            });
    });

    await p;

    logger.log(`Got pid "${pid}" in ${new Date().getTime() - time} ms`);

    return pid;
}
