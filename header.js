module.exports = header

var f = 0
  , fields = {}
  , path = fields.path = f++
  , mode = fields.mode = f++
  , uid = fields.uid = f++
  , gid = fields.gid = f++
  , size = fields.size = f++
  , mtime = fields.mtime = f++
  , cksum = fields.cksum = f++
  , type = fields.type = f++
  , linkpath = fields.linkpath = f++
  , header_size = 512
  , block_size = 512
  , field_size = []
  , utf8 = require('to-utf8')

field_size[path] = 100
field_size[mode] = 8
field_size[uid] = 8
field_size[gid] = 8
field_size[size] = 12
field_size[mtime] = 12
field_size[cksum] = 8
field_size[type] = 1
field_size[linkpath] = 100

var ustar = fields.ustar = f++
  , ustarver = fields.ustarver = f++
  , uname = fields.uname = f++
  , gname = fields.gname = f++
  , devmaj = fields.devmaj = f++
  , devmin = fields.devmin = f++
  , prefix = fields.prefix = f++
  , fill = fields.fill = f++

// terminate fields.
fields[f] = null

field_size[ustar] = 6
field_size[ustarver] = 2
field_size[uname] = 32
field_size[gname] = 32
field_size[devmaj] = 8
field_size[devmin] = 8
field_size[prefix] = 155
field_size[fill] = 12

// nb: prefix field may in fact be 130 bytes of prefix,
// a null char, 12 bytes for atime, 12 bytes for ctime.
//
// To recognize this format:
// 1. prefix[130] === ' ' or '\0'
// 2. atime and ctime are octal numeric values
// 3. atime and ctime have ' ' in their last byte

var field_ends = {}
  , field_offs = {}
  , fe = 0
for (var i = 0; i < f; i ++) {
  field_offs[i] = fe
  field_ends[i] = (fe += field_size[i])
}

// build a translation table of field paths.
Object.keys(fields).forEach(function (f) {
  if (fields[f] !== null) fields[fields[f]] = f
})

// different values of the 'type' field
// paths match the values of Stats.isX() functions, where appropriate
var types =
  { 0: "File"
  , "\0": "OldFile" // like 0
  , "": "OldFile"
  , 1: "Link"
  , 2: "SymbolicLink"
  , 3: "CharacterDevice"
  , 4: "BlockDevice"
  , 5: "Directory"
  , 6: "FIFO"
  , 7: "ContiguousFile" // like 0
  // posix headers
  , g: "GlobalExtendedHeader" // k=v for the rest of the archive
  , x: "ExtendedHeader" // k=v for the next file
  // vendor-specific stuff
  , A: "SolarisACL" // skip
  , D: "GNUDumpDir" // like 5, but with data, which should be skipped
  , I: "Inode" // metadata only, skip
  , K: "NextFileHasLongLinkpath" // data = link path of next file
  , L: "NextFileHasLongPath" // data = path of next file
  , M: "ContinuationFile" // skip
  , N: "OldGnuLongPath" // like L
  , S: "SparseFile" // skip
  , V: "TapeVolumeHeader" // skip
  , X: "OldExtendedHeader" // like x
  }

Object.keys(types).forEach(function (t) {
  types[types[t]] = types[types[t]] || t
})

// values for the mode field
var modes =
  { suid: 04000 // set uid on extraction
  , sgid: 02000 // set gid on extraction
  , svtx: 01000 // set restricted deletion flag on dirs on extraction
  , uread:  0400
  , uwrite: 0200
  , uexec:  0100
  , gread:  040
  , gwrite: 020
  , gexec:  010
  , oread:  4
  , owrite: 2
  , oexec:  1
  , all: 07777
  }

var numeric =
  { mode: true
  , uid: true
  , gid: true
  , size: true
  , mtime: true
  , devmaj: true
  , devmin: true
  , cksum: true
  , atime: true
  , ctime: true
  , dev: true
  , ino: true
  , nlink: true
  }

Object.keys(modes).forEach(function (t) {
  modes[modes[t]] = modes[modes[t]] || t
})

