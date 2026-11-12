#!/usr/bin/env node
// Claude Desktop extension: packs the bundled server into huly-mcp-selfhost.mcpb.
// Users double-click the file (or Settings → Extensions → Advanced settings → Install Extension…)
// and enter their Huly login in the form Claude Desktop shows; secrets go to the OS keychain.
//
// Run after `npm run build`: node scripts/mcpb.js [outDir]   (default: build/)
'use strict'
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const MCPB_CLI = '@anthropic-ai/mcpb@2.1.2'
const root = path.join(__dirname, '..')
const dist = path.join(root, 'dist')
const outDir = path.resolve(process.argv[2] ?? path.join(root, 'build'))
const stage = path.join(outDir, 'mcpb')

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
if (!fs.existsSync(path.join(dist, 'index.js'))) throw new Error('dist/index.js is missing — run npm run build first.')

fs.rmSync(stage, { recursive: true, force: true })
fs.mkdirSync(path.join(stage, 'server'), { recursive: true })

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'mcpb', 'manifest.json'), 'utf8'))
manifest.version = pkg.version
fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

// The server is one self-contained file plus the guides; a tiny package.json lets check_setup report the version.
fs.copyFileSync(path.join(dist, 'index.js'), path.join(stage, 'server', 'index.js'))
fs.cpSync(path.join(dist, 'guides'), path.join(stage, 'server', 'guides'), { recursive: true })
fs.writeFileSync(path.join(stage, 'server', 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version, private: true }, null, 2) + '\n')
fs.copyFileSync(path.join(root, 'mcpb', 'icon.png'), path.join(stage, 'icon.png'))
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(stage, 'LICENSE'))

// Fixed name, so https://github.com/…/releases/latest/download/huly-mcp-selfhost.mcpb always works.
const out = path.join(outDir, `${pkg.name}.mcpb`)
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
execFileSync(npx, ['-y', MCPB_CLI, 'pack', stage, out], { stdio: 'inherit' })
console.log(out)
