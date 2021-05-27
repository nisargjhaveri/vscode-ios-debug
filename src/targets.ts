import { Target } from './commonTypes';
import { _execFile } from './utils';
import * as simulators from './simulators';
import * as devices from './devices';


export async function listTargets(): Promise<Target[]>
{
    return Promise.all([devices.listDevices(), simulators.listSimulators()]).then(([dev, sim]): Target[] => {
        return (dev as Target[]).concat(sim);
    });
}
