const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('allvar executes and replies once with variable state', async () => {
    const command = require('../src/Commands/Owner/allvar.js')
    const replies = []
    await command.execute({}, {}, {
        reply: async text => { replies.push(text) },
        prefix: '.'
    })

    assert.equal(replies.length, 1)
    assert.match(replies[0], /No runtime variables|Runtime Variables/)
})

test('antibug tkick require resolves to an existing file', () => {
    const antibugPath = path.resolve(__dirname, '../src/Commands/Admin/antibug.js')
    const source = fs.readFileSync(antibugPath, 'utf8')
    const match = source.match(/require\(['"]([^'"]*tkick)['"]\)/)

    assert.ok(match, 'expected antibug.js to require a path ending in tkick')
    const target = path.resolve(path.dirname(antibugPath), `${match[1]}.js`)
    assert.equal(fs.existsSync(target), true, `expected ${target} to exist`)
})
