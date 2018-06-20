"use strict"

const RandomAccess = require("random-access-storage")
const { Buffer } = require("Buffer")

class RandomAccessFile extends RandomAccess {
  constructor(volume, name, options = {}) {
    super()
    this.name = name
    this.options = options
    this.volume = volume
    this.url = `${volume.url}${name}`
    this.file = null
    this.writeQueue = []
    this.isIdle = true
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
    self.file = await browser.FileSystem.open(self.url, mode)

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

      self.file = await browser.FileSystem.open(self.url, {
        truncate: true,
        read: true,
        write: true
      })

      if (data) {
        await browser.File.write(self.file, data, { position: 0 })
      }
    }
  }
  static async read(file, buffer, position, size) {
    const content = await browser.File.read(file, {
      position,
      size
    })
    Buffer.from(content).copy(buffer)
    return buffer
  }
  static async write(file, buffer, position, size) {
    const wrote = await browser.File.write(file, buffer, {
      position,
      size
    })
    // await browser.File.flush(file)

    return wrote
  }
  static async resumeWrites(self) {
    const { writeQueue } = self
    self.isIdle = false
    let index = 0
    while (index < writeQueue.length) {
      const request = writeQueue[index++]
      const { offset, size, data } = request
      try {
        await RandomAccessFile.write(self.file, data.buffer, offset, size)
        request.callback(null)
      } catch (error) {
        request.callback(error)
      }
    }
    writeQueue.length = 0
    self.isIdle = true
  }
  _open(request) {
    RandomAccessFile.open(this, { read: true, write: true, create: true })
      .then(self => request.callback(null, self))
      .catch(error => request.callback(error))
  }
  _openReadonly(request) {
    RandomAccessFile.open(this, { read: true })
      .then(self => request.callback(null, self))
      .catch(error => request.callback(error))
  }
  _write(request) {
    this.writeQueue.push(request)
    if (this.isIdle) {
      RandomAccessFile.resumeWrites(this)
    }
  }
  _read(request) {
    const { offset, size } = request
    const buffer = request.data || Buffer.allocUnsafe(size)
    RandomAccessFile.read(this.file, buffer, offset, size)
      .then(data => request.callback(null, data))
      .catch(error => request.callback(error))
  }
  _del(request) {
    RandomAccessFile.delete(this, request.offset, request.size)
      .then(() => request.callback(null))
      .catch(error => request.callback(null))
  }
  _stat(request) {
    browser.File.stat(this.file)
      .then(stat => request.callback(null, stat))
      .catch(error => request.callback(error))
  }
  _close(request) {
    browser.File.close(this.file)
      .then(() => request.callback((this.file = null)))
      .catch(error => request.callback(error))
  }
  _destroy(request) {
    browser.FileSystem.removeFile(this.url, { ignoreAbsent: true })
      .then(() => request.callback(null))
      .catch(error => request.callback(error))
  }
}

module.exports = RandomAccessFile
