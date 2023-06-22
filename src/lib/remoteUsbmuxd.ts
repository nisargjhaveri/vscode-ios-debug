import * as net from 'net';
import { EventEmitter } from 'events';
import * as path from 'path';
import type { Duplex } from 'stream';
import { WebSocketServer, createWebSocketStream, AddressInfo, WebSocket } from "ws";
// @ts-ignore
import { BPMux } from "bpmux";
import * as logger from './logger';
import { randomString } from './utils';

let isClientConnected = false;

export declare interface UsbmuxdReverseProxyServer {
    on(eventName: "path-updated", listener: (usbmuxdSocketPath: string | undefined) => void): this;
    once(eventName: "path-updated", listener: (usbmuxdSocketPath: string | undefined) => void): this;
}

export class UsbmuxdReverseProxyServer extends EventEmitter {
    public usbmuxdSocketPath?: string = undefined;
    public proxyServerAddress?: string = undefined;

    constructor() {
        super();
        this.on("path-updated", (usbmuxdSocketPath) => {
            this.usbmuxdSocketPath = usbmuxdSocketPath;
        });
    }

    private handleReverseProxyConnection = (ws: WebSocket) => {
        if (isClientConnected) {
            // Only allow one connection at a time. Reject the new connection
            ws.close();
            return;
        }

        isClientConnected = true;

        const socketPath = path.join("/tmp", `usbmuxd-${randomString(8)}`);

        let wsStream = createWebSocketStream(ws);
        let mux = new BPMux(wsStream);

        mux.on("error", () => {}); // Ignore errors

        let usbmuxdSocket = net.createServer((socket: net.Socket) => {
            let muxStream: Duplex = mux.multiplex();
            muxStream.on("error", () => {}); // Ignore errors

            socket.pipe(muxStream).pipe(socket);
        }).listen(socketPath, () => {
            logger.log(`Listening for usbmuxd connection on ${socketPath}`);
            this.emit("path-updated", socketPath);
        });

        usbmuxdSocket.on("error", (e) => {
            wsStream.end();
            this.emit("path-updated", undefined);
            logger.log("Error creating remote usbmuxd socket:", e);
        });

        ws.on("error", () => {}); // Ignore errors
        ws.on("close", () => {
            this.emit("path-updated", undefined);

            isClientConnected = false;
            usbmuxdSocket.close();
            wsStream.end();
        });
    };

    public ensureUsbmuxdSocketPath = async (timeout: number = 5000): Promise<string> => {
        if (this.usbmuxdSocketPath) {
            return this.usbmuxdSocketPath;
        }

        return new Promise<string>((resolve, reject) => {
            let resolved = false;

            let timer = setTimeout(() => {
                if (resolved) {
                    return;
                }
                resolved = true;

                reject(new Error("Could not ensure remote usbmuxd socket"));
            }, timeout);

            this.once("path-updated", (usbmuxdSocketPath) => {
                if (resolved) {
                    return;
                }
                resolved = true;
                clearTimeout(timer);

                if (usbmuxdSocketPath) {
                    resolve(usbmuxdSocketPath);
                }
                else {
                    reject(new Error("Could not ensure remote usbmuxd socket"));
                }
            });
        });
    };

    public start = async (): Promise<string> => {
        const wsServer = new WebSocketServer({host: "127.0.0.1", port: 0});

        wsServer.on("connection", this.handleReverseProxyConnection);

        await new Promise<void>((resolve, reject) => {
            let resolved = false;

            wsServer.once("listening", () => {
                resolve();
                resolved = true;
            });

            wsServer.once("error", (e) => {
                if (!resolved) {
                    reject(e);
                }
            });
        });

        const addressInfo = (wsServer.address() as unknown as AddressInfo);
        this.proxyServerAddress = `ws://${addressInfo.address}:${addressInfo.port}`;
        logger.log(`Usbmuxd proxy server started on ${this.proxyServerAddress}`);

        return this.proxyServerAddress;
    };
}
