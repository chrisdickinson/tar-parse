module.exports = parser

var duplex = require('duplex')
  , header = require('./header')
  , EE = require('events').EventEmitter

var tarentry = require('./streams/entry')
  , tarextendedheader = require('./streams/extended-header')
  , tarbufferentry = require('./streams/buffer-entry')

var emit = EE.prototype.emit
emit = emit.bind.bind(emit)

function parser(global) {
  var stream = duplex()
    , extended = null
    , position = 0
    , entry = null

  stream
    .on('_data',  recv_data)
    .on('_end',   recv_end)

  return stream

  function recv_data(data) {
    var ret = entry ?
      write_entry(data) :
      write_non_entry(data)

    position += 512
    if(ret === false) {
      stream._pause()
    }
  }

  function recv_end() {
    if(entry) {
      return entry.end()
    }
    return stream._end()
  }

  function write_entry(chunk) {
    return entry.write(chunk)
  }

  function write_non_entry(chunk) {
    var zero = true
    for(var i = 0; i < 512 && zero; ++i) {
      zero = chunk[i] === 0
    }

    if(zero) {
      ended = eof_started
      eof_started = true 
    } else {
      ended = eof_started = false
      entry = start_entry(chunk)
      return entry ? !entry.paused : true
    }
  }

  function start_entry(chunk) {
    var head = header(chunk)
      , meta = false
      , _entry
      , onend
      , error
      , type

    if(null === head.size || !head.cksum_valid) {
      error = new Error('invalid tar file')
      error.header = head
      error.tar_file_offset = position
      error.tar_block = (position / 512)>>>0
      stream.emit('error', error)
    }

    var _ext = extended
      , _global = global
      , ev

    switch(header.types[head.type]) {
      case "File":
      case "OldFile":
      case "Link":
      case "SymbolicLink":
      case "CharacterDevice":
      case "BlockDevice":
      case "Directory":
      case "FIFO":
      case "ContiguousFile":
      case "GNUDumpDir":
        type = tarentry
        ev = 'entry'
        break
      case "GlobalExtendedHeader":
        // extended headers that apply to the rest of the tarball
        type = tarextendedheader 
        onend = function () {
          global = global || {}
          for(var key in entry.fields) {
            global[key] = entry.fields[key]
          }
        }
        meta = true
        ev = 'globalExtendedHeader'
        break
      case "ExtendedHeader":
      case "OldExtendedHeader":
        // extended headers that apply to the next entry
        type = tarextendedheader
        onend = function () {
          extended = entry.fields
        }
        meta = true
        ev = 'extendedHeader'
        break

      case "NextFileHasLongLinkpath":
        // set linkpath=<contents> in extended header
        type = tarbufferentry
        onend = function () {
          extended = extended || {}
          extended.linkpath = _entry.body
        }
        meta = true
        ev = 'longLinkpath'

        break

      case "NextFileHasLongPath":
      case "OldGnuLongPath":
        // set path=<contents> in file-extended header
        type = tarbufferentry
        onend = function () {
          extended = extended || {}
          extended.path = _entry.body
        }
        meta = true
        ev = 'longPath'
        break

      default:
        // all the rest we skip, but still set the _entry
        // member, so that we can skip over their data appropriately.
        // emit an event to say that this is an ignored entry type?
        type = tarentry
        ev = "ignoredEntry"
        break
    }

    if(meta) {
      _ext = _global = null
    } else {
      extended = null
    }
    _entry = type(head, _ext, _global)
    _entry.meta = meta
    if(onend) {
      _entry.on('end', onend)
    }

    _entry
      .on('error', emit(stream, 'error')) 
      .on('end', _end)

    if(!meta) {
      stream._data(_entry)
    }

    stream.emit('*', ev, _entry)

    if(_entry.props.size === 0) {
      if(!_entry.paused) {
        _entry.end()
        return null
      }
      _entry.once('drain', function() {
        _entry.end()
        entry = null
      })
    }

    if(_entry) {
      _entry.on('drain', emit(stream, 'drain'))
    }
    return _entry

    function _end() {
      entry = null
    }
  }
}
