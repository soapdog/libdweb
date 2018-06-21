"use strict"

https://github.com/mozilla/gecko-dev/blob/9c1c7106eef137e3413fd867fc1ddfb1d3f6728c/dom/webidl/IDBDatabase.webidl

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

class RandomAccessIDBFile extends RandomAccess {
  static async mount(name, options) {
    if (!self.IDBMutableFile) {
      throw Error(`Implementation depends on IDBMutableFile https://developer.mozilla.org/en-US/docs/Web/API/IDBMutableFile`)
    } else {
      const indexedDBName = `${options.name}@RandomAccessIDBFile`
      const version = options.version || 1.0
      const objectStorageName = `RandomAccessIDBFileObjectStorage`
      
      const request = indexedDB.open(indexedDBName, version)
      request.onupgradeneeded = () => {
        const db = request.result  
        if (!db.objectStoreNames.contains(objectStorageName)) {
          db.createObjectStore(this.objectStorageName)
        }
      }
      const db = await request
      return new RandomAccessIDBFileVolume(name, version, indexedDBName, objectStorageName, db)
    }
  }
  static async open(self, { mode }) {
    console.log(`>> open ${self.file} ${JSON.stringify(mode)}`)
    const mutableFile = await self.volume.db.createMutableFile("random.bin", "binary/random")
    self.file = await mutableFile.open("readwrite")
    self.debug && console.log(`<< open ${self.url} ${JSON.stringify(mode)}`)
    return self
  }
  static async read(self, { data, offset, size }) {
    self.debug && console.log(`>> read ${self.url} <${offset}, ${size}>`)
    const buffer = data || Buffer.allocUnsafe(size)
    self.file.location = offset
    const chunk = await self.file.readAsArrayBuffer(size)
    Buffer.from(chunk).copy(buffer)
    self.debug &&
      console.log(`<< read ${self.file} <${offset}, ${size}>`, buffer)
    return buffer
  }
  static async write(self, { data, offset, size }) {
    self.debug && console.log(`>> write ${self.file} <${offset}, ${size}>`, data)
    self.file.location = offset
    const {byteLength, byteOffset} = data
    const chunk = byteLength === size
      ? (byteOffset > 0 ? data.buffer.slice(byteOffset) : data.buffer)
      : byteLength > size
      ? data.buffer.slice(byteOffset, byteOffset + size)
      : (byteOffset > 0 ? data.buffer.slice(byteOffset) : data.buffer)
    
    self.file.location = offset
    await self.file.write(chunk)

    self.debug &&
      console.log(`<< write ${wrote} ${self.file} <${offset}, ${size}>`)

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
  constructor(volume, file, options) {
    this.volume = volume
    this.file = file
    this.options = options
  }
}

module.exports = RandomAccessFile
