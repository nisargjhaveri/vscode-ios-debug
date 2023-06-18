import * as assert from 'assert';
import { suiteSetup, suiteTeardown } from 'mocha';

import * as targets from '../../targets';
import { _execFile } from '../../utils';
import { Device, Simulator, Target } from '../../commonTypes';

const testDeviceUDID = process.env["IOS_DEBUG_TEST_DEVICE"] || "";

suite('Targets', () => {
	let listTargets: Target[];
	suiteSetup(async function() {
		listTargets = await targets.listTargets();
	});

	test('Targets found', async function() {
		assert(listTargets.length > 2);
	});
	
	(testDeviceUDID ? test : test.skip)('Device target found', async function() {
		assert(listTargets.some(t => t.type === "Device" && t.udid === testDeviceUDID));
	});

	test('Simulator targets found', async function() {
		assert(listTargets.some(t => t.type === "Simulator"));
	});

	(testDeviceUDID ? test : test.skip)('Device target is valid', async function() {
		let target = listTargets.filter(t => t.type === "Device" && t.udid === testDeviceUDID)[0];
		assert(await targets.isValid(target));
	});

	test('Device target is not valid', async function() {
		let target: Device = {
			type: "Device",
			udid: "INVALID_DEVICE",
			name: "Some name",
			modelName: "",
			sdk: "",
			version: "",
			buildVersion: "",
			runtime: ""
		};
		assert.strictEqual(await targets.isValid(target), false);
	});

	test('Simulator target is valid', async function() {
		let simulator = listTargets.filter(t => t.type === "Simulator")[0];
		assert(await targets.isValid(simulator));
	});

	test('Simulator target is not valid', async function() {
		let target: Simulator = {
			type: "Simulator",
			udid: "INVALID_SIMULATOR",
			name: "Some name",
			dataPath: "",
			logPath: "",
			state: "Shutdown",
			version: "",
			buildVersion: "",
			runtime: "",
			sdk: ""
		};
		assert.strictEqual(await targets.isValid(target), false);
	});

});
