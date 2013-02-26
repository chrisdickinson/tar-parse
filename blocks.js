var Block = require('block-stream')

module.exports = function() {
  return new Block(512)
}
