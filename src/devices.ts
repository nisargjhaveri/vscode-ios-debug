import { Device } from './commonTypes';
import * as path from 'path';
import * as fs from 'fs';
import { _execFile } from './utils';

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
                    modelName: d.modelName,
                }));

            console.log(`Found ${devices.length} devices`);

            return devices;
        }).catch(e => {
            console.log(e);
            return [];
        });
}
