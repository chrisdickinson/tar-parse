module.exports = extended_header

var entry = require('./entry')
  , header = require('../header')
  , utf8 = require('to-utf8')
  , numeric = header.numeric

var _ = 0
  , states = {}
  , SIZE = states.SIZE = _++
  , KEY = states.KEY = _++
  , VAL = states.VAL = _++
  , ERR = states.ERR = _++
  , character
  , fromcode

var trans = {
  'SCHILY.dev': 'dev'
, 'SCHILY.ino': 'ino'
, 'SCHILY.nlink': 'nlink'
}

character = ''.charCodeAt.call.bind(''.charCodeAt)
fromcode = function(c) {
  return String.fromCharCode(c)
}

var zero = character('0')
  , nine = character('9')
  , dot = character('.')
  , lower_a = character('a')
  , lower_z = character('z')
  , upper_a = character('A')
  , upper_z = character('Z')
  , space = character(' ')
  , equals = character('=')
  , newline = character('\n')

for(var key in states) {
  states[states[key]] = states[key]
}

function extended_header(header, extended, global) {
  var stream = entry(header, extended, global)
    , field_pos = 0
    , state = SIZE
    , sizebuf = []
    , key = []
    , val = []
    , size = 0
    , idx = 0

  stream.fields = {}

  stream
    .on('data', ondata)
    .on('end', onend)

  return stream

  function ondata(buf) {
    for(idx = 0, len = buf.length; idx < len; ++field_pos, ++idx) {
      var c = buf[idx] === undefined ? buf.get(idx) : buf[idx]
      switch(state) {
        case ERR: break
        case SIZE: parse_size(c); break
        case KEY: parse_key(c); break
        case VAL: parse_val(c); break
      }
    }
  }

  function onend() {
    
  }

  function parse_size(c) {
    if(c === space) {
      state = KEY
      size = parseInt(utf8(sizebuf), 10)
      sizebuf.length = 0
      return
    }
    if(c < zero || c > nine) {
      state = ERR
      stream.emit('error', new Error('expected 0..9, got '+fromcode(c)))
      return
    }
    sizebuf[sizebuf.length] = c
  }

  function parse_key(c) {
    if(c === equals) {
      state = VAL
      return      
    }
    key[key.length] = c
  }

  function parse_val(c) {
    if(field_pos === size - 1) {
      if(c !== newline) {
        state = ERR
        stream.emit('error', 'expected \\n at end of field')
        return
      }
      var keyval = utf8(key)
        , value = numeric[keyval] ?
          parseFloat(utf8(val)) :
          utf8(val).replace(/\0+$/, '')

      keyval = trans[keyval] ? trans[keyval] : keyval
      stream.fields[keyval] = value

      key.length =
      val.length =
      sizebuf.length = 0

      size = field_pos = -1
      state = SIZE
      return
    }
    val[val.length] = c
  }
} 
