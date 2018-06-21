const hyperdrive = require("hyperdrive")
const RandomAccessFile = require("./random-access-file")

const main = async config => {
  const volume = await RandomAccessFile.mount(config)
  const drive = hyperdrive(volume)

  drive.writeFile("/hello.txt", "world", function(err) {
    if (err) throw err
    drive.readdir("/", function(err, list) {
      if (err) throw err
      console.log(list) // prints ['hello.txt']
      drive.readFile("/hello.txt", "utf-8", function(err, data) {
        if (err) throw err
        console.log(data) // prints 'world'
      })
    })
  })
}

main()
