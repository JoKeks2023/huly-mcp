// `huly-mcp junit <report.xml>`: push a CI test report into Huly as a test run.
import { readFile } from 'node:fs/promises'
import { normalizeEnv } from './env'
import { closeConnection } from './connection'
import { importJUnit, type ImportOptions } from './tools/test-automation'

export const JUNIT_HELP = `Usage: huly-mcp junit <report.xml> --project <test project> [options]

Imports a JUnit XML report (Jest, Vitest, pytest, Go, Gradle, Maven, xcpretty …) as a Huly test
run. Suites and cases that do not exist yet are created. Credentials come from the usual HULY_*
environment variables.

Options:
  --project <name>        Test project (required)
  --workspace <slug>      Workspace (needed when the account has several)
  --run <name>            Run name (default: "CI <date time>")
  --parent-suite <name>   Put the report's suites under this suite
  --no-create             Only record results for cases that already exist
  --fail-on-failures      Exit with code 1 when the report has failed tests
  --dry-run               Show what would happen, change nothing
`

export interface JUnitCliOptions extends Omit<ImportOptions, 'xml'> { file: string, failOnFailures: boolean }

export function parseJUnitArgs (argv: string[]): JUnitCliOptions {
  const o: Partial<JUnitCliOptions> = { failOnFailures: false }
  const value = (i: number, flag: string): string => {
    const v = argv[i + 1]
    if (v == null || v.startsWith('--')) throw new Error(`${flag} needs a value.`)
    return v
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case '--project': o.project = value(i, a); i++; break
      case '--workspace': o.workspace = value(i, a); i++; break
      case '--run': o.runName = value(i, a); i++; break
      case '--parent-suite': o.parentSuite = value(i, a); i++; break
      case '--no-create': o.createMissing = false; break
      case '--fail-on-failures': o.failOnFailures = true; break
      case '--dry-run': o.dryRun = true; break
      default:
        if (a.startsWith('--')) throw new Error(`Unknown option ${a}.`)
        if (o.file != null) throw new Error('Only one report file.')
        o.file = a
    }
  }
  if (o.file == null) throw new Error('Missing report file.')
  if (o.project == null) throw new Error('Missing --project.')
  return o as JUnitCliOptions
}

export async function runJUnit (argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h') || argv.length === 0) { process.stdout.write(JUNIT_HELP); return }
  let opts: JUnitCliOptions
  try { opts = parseJUnitArgs(argv) } catch (e) { process.stderr.write(`${(e as Error).message}\n\n${JUNIT_HELP}`); process.exitCode = 2; return }
  normalizeEnv()
  try {
    const xml = await readFile(opts.file, 'utf8')
    const summary = await importJUnit({ ...opts, xml })
    process.stdout.write(summary.text.replace(/\*\*/g, '') + '\n')
    if (opts.failOnFailures && summary.failed > 0) process.exitCode = 1
  } catch (e) {
    process.stderr.write(`huly-mcp junit: ${(e as Error).message}\n`)
    process.exitCode = 1
  } finally {
    await closeConnection()
  }
}
