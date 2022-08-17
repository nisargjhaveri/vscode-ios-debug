# Change Log

All notable changes to the "ios-debug" extension will be documented in this file.

## v0.3.0
### Added
- Focus the simulator window automatically when attaching or continuing from breakpoints.
- Added an configuration option `ios-debug.focusSimulator` to disable/enable the new focus behaviour. 

## v0.2.2
### Added
- Logging support for Simulator, logs now appear for simulator launches as well

### Changed
- Fix: NSLog was not appearing earlier in device launches
- Open Simulator app when booting if not already open


## v0.2.1
### Added
- Better cleanup of ios-debug debugserver instances
- Support booted simulators with missing runtime

### Changed
- Minor fixes in logging


## v0.2.0
### Added
- Add support for attach request.
- Better logging in vscode output panel for troubleshooting.

### Removed
- Removed some undocumented commands exposed earlier.


## v0.1.0
### Added
- New command: `targetSdk`, which returns `iphoneos` or `iphonesimulator` depending on the selected target.
- A new sample project with vscode configuration example.

### Changed
- Update changelog
- Update readme


## v0.0.1
- Initial release