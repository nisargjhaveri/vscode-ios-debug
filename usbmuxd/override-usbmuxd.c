#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/un.h>

#define DYLD_INTERPOSE(_replacement,_replacee) \
   __attribute__((used)) static struct{ const void* replacement; const void* replacee; } _interpose_##_replacee \
            __attribute__ ((section ("__DATA,__interpose"))) = { (const void*)(unsigned long)&_replacement, (const void*)(unsigned long)&_replacee };


char override_path[104] = "";
bool should_override = false;

__attribute__((constructor))
static void custom_constructor(int argc, const char **argv)
{
    char* path = getenv("USBMUXD_OVERRIDE");
    if (path != NULL && path[0] != '\0') {
        strcpy(&override_path[0], path);
        should_override = true;
    }
}

int my_connect(int socket, struct sockaddr *address, socklen_t address_len)
{
    if (should_override && address->sa_family == AF_UNIX && strcmp(address->sa_data, "/var/run/usbmuxd") == 0) {
        struct sockaddr_un* a = (struct sockaddr_un*)address;
        strcpy(a->sun_path, override_path);
    }

    return connect(socket, address, address_len);
}

DYLD_INTERPOSE(my_connect, connect);
