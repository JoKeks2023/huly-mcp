#!/usr/bin/env node
// Claude plugin: the server the plugin starts with node ${CLAUDE_PLUGIN_ROOT}/server/index.js.
//
// The plugin directory reads every script a plugin starts and refuses files it cannot read: no
// downloads (npx), and no script over 256 KiB — the single-file build (dist/index.js, ~4 MB) is
// too big. So the plugin ships the server as a plain module tree instead:
//   plugin/server/index.js                   ← two lines: require('./src/index.js')
//   plugin/server/src/…                       ← src/*.ts, each file transpiled on its own (readable)
//   plugin/server/scripts/setup.js            ← the token wizard, as in the repository
//   plugin/server/vendor/…                    ← the third-party packages the server uses, as published,
//                                                except that every literal require()/import() names its file by a
//                                                fixed relative path (resolved here with Node's own rules)
// Nothing is looked up, generated or downloaded at run time. Which packages:
// exactly those esbuild bundles into dist/index.js. Per package: its .js/.cjs/.mjs/.json files and
// licence files — no types, maps, tests, docs, or minified browser builds (any line over 3000
// characters), so every file stays readable and far below 256 KiB (checked here).
// The guides come from plugin/skills/huly (the server finds them there), the version is built in.
//
// Run when releasing: npm run plugin:bundle. `--check` only compares (CI/release).
'use strict'
const fs = require('fs')
const os = require('os')
const path = require('path')
const Module = require('module')
const esbuild = require('esbuild')

const root = path.join(__dirname, '..')
const target = path.join(root, 'plugin', 'server')
const MAX_FILE = 256 * 1024
const MAX_LINE = 3000
const OPTIONAL_NATIVE = ['bufferutil', 'utf-8-validate', 'msgpackr-extract', 'fsevents']
const KEEP = /\.(c|m)?js$|\.json$|^(licen[cs]e|notice)(\.[a-z]+)?$/i
const SKIP_DIRS = new Set(['node_modules', 'test', 'tests', '__tests__', 'docs', 'example', 'examples', '.github'])

const minified = (text) => text.split('\n').some((l) => l.length > MAX_LINE)

/** A relative import between src/*.ts files (Node's resolver does not know .ts). */
function resolveTs (spec, from) {
  if (!from.endsWith('.ts') || !spec.startsWith('.')) return undefined
  const base = path.resolve(path.dirname(from), spec)
  return [base, base + '.ts', path.join(base, 'index.ts')].find((f) => f.endsWith('.ts') && fs.existsSync(f))
}

