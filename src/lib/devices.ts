import { Device, TargetSource } from './commonTypes';
import * as path from 'path';
import * as fs from 'fs';
import * as logger from './logger';
import { _execFile } from './utils';
import { PromiseWithChild, spawn } from 'child_process';
import * as StreamValues from 'stream-json/streamers/StreamValues';
import { getIosMajorVersion } from './targets';
import { randomString } from './utils';

let IOS_DEPLOY = "ios-deploy";
let OVERRIDE_USBMUXD_DYLIB = "";

{
    let binDir = path.resolve(__dirname, "../bin");
    binDir = fs.existsSync(binDir) ? binDir : path.resolve(__dirname, "../../bin");

    const iosDeployPath = path.join(binDir, "ios-deploy");
    if (fs.existsSync(iosDeployPath))
    {
        IOS_DEPLOY = iosDeployPath;
    }

    const overrideUsbmuxdDylibPath = path.join(binDir, "override-usbmuxd.dylib");
    if (fs.existsSync(overrideUsbmuxdDylibPath))
    {
        OVERRIDE_USBMUXD_DYLIB = overrideUsbmuxdDylibPath;
    }
}

let companionUsbmuxdSocketPath: string|undefined;

function isSourceAvailable(source: TargetSource) {
    switch (source) {
        case "local":
            return true;
        case "companion":
            return OVERRIDE_USBMUXD_DYLIB && companionUsbmuxdSocketPath;
    }
}

function getIosDeployEnvForSource(source: TargetSource): NodeJS.ProcessEnv {
    if (!isSourceAvailable(source)) {
        // We should not reach here!
        throw new Error(`Source "${source}" is not available`);
    }

    switch (source) {
        case "companion":
            return {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                "USBMUXD_OVERRIDE": companionUsbmuxdSocketPath,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                "DYLD_INSERT_LIBRARIES": OVERRIDE_USBMUXD_DYLIB,
            };
        case "local":
            return {};
    }
}

export function setCompanionUsbmuxdSocketPath(path?: string) {
    companionUsbmuxdSocketPath = path;
}

export async function listDevices(source: TargetSource): Promise<Device[]>
{
    if (!isSourceAvailable(source)) {
        return [];
    }

    logger.log(`Listing devices using ${IOS_DEPLOY}, source ${source}`);

    return _execFile(IOS_DEPLOY, ['--detect', '--timeout', '1', '--json'], { env: getIosDeployEnvForSource(source) })
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
                    source,
                }));

                logger.log(`Found ${devices.length} devices for source ${source}`);

            return devices;
        }).catch((e: any) => {
            logger.log(`Could not find any connected device for source ${source}: ${e.toString().trimEnd()}`);
            e.stderr && logger.error(e.stderr);

            return [];
        });
}

