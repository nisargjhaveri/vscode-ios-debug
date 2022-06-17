import threading
import time
import os

def background_follow(filename):
    with open(filename, 'r') as file:
        file.seek(0, os.SEEK_END)

        while True:
            line = file.readline()

            if not line:
                time.sleep(0.1)
                continue

            print(line.rstrip("\n"), end=None)


def follow(debugger, command, result, internal_dict):
    "Follow the file in backgroud. (Usage: tail FILENAME)"

    print("Tailing %s" % command, end=None, file=result)

    background_thread = threading.Thread(None, background_follow, args=[command])
    background_thread.daemon = True
    background_thread.start()


# And the initialization code to add your commands
def __lldb_init_module(debugger, internal_dict):
    debugger.HandleCommand('command script add -f logs.follow follow')
