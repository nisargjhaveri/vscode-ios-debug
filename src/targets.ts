import { Device, Simulator, Target } from './commonTypes';
import { _execFile } from './utils';
import * as simulators from './simulators';
import * as devices from './devices';

const isValidCheckTimeout = 10000;
let lastIsValidCheck: {
    time: number,
    udid: string
} | undefined;


export async function listTargets(): Promise<Target[]>
{
    return Promise.all([devices.listDevices(), simulators.listSimulators()]).then(([dev, sim]): Target[] => {
        return (dev as Target[]).concat(sim);
    });
}

export async function isValid(target: Target): Promise<boolean>
{
    if (lastIsValidCheck
        && target.udid === lastIsValidCheck.udid
        && new Date().getTime() - lastIsValidCheck.time < isValidCheckTimeout)
    {
        return true;
    }

    lastIsValidCheck = undefined;

    let isValid = false;
    if (target.type === "Device")
    {
        isValid = await devices.isValid(target as Device);
    }
    else if (target.type === "Simulator")
    {
        isValid = await simulators.isValid(target as Simulator);
    }

    if (isValid)
    {
        lastIsValidCheck = {
            time: new Date().getTime(),
            udid: target.udid,
        };
    }

    return isValid;
}