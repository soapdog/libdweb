"use strict"

const RandomAccess = require("random-access-storage")
const { Buffer } = require("Buffer")

const MAX_SIZE = (1 << 30) * 2 - (1 << 12) - 1

class RandomAccessFile extends RandomAccess {
  constructor(volume, name, options = {}) {
    super()
    this.name = name
    this.options = options
    this.volume = volume
    this.url = `${volume.url}${name}`
    this.file = null
  }
  static async mount(url = null) {
    const volume = await browser.FileSystem.mount({
      url: url,
      read: true,
      write: true
    })

    return (name, options) => new RandomAccessFile(volume, name, options)
  }
  static async open(self, mode) {
    self.file = await browser.FileSystem.open(self.url, {
      read: true,
      write: true
    })

    console.log("opened", self)
    return self
  }
  static async delete(self, position, size) {
    const stat = await browser.File.stat(self.file)
    if (position + size < stat.size) {
      return null
    } else {
      const data =
        position > 0
          ? await browser.File.read(file, { position: 0, size: position })
          : null

      self.file = await browser.FileSystem.open(self.fileURL, {
        truncate: true,
        read: true,
        write: true
      })

      if (data) {
        await browser.File.write(self.file, data, { position: 0 })
      }
    }
  }
  _open(request) {
    console.log("_open", request, this)
    RandomAccessFile.open(this, { read: true, write: true })
      .then(self => request.callback(null, self))
      .catch(error => request.callback(error))
  }
  // _openReadonly(request) {
  //   console.log("_openReadonly", request)
  //   RandomAccessFile.open(this, { read: true })
  //     .then(self => request.callback(null, self))
  //     .catch(error => request.callback(error))
  // }
  _write(request) {
    console.log("_write", request, this.file, this.url)
    const { offset, size, data } = request
    browser.File.write(this.file, data.buffer, {
      position: offset,
      size
    })
      .then(() => request.callback(null))
      .catch(error => request.callback)
  }
  static async read(file, buffer, position, size) {
    const content = await browser.File.read(file, {
      position: position,
      size: MAX_SIZE < size ? undefined : size
    })
    Buffer.from(content).copy(buffer)
    return buffer

    // if (data.byteLength < options.size) {
    //   const result = new Uint8Array(options.size)
    //   result.set(data)
    //   return result
    // } else {
    //   return data
    // }
  }
  _read(request) {
    console.log("_read", request)
    const { offset, size } = request
    const buffer = request.data || Buffer.allocUnsafe(size)
    RandomAccessFile.read(this.file, buffer, offset, size)
      .then(data => request.callback(null, data))
      .catch(error => request.callback(error))
  }
  _del(request) {
    console.log("_del", request)
    RandomAccessFile.delete(this, request.offset, request.size)
      .then(() => request.callback(null))
      .catch(error => request.callback(null))
  }
  _stat(request) {
    console.log("_stat", request)
    browser.File.stat(this.file)
      .then(stat => request.callback(null, stat))
      .catch(error => request.callback(error))
  }
  _close(request) {
    console.log("_close", request)
    browser.File.close(this.file)
      .then(() => request.callback((this.file = null)))
      .catch(error => request.callback(error))
  }
  _destroy(request) {
    console.log("_destroy", request)
    browser.FileSystem.removeFile(this.fileURL, { ignoreAbsent: true })
      .then(() => request.callback(null))
      .catch(error => request.callback(error))
  }
}

module.exports = RandomAccessFile
