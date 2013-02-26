module.exports = buffer_entry

var entry = require('./entry')

function buffer_entry(header, extended, global) {
  var stream = entry(header, extended, global)
    , buffer = []
    , push

  push = [].push.call.bind([].push, buffer)

  stream.body = ''
  stream
    .on('data', push)
    .on('end', function() {
      stream.body = buffer.join('').replace(/\0+$/, '')
    })

  return stream
}
