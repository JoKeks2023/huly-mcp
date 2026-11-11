#!/usr/bin/env node
// Build: one bundled, readable file instead of a tree of modules plus ~180 runtime packages.
//
// Every dependency (Huly SDK, MCP SDK, zod, …) is bundled into dist/index.js, so installing the
// package downloads a few MB instead of ~126 MB and `npx` starts much sooner. Not minified, so
// the shipped code stays readable and auditable. Type checking runs separately (tsc --noEmit).
'use strict'
const fs = require('fs')
const path = require('path')
const esbuild = require('esbuild')

const root = path.join(__dirname, '..')
const dist = path.join(root, 'dist')

// Optional native speed-ups of ws/msgpackr: they fall back to plain JS when missing.
const OPTIONAL_NATIVE = ['bufferutil', 'utf-8-validate', 'msgpackr-extract', 'fsevents']

async function main () {
  fs.rmSync(dist, { recursive: true, force: true })
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'src', 'index.ts')],
    outfile: path.join(dist, 'index.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    minify: false,
    legalComments: 'eof',
    external: OPTIONAL_NATIVE,
    metafile: true,
    logLevel: 'warning'
  })
  fs.chmodSync(path.join(dist, 'index.js'), 0o755)

  // `huly-mcp-setup` (older bin name) = `huly-mcp setup`.
  fs.writeFileSync(path.join(dist, 'setup.js'), "#!/usr/bin/env node\n'use strict'\nprocess.argv.splice(2, 0, 'setup')\nrequire('./index.js')\n", { mode: 0o755 })

  // Guides: the plugin skill files are the one source for huly://guide/* (without frontmatter).
  const guides = { workflow: 'SKILL.md', costs: 'costs.md', onboarding: 'onboarding.md', features: 'features.md' }
  const src = path.join(root, 'plugin', 'skills', 'huly')
  fs.mkdirSync(path.join(dist, 'guides'), { recursive: true })
  for (const [name, file] of Object.entries(guides)) {
    const text = fs.readFileSync(path.join(src, file), 'utf8').replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n+/, '')
    fs.writeFileSync(path.join(dist, 'guides', `${name}.md`), text)
  }

  const bytes = Object.values(result.metafile.outputs).reduce((s, o) => s + o.bytes, 0)
  console.log(`build: dist/index.js ${(bytes / 1024 / 1024).toFixed(1)} MB (bundled, ${Object.keys(result.metafile.inputs).length} modules), ${Object.keys(guides).length} guides`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
