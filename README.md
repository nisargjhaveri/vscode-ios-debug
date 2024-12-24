# ios-debug · iOS Debugging in VS Code

Debug iOS apps directly from VS Code.

![Screen capture showing demo of iOS debugging if VS Code](./images/screencast.gif)


# Features
- Install and launch apps for debugging automatically based on the VS Code launch config.
- Debugging on both iOS devices and simulators.
- Pick a connected device or installed simulator for debugging.
- Seamlessly debug on locally connected devices when working using [VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview).
- All other debugging features supported by [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) extension.


# Requirements
- MacOS X with full Xcode installation


# Quick Start
Here is a minimal launch configuration to get you started
```json
{
    "name": "Launch App",
    "type": "lldb",
    "request": "launch",
    "program": "${workspaceFolder}/build/Debug-${command:ios-debug.targetSdk}/<app name>.app",
    "iosBundleId": "<app bundle identifier>",
    "iosTarget": "select",
},
```

Look at the [examples/Sample App/.vscode](./examples/Sample%20App/.vscode) for a working example of VS Code config for a sample app.

In addition to the launch config, [lldb.library](vscode://settings/lldb.library) needs to be set in your VS Code settings to appropriate LLDB location. Here is an example
```json
{
    "lldb.library": "/Applications/Xcode.app/Contents/SharedFrameworks/LLDB.framework/Versions/A/LLDB"
}
```

# How to use
## Launch config options
The extension depends on [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) for most debugging features and extends the same to support launching and attaching to iOS targets.

Here are some of the common options used for setting up the launch config for debugging on iOS.

When `request` is set to `launch`, the app is launched on the iOS device or simulator and attached for debugging. When `request` is set to `attach`, the debugger tries to attach to the app already launched on the iOS device or simulator.

|parameter          |type|req |         |
|-------------------|----|:--:|---------|
|**name**           |string|Y| Launch configuration name.
|**type**           |string|Y| Set to `lldb`.
|**request**        |string|Y| Set to `launch` or `attach`.
|**program**        |string|Y| Path to the built `<name>.app` file for your app.
|**iosBundleId**    |string|Y| App bundle identifier for the specified app.
|**iosTarget**      |string|Y| If this config should target iOS.<ul><li>`false` (default) if this config is not for iOS debugging</li><li>`"select"` if the target picker should be shown</li><li>`"last-selected"` if last selected target should be used if available</li></ul>
|**iosInstallApp**  |string| | Whether to install the app on target before launching. Only available with `request = launch`. <ul><li>`true` (default) Install the app specified by `program` before launching.</li><li>`false` Do not install the app. Directly launch the already installed app on the target.</li></ul>
|**args**           |[string]| | Command line parameters to pass while launching the app. Only available with `request = launch`.
|**env**            |dictionary| | Additional environment variables when launching the app. Only available with `request = launch`.


## Target selection
If you specify `"iosTarget": "select"` in your launch config, the target picket will be shown when you start the debugging.

If you want to select or change target otherwise, you can do that by the following methods.

- From the status bar item showing the previously selected target or "Select target".
- Accessing `Select iOS Target` command from the command palette.

## Commands
The extension exposes a few commands that can be used in tasks or launch config as parameters. You can use `${command:ios-debug.<command>}` inside your launch configs or task definitions, which will be resolved to the return value of the command.

- `ios-debug.targetUDID` -  Selected target's UDID
- `ios-debug.targetType` - Selected target's type. Either "Simulator" or "Device"
- `ios-debug.targetName` - Selected target's name.
- `ios-debug.targetSdk` - Selected target's sdk type. Either "iphonesimulator" or "iphoneos"

## Remote Development
> Remote development using this method is not supported on devices with iOS 17+

The extension supports debugging on locally connected devices when using [VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview). If the setup is correct, the locally connected devices will automatically be listed in the target picker.

[iOS Debug Companion](https://marketplace.visualstudio.com/items?itemName=nisargjhaveri.ios-debug-companion) extension is required for this to work. It'll automatically prompt to install this extension when needed.

`ios-debug.shareLocalDevices` configuration can be tweaked to control whether to allow debugging on local devices or not based on your requirements.

Your local machine may need additional setup for this to work depending on the OS.
- macOS: No additional setup should be required.
- Windows: [iTunes](https://www.apple.com/in/itunes/) needs to installed. Make sure "Apple Mobile Device Service (AMDS)" is running if the local devices are still not visible.
- Linux: [usbmuxd](https://github.com/libimobiledevice/usbmuxd) needs to be installed and running.


# Known limitations
- UI debugging features (e.g. Debug View Hierarchy, etc.) for iOS are out-of-scope for now. You need to use Xcode for that.
- "Restart" debugging doesn't work reliably from VS Code. You need to stop and start debugging again.
