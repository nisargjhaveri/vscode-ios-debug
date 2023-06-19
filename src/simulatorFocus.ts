import * as vscode from 'vscode';
import { _execFile } from './lib/utils';
import * as logger from './lib/logger';


export async function tryEnsurePermissions(): Promise<boolean> {
    // We first try the command which needs both System Events and Accessibility permissions
    // If it fails, we try a command which needs System Events permissions and ouputs if we have accessibility permission
    // If the first command succeeds, we have all the required permissions.
    // If the second fails, we don't have System Events permission.
    // If the second command succeeds but prints false, we don't have accessibility permission.
    // Otherwise some unknown error.

    try {
        await _execFile('osascript', ['-e', 'tell application "System Events" to tell application process "Simulator" to get menu bars']);

        // If we reach here, we have all the required permissions.
        return true;
    }
    catch (e) {
        logger.log(e);
    }

    try {
        let {stdout} = await _execFile('osascript', ['-e', 'tell application "System Events" to UI elements enabled']);

        // if stdout is false, we need accessibility permission
        if (stdout.trim() === "false") {
            logger.log("Get Accessibility permission");
            vscode.window.showWarningMessage(
                "Select Visual Studio Code checkbox in Security and Privacy > Accessibility. This is required to automatically focus the simulator while debugging",
                {action: "OPEN", title: "Turn on Accessibility"}
            )
                .then((action) => {
                    if (action && action.action === "OPEN") {
                        vscode.env.openExternal(vscode.Uri.parse("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"));
                    }
                });
        }

        // If we reach here, we have System Events permission, which is enoguh for basic functionality.
        return true;
    }
    catch (e) {
        logger.log(e);

        // we need AppleEvents permission first
        logger.log("Get System Events permission");
        vscode.window.showWarningMessage(
            "Select System Events checkbox for Visual Studio Code in Security and Privacy > Automation. This is required to automatically focus the simulator while debugging",
            {action: "OPEN", title: "Turn on System Events"}
        )
            .then((action) => {
                if (action && action.action === "OPEN") {
                    vscode.env.openExternal(vscode.Uri.parse("x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"));
                }
            });
    }

    // We don't have system events permission, nothing will work.
    return false;
}
