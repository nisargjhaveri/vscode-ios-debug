export type TargetType = "Device" | "Simulator";

export interface Target {
    udid: string,
    name: string,
    type: TargetType,
    version: string,
    buildVersion: string,
    runtime: string,
    sdk: string,
};

export interface Simulator extends Target {
    type: "Simulator",
    dataPath: string,
    logPath: string,
    state: "Booted" | "Shutdown",
}

export type TargetSource = "local" | "companion";

export interface Device extends Target {
    type: "Device",
    modelName: string,
    source: TargetSource,
}