var knownExtended =
  { atime: true
  , charset: true
  , comment: true
  , ctime: true
  , gid: true
  , gname: true
  , linkpath: true
  , mtime: true
  , path: true
  , realtime: true
  , security: true
  , size: true
  , uid: true
  , uname: true }

var space = ' '.charCodeAt(0)
  , slash = '/'.charCodeAt(0)
  , bslash = process.platform === 'win32' ? '\\'.charCodeAt(0) : null

header.types = types
header.fields = fields
header.numeric = numeric

var slice = buffer_slice

function buffer_slice(buf, start, end) {
  return buf.slice(start, end)
}

function uint8_slice(buf, start, end) {
  return buf.subarray(start, end)
}

function header(block) {
  var should_return = false
    , prefix
    , uint8
    , field
    , out
    , val

  if(block[0] === undefined) {
    uint8 = new Uint8Array(512)
    for(var i = 0, len = block.length; i < len; ++i) {
      uint8[i] = block.get(i)
    }
    block = uint8
    slice = uint8_slice
  }

  out = {cksum_valid: checksum(block)}

  prefix = null
  for(var f = 0; fields[f] !== null; ++f) {
    field = fields[f]
    val = slice(block, field_offs[f], field_ends[f])
    switch(field) {
      case 'ustar': parse_ustar(); break
      case 'prefix': parse_prefix(); break
      default: null_or_number(); break
    }

    if(should_return) {
      return out
    }
  }

  if(prefix) {
    out.path = prefix + '/' + out.path
  }

  return out

  function parse_ustar() {
    var str = utf8(val)
    out.ustar = str === 'ustar\0' ? str : false
    should_return = !out.ustar
  }

  function parse_prefix() {
    var atime = parse_numeric(slice(val, 131, 131 + 12))
      , ctime = parse_numeric(slice(val, 131 + 12, 131 + 12 + 12))

    if(val[130] === 0 || val[130] === space &&
       atime !== null && ctime !== null &&
       val[131 + 12] === space &&
       val[131 + 12 + 12] === space) {
      out.atime = atime
      out.ctime = ctime
      val = slice(val, 0, 130)      
    }
    prefix = utf8(val).replace(/\0+$/, '')
  }

  function null_or_number() {
    out[field] = numeric[field] ?
        parse_numeric(val) :
        utf8(val).replace(/\0+$/, '')
  }
}

function calcsum(block) {
  var sum = 0
    , start = field_offs[fields.cksum]
    , end = field_ends[fields.cksum]

  for(var i = 0, len = field_offs[fields.cksum]; i < len; ++i) {
    sum += block[i]
  }

  for(var i = start; i < end; ++i) {
    sum += space
  }

  for(var i = end; i < 512; ++i) {
    sum += block[i]
  }

  return sum
}

function checksum(block) {
  var sum = calcsum(block)
    , cksum = slice(block, field_offs[fields.cksum], field_ends[fields.cksum])
  
  cksum = parse_numeric(cksum)
  return cksum === sum
}

function parse256(buf) {
  var positive = buf[0] === 0x80 ? true :
                 buf[0] === 0xFF ? false :
                 null

  if(positive === null) {
    return positive
  }

  var zero = false
    , tuple = []
    , byte

  for(var i = buf.length - 1; i > 0; --i) {
    byte = buf[i]
    if(positive) {
      tuple[tuple.length] = byte
    } else if(zero && byte === 0) {
      tuple[tuple.length] = 0
    } else if(zero) {
      zero = false
      tuple[tuple.length] = 0x100 - byte
    } else {
      tuple[tuple.length] = 0xFF - byte
    } 
  }

  for(var sum = 0, i = 0, len = tuple.length; i < len; ++i) {
    sum += tuple[i] * Math.pow(256, i)
  }

  return positive ? sum : -1 * sum
}

function parse_numeric(field) {
  if(field[0] & 0x80) {
    return parse256(field)
  }

  var str = utf8(field).split('\0')[0]
    , res

  str = str.replace(/^\s+/g, '').replace(/\s+$/g, '')

  res = parseInt(str, 8)

  return res !== res ? null : res
}
