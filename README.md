# ios-debug · iOS Debugging in VS Code

Debug iOS apps directly from VS Code.

![Screen capture showing demo of iOS debugging if VS Code](./images/screencast.gif)


# Features
- Install and launch apps for debugging automatically based on the VS Code launch config.
- Debugging on both iOS devices and simulators.
- Pick a connected device or installed simulator for debugging.
- All other debugging features supported by [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) extension.


# Requirements
- MacOS X with full Xcode installation


# Quick Start
Here is a minimal launch configuration to get you started
```
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


# Known limitations
- UI debugging features (e.g. Debug View Hierarchy, etc.) for iOS are out-of-scope for now. You need to use Xcode for that.
- "Restart" debugging doesn't work reliably from VS Code. You need to stop and start debugging again.
