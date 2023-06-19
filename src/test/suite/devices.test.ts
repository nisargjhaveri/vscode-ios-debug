import * as assert from 'assert';
import * as path from 'path';
import { suiteSetup, suiteTeardown } from 'mocha';

import * as devices from '../../lib/devices';
import { _execFile } from '../../lib/utils';
import { Device } from '../../lib/commonTypes';

const testDeviceUDID = process.env["IOS_DEBUG_TEST_DEVICE"] || "";

(testDeviceUDID ? suite : suite.skip)('Devices', () => {
	suite('List devices', () => {
		let listDevices: Device[];
		suiteSetup(async function() {
			listDevices = await devices.listDevices();
		});

		test('Devices found', async function() {
			assert(listDevices.length >= 1);
		});

		test('Devices properties', async function() {
			assert(listDevices.every((d) => d.type === "Device"));
			assert(listDevices.every((d) => d.sdk === "iphoneos"));
			assert(listDevices.every((d) => d.udid && d.name));
			assert(listDevices.every((d) => d.modelName));
		});

		test('Test device listed', async function() {
			assert(listDevices.some((s) => s.udid === testDeviceUDID));
		});
	});


	suite('Device actions', () => {
		let launchPid: number;
		let installAppBundlePath: string;

		test('Install Sample App', async function() {
			let appPath = path.resolve(__dirname, "../../../examples/Sample App/build/Debug-iphoneos/Sample App.app");
			installAppBundlePath = await devices.install(testDeviceUDID, appPath, {}, (e) => {
				// Do nothing for now
			});
		}).timeout(20_000);

		test('Install app wrong path', async function() {
			let appPath = path.resolve(__dirname, "../../../examples/Sample App/build/Debug-iphoneos/Wrong App.app");
			assert.rejects(devices.install(testDeviceUDID, appPath, {}, (e) => {
				// Do nothing for now
			}), "Could not install and get path");
		});

		test('Install app wrong device', async function() {
			let appPath = path.resolve(__dirname, "../../../examples/Sample App/build/Debug-iphoneos/Sample App.app");
			assert.rejects(devices.install("DEVICE_NOT_EXISTS", appPath, {}, (e) => {
				// Do nothing for now
			}), "Could not install and get path");
		}).timeout(5_000);

		test('Get pid failure', async function() {
			assert.rejects(devices.getPidFor(testDeviceUDID, "com.ios-debug.Sample-App"), /Could not find pid for/);
		}).timeout(5_000);;

		test('Get app path on device', async function() {
			let appBundlePath = await devices.getAppDevicePath(testDeviceUDID, "com.ios-debug.Sample-App");

			assert.strictEqual(appBundlePath, installAppBundlePath);
		}).timeout(5_000);;

		test('Launch Sample App', async function() {
			let appPath = path.resolve(__dirname, "../../../examples/Sample App/build/Debug-iphoneos/Sample App.app");
			launchPid = await devices.launch(
				testDeviceUDID,
				appPath
			);

			assert(launchPid > 0);
		}).timeout(10_000);

		test('Get pid success', async function() {
			const pid = await devices.getPidFor(testDeviceUDID, "com.ios-debug.Sample-App");
			assert.strictEqual(pid, launchPid);
		}).timeout(5_000);

		test('Start debugserver', async function() {
			const {port, exec} = await devices.debugserver(testDeviceUDID, {}, (e) => {
				// Do nothing for now
			});
			assert(port > 0);
			assert(exec.child.kill());
		}).timeout(10_000);

	});

});
