module.exports = entry

var through = require('through')
  , header = require('../header')
  , fields = header.fields
  , types = header.types
  , has

has = {}.hasOwnProperty
has = has.call.bind(has)

function entry(header, extended, global) {
  var stream = through(write)
    , remaining
    , slice

  stream.meta = false
  stream.props = {}
  stream._header = header
  stream._extended = extended || {}
  stream._global = {}

  for(var key in global) {
    stream._global[key] = global[key]
  }

  set_props(stream)

  remaining = stream.props.size

  return stream

  function write(buf) {
    if(!slice) {
      if(buf.slice) {
        slice = function(b, s, e) { return b.slice(s, e) } 
      } else {
        slice = function(b, s, e) { return b.subarray(s, e) }
      }
    }

    if(buf.length > remaining) {
      buf = slice(buf, 0, remaining)
    }

    remaining -= buf.length
    stream.queue(buf)

    if(remaining === 0) {
      stream.queue(null)
    }
  }
}

function set_props(stream) {
  var header = stream._header
    , dateify = ['mtime', 'ctime', 'atime']
    , extended = stream._extended
    , global = stream._global
    , props = stream.props
    , field
    , val

  for(var f = 0; fields[f] !== null; ++f) {
    field = fields[f]
    val = header[field]
    if(val !== undefined) {
      props[field] = val
    }
  }

  for(var key in global) {
    if(global[key] !== undefined) {
      props[key] = global[key]
    }
  }

  for(var key in extended) {
    if(extended[key] !== undefined) {
      props[key] = extended[key]
    }
  }

  if(has(props, 'path')) {
    props.path = props.path.split('\0')[0]
  }

  if(has(props, 'linkpath')) {
    props.linkpath = props.linkpath.split('\0')[0]
  }

  dateify.forEach(to_date)

  stream.type =
    types[props.type] in {'OldFile':0, 'ContiguousFile':0} ? 'File' :
    types[props.type] === 'GNUDumpDir' ? 'Directory' : 
    types[props.type] === undefined ? 'Unknown' : 
    types[props.type] 

  stream.path = props.path
  stream.size = props.size 

  return

  function to_date(property) {
    if(!has(props, property)) {
      return
    }

    props[property] = new Date(props[property] * 1000)
  }
}