export async function isValid(target: Device): Promise<boolean>
{
    logger.log(`Checking if device (udid: ${target.udid}) is still valid`);

    return new Promise((resolve, reject) => {
        let found = false;

        let p = spawn(IOS_DEPLOY, ['--detect', '--timeout', '1'], { env: getIosDeployEnvForSource(target.source) });

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

function shouldUseDevicectl(target: Device): boolean {
    return getIosMajorVersion(target) >= 17;
}

function getOutputBasename() {
    return path.join('/tmp', `ios-${randomString(16)}`);
}

export async function install(target: Device, path: string, cancellationToken: {cancel?(): void}, progressCallback?: (event: any) => void): Promise<string>
{
    if (shouldUseDevicectl(target)) {
        return await installUsingDevicectl(target, path, cancellationToken, progressCallback);
    } else {
        return await installUsingIOSDeploy(target, path, cancellationToken, progressCallback);
    }
}

async function installUsingDevicectl(target: Device, path: string, cancellationToken: {cancel?(): void}, progressCallback?: (event: any) => void): Promise<string>
{
    logger.log(`Installing app (path: ${path}) to device (udid: ${target.udid})`);
    let time = new Date().getTime();

    let installationPath: string|undefined = undefined;
    let installationError: string|undefined = undefined;

    let outputBasename = getOutputBasename();
    let stdout = `${outputBasename}-stdout`;

    let p = _execFile(
        'xcrun',
        ['devicectl', 'device', 'install', 'app', '--device', target.udid, '--json-output', stdout, path],
        { env: getIosDeployEnvForSource(target.source) }
    );

    cancellationToken.cancel = () => p.child.kill();

    // The output of devicectl is not in JSON format, so we use --json-output to write the JSON output to a file, and then parse the file.
    p.child.stdout?.on('finish', () => {
        let json = fs.readFileSync(stdout, 'utf8');
        let result = JSON.parse(json);

        if (result.result?.installedApplications?.length)
        {
            installationPath = result.result.installedApplications[0].installationURL;
        } else if (result.error) {
            installationError = result.error.userInfo.NSLocalizedDescription.string;
        }
    });

    await p;

    logger.log(`Installed in ${new Date().getTime() - time} ms`);
    logger.log(`Path: ${installationPath}`);

    if (installationError) 
    {
        throw Error(installationError);
    }

    if (!installationPath) 
    {
        throw Error('Could not install and get path');
    }

    return installationPath;
}

async function installUsingIOSDeploy(target: Device, path: string, cancellationToken: {cancel?(): void}, progressCallback?: (event: any) => void): Promise<string>
{
    logger.log(`Installing app (path: ${path}) to device (udid: ${target.udid})`);
    let time = new Date().getTime();

    let installationPath: string|undefined = undefined;

    // Use the spawn method instead of _execFile because stdout maxBuffer length may be exceeded.
    let p = spawn(
        IOS_DEPLOY,
        ['--id', target.udid, '--faster-path-search', '--timeout', '3', '--bundle', path, '--app_deltas', '/tmp/', '--json'],
        { env: getIosDeployEnvForSource(target.source) }
    );

    cancellationToken.cancel = () => p.kill();

    p.stdout?.pipe(StreamValues.withParser())
        .on('data', (data) => {
            let event = data.value;

            if (event.Event === "BundleInstall" && event.Status === "Complete")
            {
                installationPath = event.Path;
            }

            progressCallback && progressCallback(event);
        });

    installationPath = await new Promise((resolve, reject) => {
        p.on('close', (code, signal) => {
            if (!installationPath)
            {
                reject('Could not install and get path');
            }
            else
            {
                resolve(installationPath);
            }
        });
    });

    logger.log(`Installed in ${new Date().getTime() - time} ms`);
    logger.log(`Path: ${installationPath}`);

    if (!installationPath) 
    {
        throw Error('Could not install and get path');
    }

    return installationPath;
}

export async function launch(target: Device, bundleId: string, args: string[], env: {[key: string]: string}, stdio: {stdout: string, stderr: string}, waitForDebugger: boolean = false): Promise<number>
{
    logger.log(`Launching app (id: ${bundleId}) on device (udid: ${target.udid})`);
    let time = new Date().getTime();

    args = args ?? [];
    env = env ?? {};

    let devicectlEnv: {[key: string]: string} = {};

    Object.keys(env).forEach((key) => {
        devicectlEnv[`DEVICECTL_CHILD_${key}`] = env[key];
    });

    let process = spawn(
        'xcrun',
        [
            'devicectl',
            'device',
            'process',
            'launch', 
            ...(waitForDebugger ? ['--start-stopped'] : []),
            '--terminate-existing',
            '--json-output', '-',
            '--console',
            '--device', target.udid,
            bundleId,
            ...args
        ],
        {
            env: devicectlEnv
        }
    );
    process.stdout.pipe(fs.createWriteStream(stdio.stdout));
    process.stderr.pipe(fs.createWriteStream(stdio.stderr));

    // devicectl doesn't print the pid until the process terminates (output is buffered),
    // so instead get the pid once the app is launched.
    let start = new Date().getTime();
    while (new Date().getTime() - start < 30_000) {
        try {
            let pid = await getPidFor(target, bundleId);
            logger.log(`Launched in ${new Date().getTime() - time} ms`);
            return pid;
        } catch (error) {
            logger.log(`Waiting for app to launch`);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    logger.log(`Launch failed in ${new Date().getTime() - time} ms`);
    throw new Error("Could not launch and get pid");
}

export async function debugserver(target: Device, cancellationToken: {cancel?(): void}, progressCallback?: (event: any) => void): Promise<{port: number, exec: PromiseWithChild<{stdout:string, stderr:string}>}>
{
    logger.log(`Starting debugserver for device (udid: ${target.udid})`);
    let time = new Date().getTime();

    let p = _execFile(IOS_DEPLOY, ['--id', target.udid, '--nolldb', '--faster-path-search', '--json'], { env: getIosDeployEnvForSource(target.source) });

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

export async function getAppDevicePath(target: Device, appBundleId: string) {
    logger.log(`Getting path for app (bundle id: ${appBundleId}) on device (udid: ${target.udid})`);
    let time = new Date().getTime();

    let p = _execFile(IOS_DEPLOY, ['--id', target.udid, '--list_bundle_id', '--json', '-k', 'Path'], { env: getIosDeployEnvForSource(target.source) });

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
                    if (appBundleId in apps) {
                        resolve(apps[appBundleId].Path);
                    } else {
                        reject(new Error(`Could not find the app (${appBundleId}) on device. Is the app installed?`));
                    }
                }
            })
            .on("end", () => {
                if (!eventFound) {
                    reject(new Error(`Could not find the app (${appBundleId}) on device.`));
                }
            });
    });

    await p;

    logger.log(`App device path (${appDevicePath}) retrieved in ${new Date().getTime() - time} ms`);

    return appDevicePath;
}

async function getPidForUsingIOSDeploy(target: Device, appBundleId: string): Promise<number>
{
    logger.log(`Getting pid for app (bundle id: ${appBundleId}) on device (udid: ${target.udid}), using ios-deploy`);
    let time = new Date().getTime();

    let p = _execFile(
        IOS_DEPLOY,
        ['--id', target.udid, '--faster-path-search', '--timeout', '3', '--get_pid', '--bundle_id', appBundleId, '--json'],
        { env: getIosDeployEnvForSource(target.source) }
    );

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
                        reject(new Error(`Could not find pid for ${appBundleId}. Is the app running?`));
                    }
                }
            })
            .on("end", () => {
                if (!eventFound) {
                    reject(new Error(`Could not find pid for ${appBundleId}.`));
                }
            });
    });

    await p;

    logger.log(`Got pid "${pid}" in ${new Date().getTime() - time} ms`);

    return pid;
}

