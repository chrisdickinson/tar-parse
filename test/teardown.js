// clean up the fixtures

var test = require("tape")
  , rimraf = require("rimraf")
  , path = require("path")

test("clean fixtures", function (t) {
  rimraf(path.resolve(__dirname, "fixtures"), function (er) {
    t.ifError(er, "rimraf ./fixtures/")
    t.end()
  })
})

test("clean tmp", function (t) {
  rimraf(path.resolve(__dirname, "tmp"), function (er) {
    t.ifError(er, "rimraf ./tmp/")
    t.end()
  })
})
