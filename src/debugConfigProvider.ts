import * as path from 'path';
import * as vscode from 'vscode';
import * as logger from './lib/logger';
import { Device, Simulator, Target, TargetType } from './lib/commonTypes';
import { randomString } from './lib/utils';
import * as targetCommand from './targetCommand';
import { getTargetFromUDID, pickTarget, getOrPickTarget } from './targetPicker';
import * as simulatorFocus from './simulatorFocus';
import { getIosMajorVersion } from './lib/targets';

let context: vscode.ExtensionContext;

const lldbPlatform: {[T in TargetType]: string} = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "Simulator": "ios-simulator",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "Device": "remote-ios"
};

function getOutputBasename() {
    return path.join('/tmp', `ios-${randomString(16)}`);
}

export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider
{
    private async getTarget(iosTarget: string): Promise<Target|undefined> {
        if (iosTarget === "select") {
            return await pickTarget();
        }
        else if (iosTarget === "last-selected") {
            return await getOrPickTarget();
        }
        else if (typeof iosTarget === "string") {
            return await getTargetFromUDID(iosTarget);
        }
        
        return undefined;
    }

    ensureBundleId(dbgConfig: vscode.DebugConfiguration): string {
        if (!dbgConfig.iosBundleId) {
            throw new Error("Could not determine bundle id for the app");
        }

        return dbgConfig.iosBundleId;
    }

    private shouldUseDevicectl(target: Device): boolean {
        return getIosMajorVersion(target) >= 17;
    }

    async resolveDebugConfiguration(folder: vscode.WorkspaceFolder|undefined, dbgConfig: vscode.DebugConfiguration, token: vscode.CancellationToken) {
        logger.log("resolveDebugConfiguration", dbgConfig);

        if (!dbgConfig.iosTarget) { return dbgConfig; }

        let target: Target|undefined = await this.getTarget(dbgConfig.iosTarget);
        if (!target) { return null; }

        dbgConfig.iosTarget = target;

        dbgConfig.iosRequest = dbgConfig.request;
        dbgConfig.request = target.type === "Simulator" ? "attach" : dbgConfig.request;

        dbgConfig.initCommands = (dbgConfig.initCommands instanceof Array) ? dbgConfig.initCommands : [];
        dbgConfig.initCommands.unshift(`command script import '${context.asAbsolutePath("lldb/logs.py")}'`);
        dbgConfig.initCommands.unshift(`command script import '${context.asAbsolutePath("lldb/simulator_focus.py")}'`);
        dbgConfig.initCommands.unshift(`platform select ${lldbPlatform[target.type]}`);

        return dbgConfig;
    }

    async resolveDebugConfigurationWithSubstitutedVariables(folder: vscode.WorkspaceFolder|undefined, dbgConfig: vscode.DebugConfiguration, token: vscode.CancellationToken) {
        logger.log("resolveDebugConfigurationWithSubstitutedVariables", dbgConfig);

        if (!dbgConfig.iosTarget) { return dbgConfig; }

        if (dbgConfig.sessionName) {
            dbgConfig.name = dbgConfig.sessionName;
        }

        // Enable OS_ACTIVITY_DT_MODE by default unless disabled for both Simulator and Device
        // This is required for logging to work properly
        dbgConfig.env = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "OS_ACTIVITY_DT_MODE": "YES",
            ...dbgConfig.env
        };

        if (typeof dbgConfig.iosInstallApp === "undefined") {
            dbgConfig.iosInstallApp = true;
        }

        let target: Target = dbgConfig.iosTarget;

        if (target.type === "Simulator")
        {
            let pid: string|void;

            // Check if we have enough permissions for the simulator focus monitor.
            let enableSimulatorFocusMonitor = vscode.workspace.getConfiguration().get('ios-debug.focusSimulator') && await simulatorFocus.tryEnsurePermissions();

            if (dbgConfig.iosRequest === "launch")
            {
                let outputBasename = getOutputBasename();
                let stdout = `${outputBasename}-stdout`;
                let stderr = `${outputBasename}-stderr`;

                if (dbgConfig.iosInstallApp) {
                    pid = await targetCommand.simulatorInstallAndLaunch({
                        target: target as Simulator,
                        path: dbgConfig.program,
                        bundleId: this.ensureBundleId(dbgConfig),
                        env: dbgConfig.env,
                        args: dbgConfig.args,
                        stdio: {stdout, stderr},
                        waitForDebugger: true,
                    });
                } else {
                    pid = await targetCommand.simulatorLaunch({
                        target: target as Simulator,
                        bundleId: this.ensureBundleId(dbgConfig),
                        env: dbgConfig.env,
                        args: dbgConfig.args,
                        stdio: {stdout, stderr},
                        waitForDebugger: true,
                    });
                }

                dbgConfig.initCommands.push(`follow ${stdout}`);
                dbgConfig.initCommands.push(`follow ${stderr}`);
            }
            else
            {
                pid = await targetCommand.simulatorGetPidFor({
                    target: target as Simulator,
                    bundleId: this.ensureBundleId(dbgConfig),
                });
            }

            if (!pid) { return null; }

            dbgConfig.pid = pid;

            if (enableSimulatorFocusMonitor) {
                dbgConfig.postRunCommands = (dbgConfig.postRunCommands instanceof Array) ? dbgConfig.postRunCommands : [];
                dbgConfig.postRunCommands.push(`simulator-focus-monitor ${target.name} – ${target.runtime}`);
            }

            delete dbgConfig.env;
            delete dbgConfig.args;
        }
        else if (target.type === "Device")
        {
            let platformPath: string|void = undefined;
            if (dbgConfig.iosRequest === "launch")
            {
                if (dbgConfig.iosInstallApp) {
                    platformPath = await targetCommand.deviceInstall({
                        target: target as Device,
                        path: dbgConfig.program,
                    });
                }

                if (this.shouldUseDevicectl(target as Device)) {
                    let outputBasename = getOutputBasename();
                    let stdout = `${outputBasename}-stdout`;
                    let stderr = `${outputBasename}-stderr`;
                    
                    const pid = await targetCommand.deviceLaunch({
                        target: target as Device,
                        bundleId: this.ensureBundleId(dbgConfig),
                        env: dbgConfig.env,
                        args: dbgConfig.args,
                        stdio: {stdout, stderr},
                        waitForDebugger: true,
                    });

                    if (!pid) { return null; }

                    dbgConfig.pid = pid;

                    dbgConfig.initCommands.push(`follow ${stdout}`);
                    dbgConfig.initCommands.push(`follow ${stderr}`);

                    delete dbgConfig.env;
                    delete dbgConfig.args;
                }
            }
            else
            {
                let pid = await targetCommand.deviceGetPidFor({
                    target: target as Device,
                    bundleId: this.ensureBundleId(dbgConfig),
                });

                if (!pid) { return null; }

                dbgConfig.pid = pid;
            }

            if (!platformPath) {
                platformPath = await targetCommand.deviceAppPath({
                    target: target as Device,
                    bundleId: this.ensureBundleId(dbgConfig),
                });
            }

            if (!platformPath) { return null; }

            dbgConfig.preRunCommands = (dbgConfig.preRunCommands instanceof Array) ? dbgConfig.preRunCommands : [];
            dbgConfig.preRunCommands.push(`script lldb.target.module[0].SetPlatformFileSpec(lldb.SBFileSpec('${platformPath}'))`);

            if (this.shouldUseDevicectl(target as Device)) {
                dbgConfig.processCreateCommands = (dbgConfig.processCreateCommands instanceof Array) ? dbgConfig.processCreateCommands : [];
                dbgConfig.processCreateCommands.push(`script lldb.debugger.HandleCommand("device select ${target.udid}")`);
                dbgConfig.processCreateCommands.push(`script lldb.debugger.HandleCommand("device process attach -c --pid ${dbgConfig.pid}")`);
            } else {
                let debugserverPort = await targetCommand.deviceDebugserver({
                    target: target as Device,
                });
                if (!debugserverPort) { return null; }

                dbgConfig.iosDebugserverPort = debugserverPort;
                dbgConfig.preRunCommands.push(`process connect connect://127.0.0.1:${debugserverPort}`);
            }
        }

        logger.log("resolved debug configuration", dbgConfig);
        return dbgConfig;
    }
}

export function activate(c: vscode.ExtensionContext) {
    context = c;
}