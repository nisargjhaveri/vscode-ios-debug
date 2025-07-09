import threading
import time
import os
import sys

def log(message, debugger):
    """Print debug messages to the LLDB console."""
    import lldb
    interpreter = debugger.GetCommandInterpreter()
    escaped_message = message.replace('\\', '\\\\').replace('"', '\\"')
    command_result = lldb.SBCommandReturnObject()
    interpreter.HandleCommand(f'script print("{escaped_message}")', command_result)

    if not command_result.Succeeded():
        sys.stderr.write(f"Error: {command_result.GetError()}\n")

def background_follow(filename, debugger):
    with open(filename, 'r', encoding='utf-8') as file:
        file.seek(0, os.SEEK_END)

        while True:
            try:
                line = file.readline()

                if not line:
                    time.sleep(0.1)
                    continue

                log(line.rstrip("\n"), debugger)

            except UnicodeDecodeError as e:
                log(f"UnicodeDecodeError occurred while following file {filename}: {e}", debugger)

            except Exception as e:
                break


def follow(debugger, command, result, internal_dict):
    "Follow the file in background. (Usage: follow FILENAME)"

    filename = command.strip()
    if not filename:
        result.AppendMessage("Usage: follow FILENAME")
        return

    if not os.path.exists(filename):
        result.AppendMessage(f"File not found: {filename}")
        return

    result.AppendMessage(f"Tailing {filename}")

    background_thread = threading.Thread(target=background_follow, args=[filename, debugger])
    background_thread.daemon = True
    background_thread.start()


# And the initialization code to add your commands
def __lldb_init_module(debugger, internal_dict):
    debugger.HandleCommand('command script add -f logs.follow follow')