/** Where a repository file goes in the tree: node_modules → vendor (a node_modules folder would be git-ignored). */
const destOf = (rel) => rel.replace(/(^|\/)node_modules\//g, '$1vendor/')

async function generate (out) {
  fs.rmSync(out, { recursive: true, force: true })
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'src', 'index.ts')],
    bundle: true, platform: 'node', target: 'node22', format: 'cjs', write: false, metafile: true,
    external: OPTIONAL_NATIVE, logLevel: 'warning', absWorkingDir: root
  })
  const packages = new Set()
  const files = new Map() // real path of the source → { dest (relative to out), text }
  for (const input of Object.keys(result.metafile.inputs).sort()) {
    if (input.startsWith('src/')) {
      const t = await esbuild.transform(fs.readFileSync(path.join(root, input), 'utf8'), { loader: 'ts', format: 'cjs', target: 'node22', sourcefile: input })
      files.set(path.join(root, input), { dest: input.replace(/\.ts$/, '.js'), text: t.code })
    } else if (input.startsWith('scripts/')) {
      files.set(path.join(root, input), { dest: input, text: fs.readFileSync(path.join(root, input), 'utf8') })
    } else {
      const m = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(input)
      if (m == null) throw new Error(`Unexpected input outside src/, scripts/ and node_modules: ${input}`)
      packages.add(m[1])
    }
  }
  const collect = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const s = path.join(dir, e.name)
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) collect(s); continue }
      if (!e.isFile() || !KEEP.test(e.name) || e.name.endsWith('.d.ts')) continue
      const text = fs.readFileSync(s, 'utf8')
      if (/\.(c|m)?js$/.test(e.name) && minified(text)) continue
      files.set(s, { dest: destOf(path.relative(root, s).split(path.sep).join('/')), text })
    }
  }
  for (const p of [...packages].sort()) collect(path.join(root, p))

  // Only what the server can load: walk the literal require() and import() calls from src/index, and point each
  // at its file by a fixed relative path, resolved now by Node's own rules from where the file really
  // lives — so nothing is looked up in node_modules at run time. Licence files of used packages go too.
  const reached = new Set()
  const queue = [path.join(root, 'src', 'index.ts')]
  const unresolved = []
  const dynamic = []
  while (queue.length > 0) {
    const real = queue.pop()
    if (reached.has(real)) continue
    reached.add(real)
    const f = files.get(real)
    if (!/\.(c|m)?js$|\.ts$/.test(real)) continue
    if (/\b(require|import)\(\s*[^'"\s)]/.test(f.text)) dynamic.push(f.dest)
    f.text = f.text.replace(/\b(require|import)\(\s*(['"])([^'"\n]+)\2\s*\)/g, (all, fn, q, spec) => {
      if (Module.isBuiltin(spec) || OPTIONAL_NATIVE.includes(spec) || spec.endsWith('.d.ts')) return all // .d.ts: a JSDoc type, not code
      let resolved
      resolved = resolveTs(spec, real)
      if (resolved == null) {
        try { resolved = require.resolve(spec, { paths: [path.dirname(real)] }) } catch { return all } // optional and absent: the code handles it
      }
      if (Module.isBuiltin(resolved)) return all
      const target = files.get(resolved)
      if (target == null) { unresolved.push(`${path.relative(root, real)}: ${spec} → ${path.relative(root, resolved)}`); return all }
      queue.push(resolved)
      let rel = path.posix.relative(path.posix.dirname(f.dest), target.dest)
      if (!rel.startsWith('.')) rel = './' + rel
      return `${fn}(${q}${rel}${q})`
    })
  }
  if (unresolved.length > 0) throw new Error(`Required but not in the tree:\n${unresolved.slice(0, 20).join('\n')}`)
  const usedPackages = new Set([...reached].map((r) => /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(r)?.[1]).filter(Boolean))
  for (const [real, f] of [...files]) {
    const pkg = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\/([^/]+)$/.exec(real)
    const licence = pkg != null && usedPackages.has(pkg[1]) && /^(licen[cs]e|notice)/i.test(pkg[2])
    if (!reached.has(real) && !licence) files.delete(real)
  }
  if (process.env.PLUGIN_BUNDLE_VERBOSE) console.log(`dynamic require() in: ${dynamic.join(', ') || 'none'}`)

  for (const f of files.values()) { fs.mkdirSync(path.dirname(path.join(out, f.dest)), { recursive: true }); fs.writeFileSync(path.join(out, f.dest), f.text) }
  fs.writeFileSync(path.join(out, 'index.js'), "#!/usr/bin/env node\n'use strict'\n// The Huly MCP server (src/index.ts) — see scripts/plugin-bundle.js in the repository.\nrequire('./src/index.js')\n")
  fs.chmodSync(path.join(out, 'index.js'), 0o755)
  return { packages: usedPackages.size, files: files.size + 1 }
}

/** Every file below dir, relative, sorted. */
function list (dir, base = dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? list(p, base) : [path.relative(base, p).split(path.sep).join('/')]
  }).sort()
}

async function main () {
  if (process.argv.includes('--check')) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'huly-plugin-server-'))
    try {
      await generate(tmp)
      const want = list(tmp)
      const have = list(target)
      const missing = want.filter((f) => !have.includes(f))
      const extra = have.filter((f) => !want.includes(f))
      const changed = want.filter((f) => have.includes(f) && !fs.readFileSync(path.join(tmp, f)).equals(fs.readFileSync(path.join(target, f))))
      if (missing.length + extra.length + changed.length > 0) {
        console.error(`plugin/server is not the current build (${missing.length} missing, ${extra.length} extra, ${changed.length} changed${changed.length > 0 ? `, e.g. ${changed[0]}` : ''}) — run: npm ci && npm run plugin:bundle, then commit it.`)
        process.exit(1)
      }
      console.log(`plugin/server matches the build (${want.length} files).`)
    } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
    return
  }
  const { packages, files } = await generate(target)
  const big = list(target).filter((f) => fs.statSync(path.join(target, f)).size > MAX_FILE)
  if (big.length > 0) throw new Error(`Files over 256 KiB in plugin/server (the plugin directory would refuse them): ${big.join(', ')}`)
  console.log(`plugin/server updated: ${files} files (src + ${packages} packages), none over 256 KiB.`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
