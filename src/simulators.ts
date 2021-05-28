import { Simulator } from './commonTypes';
import { _execFile } from './utils';

export async function listSimulators(): Promise<Simulator[]>
{
    return _execFile('xcrun', ['simctl', 'list', '--json'])
        .then(({stdout, stderr}): Simulator[] => {
            if (stderr) { console.error(stderr); }

            let simctlList = JSON.parse(stdout) || {};
            let runtimes: {[key: string]: any} = {};
            let devices: Simulator[] = [];
            
            // Add all available runtimes
            for (const runtime of simctlList.runtimes) {
                if (runtime.isAvailable) {
                    runtimes[runtime.identifier] = runtime;
                }
            }

            // Add all available devices
            for (const runtimeIdentifier of Object.keys(simctlList.devices)) {
                devices.push(
                    ...
                    simctlList.devices[runtimeIdentifier]
                        .filter((d: any) => d.isAvailable)
                        .map(({udid, name, dataPath, logPath, state}: Simulator): Simulator => ({
                            udid,
                            name,
                            type: "Simulator",
                            version: runtimes[runtimeIdentifier].version,
                            buildVersion: runtimes[runtimeIdentifier].buildversion,
                            runtime: runtimes[runtimeIdentifier].name,
                            dataPath,
                            logPath,
                            state,
                        }))
                );
            }

            devices = devices
                        .filter((d: Simulator) => d.runtime.startsWith('iOS'))
                        .sort((a: Simulator, b: Simulator) => (
                            b.runtime.localeCompare(a.runtime, undefined, {numeric: true})
                                || a.name.localeCompare(b.name, undefined, {numeric: true})
                        ));

            console.log(`Found ${devices.length} simulators`);

            return devices;
        }).catch(e => {
            console.log(e);
            return [];
        });
}

export async function isValid(simulator: Simulator): Promise<boolean>
{
    return _execFile('xcrun', ['simctl', 'list', 'devices', '--json'])
        .then(({stdout, stderr}): boolean => {
            if (stderr) { console.error(stderr); }

            let simctlList = JSON.parse(stdout) || {};
            let devices: Simulator[] = [];

            // Add all available devices
            for (const runtimeIdentifier of Object.keys(simctlList.devices)) {
                devices.push(
                    ...
                    simctlList.devices[runtimeIdentifier]
                        .filter((d: any) => d.isAvailable)
                );
            }

            devices = devices.filter((d: Simulator) => d.udid === simulator.udid);

            return !!devices.length;
        }).catch(e => {
            console.log(e);
            return false;
        });
}