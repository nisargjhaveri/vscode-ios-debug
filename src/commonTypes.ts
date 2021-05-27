export interface Target {
    udid: string,
    name: string,
    type: "Device" | "Simulator",
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