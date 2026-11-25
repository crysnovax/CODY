'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { patches, apply } = require('../scripts/patch-plogme.cjs')

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-plogme-'))
  const file = path.join(root, 'lib/Utils/use-multi-file-auth-state.js')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, [
    "import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';",
    '            try {',
    '                await writeFile(filePath, JSON.stringify(data, BufferJSON.replacer));',
    '            }',
    '            finally {',
    '                release();',
    '            }'
  ].join('\n'))
  return { root, file }
}

test('auth-state postinstall patch converts direct writes to temp-file rename', () => {
  const fixture = makeFixture()
  try {
    const result = apply(fixture.root)
    assert.ok(result.applied.includes('atomic-auth-state-writes'))
    assert.ok(result.applied.includes('atomic-auth-state-write-body'))

    const source = fs.readFileSync(fixture.file, 'utf8')
    assert.match(source, /import \{ mkdir, readFile, rename, stat, unlink, writeFile \}/)
    assert.match(source, /writeFile\(temporaryPath, JSON\.stringify\(data, BufferJSON\.replacer\)\)/)
    assert.match(source, /await rename\(temporaryPath, filePath\)/)
    assert.match(source, /await unlink\(temporaryPath\)\.catch\(\(\) => \{\}\)/)
    assert.doesNotMatch(source, /writeFile\(filePath, JSON\.stringify\(data, BufferJSON\.replacer\)\)/)
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true })
  }
})

test('atomic replacement keeps the previous auth file if the rename step fails', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-auth-'))
  const target = path.join(directory, 'session.json')
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(target, '{"session":"known-good"}')

  try {
    fs.writeFileSync(temporary, '{"session":"new"}')
    await assert.rejects(
      fs.promises.rename(temporary, path.join(directory, 'missing', 'session.json')),
      /ENOENT/
    )
    assert.equal(fs.readFileSync(target, 'utf8'), '{"session":"known-good"}')
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
