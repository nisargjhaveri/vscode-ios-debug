import { Device } from './commonTypes';
import * as path from 'path';
import * as fs from 'fs';
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
    console.log(`Using ${IOS_DEPLOY}`);

    return _execFile(IOS_DEPLOY, ['--detect', '--timeout', '1', '--json'])
        .then(({stdout, stderr}): Device[] => {
            if (stderr) { console.error(stderr); }

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

            console.log(`Found ${devices.length} devices`);

            return devices;
        }).catch(e => {
            console.log(e);
            return [];
        });
}

export async function isValid(target: Device): Promise<boolean>
{
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

        p.stderr.on('data', (data) => console.log(data));
        p.stdout.on('data', (data: Buffer) => {
            if (found) { return; }

            let match = data.toString().match(/^\[....\] Found (.*?) \(/);

            if (match && match.length > 1)
            {
                let udid = match[1];
                console.log(`Found device with udid: ${udid}`);

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
    console.log(`Installing app (path: ${path}) to device (udid: ${udid})`);
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

    console.log(`Installed in ${new Date().getTime() - time} ms`);
    console.log(`Path: ${installationPath}`);

    if (!installationPath) 
    {
        throw Error('Could not install and get path');
    }

    return installationPath;
}

export async function debugserver(udid: string, cancellationToken: {cancel(): void}, progressCallback?: (event: any) => void): Promise<{port: Number, exec: PromiseWithChild<{stdout:string, stderr:string}>}>
{
    console.log(`Starting debugserver for device (udid: ${udid})`);
    let time = new Date().getTime();

    let p = _execFile(IOS_DEPLOY, ['--id', udid, '--nolldb', '--faster-path-search', '--json']);

    cancellationToken.cancel = () => p.child.kill();

    let port: Number = await new Promise((resolve, reject) => {
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

    console.log(`Debugserver started in ${new Date().getTime() - time} ms`);

    if (!port)
    {
        throw Error('Could not start debugserver and get port');
    }
    console.log(`Port: ${port}`);

    return {
        port: port,
        exec: p,
    };
}

export async function getAppDevicePath(udid: string, appBundleId: string) {
    console.log(`Getting path for app (bundle id: ${appBundleId}) on device (udid: ${udid})`);
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

    console.log(`App device path (${appDevicePath}) retrieved in ${new Date().getTime() - time} ms`);

    return appDevicePath;
}
