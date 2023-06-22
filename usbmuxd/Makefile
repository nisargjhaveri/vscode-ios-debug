.PHONY: clean
.PHONY: install

install: override-usbmuxd.dylib
	-mv override-usbmuxd.dylib ../bin/

override-usbmuxd.dylib: override-usbmuxd.c
	$(CC) -dynamiclib -arch arm64 -arch x86_64 -o $@ $<

clean:
	-rm -f override-usbmuxd.dylib
	-rm -f ../bin/override-usbmuxd.dylib
