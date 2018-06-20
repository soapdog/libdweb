# Notes

- [hypercore][] assumes on built-in node modules like streams, buffer, etc... So
  most reasonable approach is to use [browserify][] to polyfill all that.

- [hypercore][] needs [random-access-storage][] instance which this prototype implements using [libdweb][] FileSystem API.

- Implementation assumes that read returns node [`Buffer`][buffer]. It is unfortunate that standard `ArrayBuffer` is not supported as this requires `Buffer` polyfill and copying from `ArrayBuffer` to `Buffer` on each read.

- On serveral occasions I got `read` request of `5gb` size _(don't remember exact number)_ of data which fails as Firefox can not allocate such a large `Uint8Array`. I could possibly perform multiple smaller reads and aggregate it into node `Buffer` polyfill but that does not sound good.

  **Disclaimer:** I'm no longer seem to be able to reproduce this, I wonder if end up with corrupt hypercore causing it to issue such requests.

- It seems that **read** operation expects to get the `Buffer` that matches exactly requested `size`, but unlike node implementation we return at most available number of bytes & it seems odd to allocate larger `ArrayBuffer` in such case.

  **Note**: Given that we're forced to return node `Buffer` it does not matter all that much, but still not ideal.

- hypercore performs concurrent `read` / `write` operations on non overlapping ranges. But unfortunately [OS.File][] that [libdweb][] based on has does not take `offset` for `read` / `write` operations, there for we forced to use [`setPosition`]() in the file instead, which runs into race condition when `read` / `write` operations are performed concurrently even on non-overlapping ranges.

  As a workaround we use work queue to perform concurrent read / write operations in sequence, but that greatly reduces performance. I submitted [Bug 1469974][] to add support for concurrent read / writes as we do seem to have [`pread` / `pwrite`][preadwrite] bindings which are not not exposed for some reason.

  Better workaround could be implement by pooling open files so that concurrent operations could be dispatched to available ones.

- Unlike built-in [`RandomAccessFile`][randomaccessfile] we need to mount FileSystem first as user may or may not grant access.

[hypercore]: https://github.com/mafintosh/hypercore
[libdweb]: https://github.com/mozilla/libdweb
[browserify]: http://browserify.org/
[random-access-storage]: https://github.com/random-access-storage/random-access-storage
[buffer]: https://nodejs.org/docs/latest/api/buffer.html
[os.file]: https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/OSFile.jsm/OS.File_for_the_main_thread#Instances_of_OS.File
[setposition]: https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/OSFile.jsm/OS.File_for_the_main_thread#OS.File.prototype.setPosition
[pwrite]: https://github.com/mozilla/gecko-dev/blob/3c701634e0abd5c7f7ce89074b84eb96759ea844/toolkit/components/osfile/modules/osfile_unix_back.jsm#L421-L425
[preadwrite]: https://github.com/mozilla/gecko-dev/blob/3c701634e0abd5c7f7ce89074b84eb96759ea844/toolkit/components/osfile/modules/osfile_unix_back.jsm#L415-L425
[bug 1469974]: https://bugzilla.mozilla.org/show_bug.cgi?id=1469974
[randomaccessfile]: https://github.com/random-access-storage/random-access-file
