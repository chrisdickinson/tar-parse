var duplex = require('duplex')
  , chunks = require('chunk-stream')
  , parser = require('./parser')
  , EE = require('events').EventEmitter

var emit = EE.prototype.emit
emit = emit.bind.bind(emit)

module.exports = parse

function parse() {
  var _global = {}
    , stream = duplex()
    , parse = parser(_global)
    , blocks = chunks(512)
    , eof_started = false
    , ended = false
    , entry = null
    , remaining = 0
    , position = 0

  stream.global = _global 

  stream
    .on('_data', recv_data)
    .on('_end', recv_end)

  blocks
    .on('error', emit(stream, 'error'))
    .on('drain', emit(stream, 'drain'))

  parse
    .on('*',      emit(stream, '*'))
    .on('error',  emit(stream, 'error'))
    .on('data',   stream._data)
    .on('end',    stream._end)
    .on('global', merge)

  blocks.pipe(parse)

  return stream

  function recv_data(data) {
    if(blocks.write(data) === false) {
      stream.emit('pause')
    }
  }

  function recv_end() {
    blocks.end()
  }

  function merge(flags) {
    for(var key in flags) {
      stream.global[key] = flags[key]
    }
  }
}
