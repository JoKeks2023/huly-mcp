// Checks what `npm pack` would publish: no secrets, tests or CI files; warns when the package grows.
import { execSync } from 'node:child_process'
const [pack] = JSON.parse(execSync('npm pack --dry-run --json --ignore-scripts', { encoding: 'utf8' }))
const files = pack.files.map((f) => f.path)
const forbidden = files.filter((f) => /(^|\/)\.env($|\.(?!example$))|^test\/|^\.github\/|^src\/|\.test\.|^plugin\/|\.log$|^docs\/tasks\//.test(f))
const required = ['dist/index.js', 'README.md', '.env.example', 'package.json']
const missing = required.filter((f) => !files.includes(f))
const mb = (pack.unpackedSize / 1024 / 1024).toFixed(2)
console.log(`npm pack: ${files.length} files, ${(pack.size / 1024).toFixed(0)} kB packed, ${mb} MB unpacked`)
if (forbidden.length > 0) console.log(`::error::Files that must not be published: ${forbidden.join(', ')}`)
if (missing.length > 0) console.log(`::error::Missing from the package: ${missing.join(', ')}`)
if (pack.unpackedSize > 5 * 1024 * 1024) console.log(`::warning::Package is ${mb} MB unpacked (limit for this warning: 5 MB)`)
process.exit(forbidden.length + missing.length > 0 ? 1 : 0)
