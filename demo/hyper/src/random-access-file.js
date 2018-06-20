"use strict"

const RandomAccess = require("random-access-storage")
const { Buffer } = require("Buffer")

const RequestType = {
  open: 0,
  read: 1,
  write: 2,
  delete: 3,
  stat: 4,
  close: 5,
  destroy: 6
}

class RandomAccessFile extends RandomAccess {
  constructor(volume, name, options, config) {
    super()
    this.name = name
    this.options = options
    this.config = config
    this.volume = volume
    this.url = `${volume.url}${name}`
    this.file = null
    this.workQueue = []
    this.isIdle = true
    this.debug = !!config.debug
  }
  static async mount(config = {}) {
    const volume = await browser.FileSystem.mount({
      url: config.url,
      read: true,
      write: true
    })

    return (name, options) =>
      new RandomAccessFile(volume, name, options, config)
  }
  static async open(self, { mode }) {
    self.debug && console.log(`>> open ${self.url} ${JSON.stringify(mode)}`)
    self.file = await browser.FileSystem.open(self.url, mode)
    self.debug && console.log(`<< open ${self.url} ${JSON.stringify(mode)}`)
    return self
  }
  static async read(self, { data, offset, size }) {
    self.debug && console.log(`>> read ${self.url} <${offset}, ${size}>`)
    const buffer = data || Buffer.allocUnsafe(size)
    const chunk = await browser.File.read(self.file, {
      position: offset,
      size
    })
    Buffer.from(chunk).copy(buffer)
    self.debug &&
      console.log(`<< read ${self.url} <${offset}, ${size}>`, buffer)
    return buffer
  }
  static async write(self, { data, offset, size }) {
    self.debug && console.log(`>> write ${self.url} <${offset}, ${size}>`, data)
    const wrote = await browser.File.write(self.file, data.buffer, {
      position: offset,
      size
    })
    await browser.File.flush(self.file)

    self.debug &&
      console.log(`<< write ${wrote} ${self.url} <${offset}, ${size}>`)

    return wrote
  }
  static async delete(self, { offset, size }) {
    this.debug && console.log(`>> delete ${self.url} <${offset}, ${size}>`)
    const stat = await browser.File.stat(self.file)
    if (offset + size < stat.size) {
      return null
    } else {
      const data =
        offset > 0
          ? await browser.File.read(self.file, { position: 0, size: offset })
          : null

      await browser.FileSystem.close(self.file)

      self.file = await browser.FileSystem.open(self.url, {
        truncate: true,
        read: true,
        write: true
      })

      if (data) {
        await browser.File.write(self.file, data)
      }

      this.debug && console.log(`<< delete ${self.url} <${offset}, ${size}>`)
    }
  }
  static async stat(self) {
    self.debug && console.log(`>> stat ${self.url}`)
    const stat = await browser.File.stat(self.file)
    self.debug && console.log(`<< stat {size:${stat.size}} ${self.url} `)

    return stat
  }
  static async close(self) {
    self.debug && console.log(`>> close ${self.url}`)
    await browser.File.close(self.file)
    self.file = null
    self.debug && console.log(`<< close ${self.url}`)
    return
  }
  static async destroy(self) {
    self.debug && console.log(`>> destroy ${self.url}`)
    await browser.FileSystem.removeFile(this.url, { ignoreAbsent: true })
    self.debug && console.log(`<< destroy ${self.url}`)
  }

  static async awake(self) {
    const { workQueue } = self
    self.isIdle = false
    let index = 0
    while (index < workQueue.length) {
      const request = workQueue[index++]
      await RandomAccessFile.wait(self, request)
    }
    workQueue.length = 0
    self.isIdle = true
  }
  static schedule(self, request) {
    self.workQueue.push(request)
    if (self.isIdle) {
      RandomAccessFile.awake(self)
    }
  }
  static perform(self, request) {
    switch (request.type) {
      case RequestType.open: {
        return RandomAccessFile.open(self, request)
      }
      case RequestType.read: {
        return RandomAccessFile.read(self, request)
      }
      case RequestType.write: {
        return RandomAccessFile.write(self, request)
      }
      case RequestType.delete: {
        return RandomAccessFile.delete(self, request)
      }
      case RequestType.stat: {
        return RandomAccessFile.stat(self, request)
      }
      case RequestType.close: {
        return RandomAccessFile.close(self, request)
      }
      case RequestType.destroy: {
        return RandomAccessFile.destory(self, request)
      }
    }
  }
  static async wait(self, request) {
    try {
      const result = await RandomAccessFile.perform(self, request)
      request.callback(null, result)
    } catch (error) {
      request.callback(error)
    }
  }
  _open(request) {
    request.mode = { read: true, write: true }
    RandomAccessFile.schedule(this, request)
  }
  _openReadonly(request) {
    request.mode = { read: true }
    RandomAccessFile.schedule(this, request)
  }
  _write(request) {
    RandomAccessFile.schedule(this, request)
  }
  _read(request) {
    RandomAccessFile.schedule(this, request)
  }
  _del(request) {
    RandomAccessFile.schedule(this, request)
  }
  _stat(request) {
    RandomAccessFile.wait(this, request)
  }
  _close(request) {
    RandomAccess.schedule(this, request)
  }
  _destroy(request) {
    RandomAccess.schedule(this, request)
  }
}

module.exports = RandomAccessFile
