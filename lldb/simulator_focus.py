import subprocess
import threading
import lldb

def focus_simulator(title):
    # This AppleScript tries to activate Simulator and get the focus on the correct Simulator window.
    # Though there are still known scenarios when this does not behave exactly as expected. See inline comments.
    raise_simulator_window = """
set windowName to "%s"

tell application "System Events" to tell application process "Simulator"
    set menuItem to menu item windowName of menu "Window" of menu bar 1
    set activateFirst to ((count of windows) is greater than 0 and not (exists window windowName))

    # In case the current space has a Simulator window open activating Simualtor always
    # opens the window in the current space. Without the Simulator being active first,
    # menu press also does not help as activating later with activate the window in the
    # current space anyway. For this case, activate first and then press menu, which should
    # change spaec and activate the correct window. The side effect is that the window in
    # the current space is also activated.
    if activateFirst then tell me to activate application "Simulator"

    perform action "AXPress" of menuItem

    # Sometimes it takes time after activate for menu item press to work as intended
    # Retry for upto 10 times with 0.2s delay until the desired window is activated
    if activateFirst then
        repeat 10 times
            if (title of window 1 is equal to windowName) then exit repeat
            perform action "AXPress" of menuItem
            delay 0.2
        end repeat
    end if

    # Activate the simulator app at the end if not already done
    if not activateFirst then tell me to activate application "Simulator"
end tell
    """ % title

    subprocess.call(["osascript", "-e", raise_simulator_window])

    # Try to activate Simulator anyway if not already active. This does not ensure that the correct simulator gets the focus.
    # This is useful in case we don't have the accessibility permission and the above command fails.
    subprocess.call(["osascript", "-e", 'tell application "System Events" to if (frontmost of application process "Simulator" is false) then tell me to activate application "Simulator"'])

def listen(listener, broadcaster, title):
    event = lldb.SBEvent()

    while True:
        if listener.WaitForEventForBroadcaster(5, broadcaster, event):
            if (lldb.SBProcess.GetStateFromEvent(event) == lldb.eStateRunning):
                focus_simulator(title)

def start_monitor(debugger, command, exe_ctx, result, internal_dict):
    "Start monitor to manage simulator window focus while debugging. (Usage: simulator-focus-monitor UDID)"
    title = command

    process = exe_ctx.GetProcess()

    # Focus simulator if the process is currently running
    if (process.GetState() == lldb.eStateRunning):
        focus_simulator(title)

    # Add broadcast listener for future events
    broadcaster = process.GetBroadcaster()
    listener = lldb.SBListener('simulator-focus-monitor')
    broadcaster.AddListener(listener, lldb.SBProcess.eBroadcastBitStateChanged)

    background_thread = threading.Thread(None, listen, args=[listener, broadcaster, title])
    background_thread.daemon = True
    background_thread.start()


# And the initialization code to add your commands
def __lldb_init_module(debugger, internal_dict):
    debugger.HandleCommand('command script add -f simulator_focus.start_monitor simulator-focus-monitor')
