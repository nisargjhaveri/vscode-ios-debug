import * as vscode from 'vscode';
import * as logger from './lib/logger';
import * as targetCommand from './targetCommand';

function onDidStartDebugSession(debugSession: vscode.DebugSession) {
    logger.log("Debug session started", `(type: ${debugSession.type}, id: ${debugSession.id})`);
}

function onDidTerminateDebugSession(debugSession: vscode.DebugSession) {
    logger.log("Debug session terminated", `(type: ${debugSession.type}, id: ${debugSession.id})`);

    if (debugSession.type === 'lldb' && debugSession.configuration?.iosDebugserverPort) {
        targetCommand.deviceDebugserverCleanup(debugSession.configuration.iosDebugserverPort);
    }
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.debug.onDidStartDebugSession(onDidStartDebugSession));
    context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(onDidTerminateDebugSession));
}