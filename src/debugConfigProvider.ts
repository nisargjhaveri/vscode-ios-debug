import * as vscode from 'vscode';
import { Target, TargetType } from './commonTypes';
import * as targetCommand from './targetCommand';
import { getTargetFromUDID, pickTarget, _getOrPickTarget } from './targetPicker';

const lldbPlatform: {[T in TargetType]: string} = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "Simulator": "ios-simulator",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "Device": "remote-ios"
};

export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider
{
    private async getTarget(iosTarget: string): Promise<Target|undefined> {
        if (iosTarget === "select") {
            return await pickTarget();
        }
        else if (iosTarget === "last-selected") {
            return await _getOrPickTarget();
        }
        else if (typeof iosTarget === "string") {
            return await getTargetFromUDID(iosTarget);
        }
        
        return undefined;
    }

    async resolveDebugConfiguration(folder: vscode.WorkspaceFolder|undefined, dbgConfig: vscode.DebugConfiguration, token: vscode.CancellationToken) {
        console.log(dbgConfig);

        if (!dbgConfig.iosTarget) { return dbgConfig; }

        let target: Target|undefined = await this.getTarget(dbgConfig.iosTarget);
        if (!target) { return null; }

        dbgConfig.iosTarget = target;

        dbgConfig.request = target.type === "Simulator" ? "attach" : dbgConfig.request;

        dbgConfig.initCommands = (dbgConfig.initCommands instanceof Array) ? dbgConfig.initCommands : [];
        dbgConfig.initCommands.unshift(`platform select ${lldbPlatform[target.type]}`);

        return dbgConfig;
    }

    async resolveDebugConfigurationWithSubstitutedVariables(folder: vscode.WorkspaceFolder|undefined, dbgConfig: vscode.DebugConfiguration, token: vscode.CancellationToken) {
        console.log(dbgConfig);

        if (!dbgConfig.iosTarget) { return dbgConfig; }

        if (dbgConfig.sessionName) {
            dbgConfig.name = dbgConfig.sessionName;
        }

        let target: Target = dbgConfig.iosTarget;

        if (target.type === "Simulator")
        {
            let pid = await targetCommand.simulatorInstallAndLaunch({
                udid: target.udid,
                path: dbgConfig.program,
                bundleId: dbgConfig.iosBundleId,
                env: dbgConfig.env,
                args: dbgConfig.args,
                waitForDebugger: true,
            });
            if (!pid) { return null; }

            dbgConfig.pid = pid;

            delete dbgConfig.env;
            delete dbgConfig.args;
        }
        else if (target.type === "Device")
        {
            let platformPath = await targetCommand.deviceInstall({
                udid: target.udid,
                path: dbgConfig.program,
            });
            if (!platformPath) { return null; }

            let debugserverPort = await targetCommand.deviceDebugserver({
                udid: target.udid,
            });
            if (!debugserverPort) { return null;}

            dbgConfig.preRunCommands = (dbgConfig.preRunCommands instanceof Array) ? dbgConfig.preRunCommands : [];
            dbgConfig.preRunCommands.push(`script lldb.target.module[0].SetPlatformFileSpec(lldb.SBFileSpec('${platformPath}'))`);
            dbgConfig.preRunCommands.push(`process connect connect://127.0.0.1:${debugserverPort}`);
        }

        return dbgConfig;
    }
}