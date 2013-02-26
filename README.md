# tar-parse

just the parsing part of [node-tar](http://npm.im/tar) lifted out and reworked
using [dominictarr's duplex](http://npm.im/duplex) library. primary goal is to
get `tar` working in the browser.

```javascript
var parse = require('tar-parse')
  , mkdirp = require('mkdirp')
  , path = require('path')
  , fs = require('fs')

fs.createReadStream('assets.tar')
  .pipe(parse())
  .on('data', function(entry) {
    entry.pause()
    mkdirp(path.dirname(entry.path), function() {
      if(entry.props.size) {
        entry.pipe(fs.createWriteStream(entry.path))
      }
      entry.resume()
    })
  })

```

`data` events will be files, links (symbolic and otherwise), devices, fifos, and directories.

they represent a pausable, readable stream. pausing an entry will cause the parse stream to pause
as well.

passes the parse subset of tests from node tar. uses `tape` instead of `tap`.

## license

MIT 
