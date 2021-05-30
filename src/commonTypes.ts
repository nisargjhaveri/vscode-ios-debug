export type TargetType = "Device" | "Simulator";

export interface Target {
    udid: string,
    name: string,
    type: TargetType,
    version: string,
    buildVersion: string,
    runtime: string,
};

export interface Simulator extends Target {
    type: "Simulator",
    dataPath: string,
    logPath: string,
    state: "Booted" | "Shutdown",
}

export interface Device extends Target {
    type: "Device",
    modelName: string,
}