async function getPidForUsingDevicectl(target: Device, appBundleId: string): Promise<number> 
{
    logger.log(`Getting pid for app (bundle id: ${appBundleId}) on device (udid: ${target.udid}), using devicectl`);
    const time = new Date().getTime();

    const platformPath = await getAppDevicePath(target, appBundleId);

    const {stdout, stderr} = await _execFile(
        'xcrun',
         ['devicectl', 'device', 'info', 'processes',
          '--device', target.udid,
          '--json-output', '-']);

    let pid: number|undefined = undefined;

    const processes = JSON.parse(stdout)?.result?.runningProcesses;
    // TODO: Use --filter option of devicectl to get the process directly, once it is actually working properly.
    for (const process of processes) {
        if (process.executable && platformPath && process.executable.includes(encodeURI(platformPath))) {
            pid = process.processIdentifier;
            break;
        }
    }

    if (!pid) {
        throw new Error(`Could not find pid for ${appBundleId}. Is the app running?`);
    }

    logger.log(`Got pid "${pid}" in ${new Date().getTime() - time} ms`);

    return pid;
}

export async function getPidFor(target: Device, appBundleId: string): Promise<number> {
    if (shouldUseDevicectl(target)) {
        return await getPidForUsingDevicectl(target, appBundleId);
    } else {
        return await getPidForUsingIOSDeploy(target, appBundleId);
    }
}
