import subprocess
import threading
import lldb

def focusSimulator(udid):
    subprocess.Popen(["open", "-a", "Simulator", "--args", "-CurrentDeviceUDID", udid])

def listen(listener, broadcaster, udid):
    event = lldb.SBEvent()

    while True:
        if listener.WaitForEventForBroadcaster(5, broadcaster, event):
            if (lldb.SBProcess.GetStateFromEvent(event) == lldb.eStateRunning):
                focusSimulator(udid)

def start_monitor(debugger, command, exe_ctx, result, internal_dict):
    "Start monitor to manage simulator window focus while debugging. (Usage: simulator-focus-monitor UDID)"
    udid = command

    process = exe_ctx.GetProcess()

    # Focus simulator if the process is currently running
    if (process.GetState() == lldb.eStateRunning):
        focusSimulator(udid)

    # Add broadcast listener for future events
    broadcaster = process.GetBroadcaster()
    listener = lldb.SBListener('simulator-focus-monitor')
    broadcaster.AddListener(listener, lldb.SBProcess.eBroadcastBitStateChanged)

    background_thread = threading.Thread(None, listen, args=[listener, broadcaster, udid])
    background_thread.daemon = True
    background_thread.start()


# And the initialization code to add your commands
def __lldb_init_module(debugger, internal_dict):
    debugger.HandleCommand('command script add -f simulator_focus.start_monitor simulator-focus-monitor')
