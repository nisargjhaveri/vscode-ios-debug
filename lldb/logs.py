import threading
import time
import os
import sys

def background_follow(filename):
    with open(filename, 'r', encoding='utf-8') as file:
        file.seek(0, os.SEEK_END)
        utf8_stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', closefd=False)

        while True:
            try:
                line = file.readline()
                
                if not line:
                    time.sleep(0.1)
                    continue
                    
                print(line.rstrip("\n"), end=None, file=utf8_stdout, flush=True)
                
            except UnicodeDecodeError as e:
                print(f"UnicodeDecodeError occurred while following file {filename}: f{e}")


def follow(debugger, command, result, internal_dict):
    "Follow the file in backgroud. (Usage: tail FILENAME)"

    print("Tailing %s" % command, end=None, file=result)

    background_thread = threading.Thread(None, background_follow, args=[command])
    background_thread.daemon = True
    background_thread.start()


# And the initialization code to add your commands
def __lldb_init_module(debugger, internal_dict):
    debugger.HandleCommand('command script add -f logs.follow follow')
