import * as assert from 'assert';
import * as path from 'path';
import { suiteSetup, suiteTeardown } from 'mocha';

import * as simulators from '../../simulators';
import { _execFile } from '../../utils';
import { Simulator } from '../../commonTypes';

suite('Simulators', () => {
	const testSimulatorName = 'ios-debug-test-simulator';
	const testSimulatorDeviceType = 'iPhone 14';

	let testSimulatorUDID: string;

	suiteSetup(async function() {
		this.timeout(10_000);
		let {stdout, stderr } = await _execFile('xcrun', ['simctl', 'create', testSimulatorName, testSimulatorDeviceType]);
		testSimulatorUDID = stdout.trim();

		assert(testSimulatorUDID, "Could not setup test simulator");
	});

	suiteTeardown(async function() {
		this.timeout(10_000);
		await _execFile('xcrun', ['simctl', 'delete', testSimulatorUDID]);
	});


	suite('List simulators', () => {
		let listSimulators: Simulator[];
		suiteSetup(async function() {
			listSimulators = await simulators.listSimulators();
		});

		test('Simulators found', async function() {
			assert(listSimulators.length > 2);
		});

		test('Simulators properties', async function() {
			assert(listSimulators.every((s) => s.type === "Simulator"));
			assert(listSimulators.every((s) => s.sdk === "iphonesimulator"));
			assert(listSimulators.every((s) => s.udid && s.name));
			assert(listSimulators.every((s) => s.state === "Booted" || s.state === "Shutdown"));
		});

		test('Test simulator listed', async function() {
			assert(listSimulators.some((s) => s.udid === testSimulatorUDID));
		});

		test('Test simulator properties', async function() {
			const testSimulator = listSimulators.filter((s) => s.udid === testSimulatorUDID)[0];

			assert(testSimulator.name === testSimulatorName);
			assert(testSimulator.state === "Shutdown");
		});
	});


	suite('Simulator actions', () => {
		let launchPid: number;

		suiteTeardown(async function() {
			this.timeout(10_000);
			try {
				await simulators.shutdown(testSimulatorUDID);
			} catch {
				// Ignore
			}
		});

		test('First-boot test simulator', async function() {
			await simulators.boot(testSimulatorUDID);
	
			const listSimulators = await simulators.listSimulators();
			const testSimulator = listSimulators.filter((s) => s.udid === testSimulatorUDID)[0];
			assert(testSimulator.state === "Booted");
		}).timeout(240_000);

		test('Shutdown test simulator', async function() {
			await simulators.shutdown(testSimulatorUDID);

			const listSimulators = await simulators.listSimulators();
			const testSimulator = listSimulators.filter((s) => s.udid === testSimulatorUDID)[0];
			assert(testSimulator.state === "Shutdown");
		}).timeout(10_000);

		test('Boot test simulator', async function() {
			await simulators.boot(testSimulatorUDID);
	
			const listSimulators = await simulators.listSimulators();
			const testSimulator = listSimulators.filter((s) => s.udid === testSimulatorUDID)[0];
			assert(testSimulator.state === "Booted");
		}).timeout(90_000);

		test('Install Sample App', async function() {
			await simulators.boot(testSimulatorUDID);
	
			let appPath = path.resolve(__dirname, "../../../examples/Sample App/build/Debug-iphonesimulator/Sample App.app");
			await simulators.install(testSimulatorUDID, appPath);
		}).timeout(90_000);

		test('Get pid failure', async function() {
			assert.rejects(simulators.getPidFor(testSimulatorUDID, "com.ios-debug.Sample-App"), /Could not find pid for/);
		}).timeout(5_000);;

		test('Launch Sample App', async function() {
			launchPid = await simulators.launch(
				testSimulatorUDID,
				"com.ios-debug.Sample-App",
				[],
				{},
				{stdout: "/dev/null", stderr: "/dev/null"},
				false
			);

			assert(launchPid > 0);
		}).timeout(20_000);

		test('Get pid success', async function() {
			const pid = await simulators.getPidFor(testSimulatorUDID, "com.ios-debug.Sample-App");
			assert.strictEqual(pid, launchPid);
		}).timeout(5_000);

	});

});
