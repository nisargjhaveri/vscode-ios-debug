import * as vscode from 'vscode';
import { Target, TargetType } from './commonTypes';
import { getTargetFromUDID, pickTarget } from './targetPicker';

const lldbPlatform: {[T in TargetType]: string} = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "Simulator": "ios-simulator",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "Device": "remote-ios"
};

export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider
{
    async resolveDebugConfiguration(folder: vscode.WorkspaceFolder|undefined, dbgConfig: vscode.DebugConfiguration, token: vscode.CancellationToken) {
        console.log(dbgConfig);

        if (!dbgConfig.iosTarget) { return dbgConfig; }

        let target: Target|undefined = typeof dbgConfig.iosTarget === "string" ? await getTargetFromUDID(dbgConfig.iosTarget) : await pickTarget();
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

        let target: Target = dbgConfig.iosTarget;

        if (target.type === "Simulator")
        {
            let pid = await vscode.commands.executeCommand("ios-debug.simulator.installAndlaunchForDebug", {
                udid: target.udid,
                path: dbgConfig.program,
                bundleId: dbgConfig.iosBundleId,
                env: dbgConfig.env,
                args: dbgConfig.args,
            });
            if (!pid) { return null; }

            dbgConfig.pid = pid;

            delete dbgConfig.env;
            delete dbgConfig.args;
        }
        else if (target.type === "Device")
        {
            let platformPath = await vscode.commands.executeCommand("ios-debug.device.install", {
                udid: target.udid,
                path: dbgConfig.program,
            });
            if (!platformPath) { return null; }

            let debugserverPort = await vscode.commands.executeCommand("ios-debug.device.debugserver", {
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