#!/usr/bin/env node
// Claude plugin: the plugin directory does not accept a server that npx downloads and runs, so
// the plugin ships the bundled server itself and starts it with node ${CLAUDE_PLUGIN_ROOT}/server/index.js.
// The guides come from plugin/skills/huly (the server finds them there), the version is built in.
//
// Run after `npm run build` when releasing: npm run plugin:bundle. `--check` only compares (CI/release).
'use strict'
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const built = path.join(root, 'dist', 'index.js')
const target = path.join(root, 'plugin', 'server', 'index.js')
if (!fs.existsSync(built)) throw new Error('dist/index.js is missing — run npm run build first.')

if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target).equals(fs.readFileSync(built))
  if (!same) {
    console.error('plugin/server/index.js is not the current build — run: npm run build && npm run plugin:bundle, then commit it.')
    process.exit(1)
  }
  console.log('plugin/server/index.js matches the build.')
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(built, target)
  console.log(`plugin/server/index.js updated (${(fs.statSync(target).size / 1e6).toFixed(1)} MB).`)
}
