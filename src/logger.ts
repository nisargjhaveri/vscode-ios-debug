import * as vscode from 'vscode';

let channel = {
    appendLine: console.log
};

function getFormattedTime()
{
    let time = new Date();
    return `${time.getFullYear()}-${time.getMonth()+1}-${time.getDate()} ${time.getHours()}:${time.getMinutes()}`;
}

function formatSingleMessage(message: any)
{
    if (typeof(message) === "undefined") {
        return "undefined";
    }
    else if (message === null) {
        return "null";
    }
    else if (typeof message === "object") {
        return JSON.stringify(message, undefined, 4);
    }
    else if (message.toString) {
        return message.toString();
    }
}

function formatMessage(severity: "ERROR"|"WARN"|"INFO", messages: any[])
{
    let message = messages.map(formatSingleMessage).join(' ');

    return `[${getFormattedTime()}] [${severity}] ${message}`;
}

export function activate()
{
    channel = vscode.window.createOutputChannel("iOS Debug");
}

export function error(...args: any[])
{
    channel.appendLine(formatMessage("ERROR", args));
}

export function warn(...args: any[])
{
    channel.appendLine(formatMessage("WARN", args));
}

export function log(...args: any[])
{
    channel.appendLine(formatMessage("INFO", args));
}
