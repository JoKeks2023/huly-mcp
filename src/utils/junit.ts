// Minimal JUnit XML reader (the format most test runners emit: Jest, Vitest, pytest, Go, Gradle,
// Maven Surefire, XCTest via xcpretty, node:test …). No dependency: testsuite/testcase elements,
// their attributes and failure/error/skipped children are all that is needed.

export type JUnitStatus = 'passed' | 'failed' | 'skipped'
export interface JUnitCase { suite: string, name: string, classname?: string, time?: number, status: JUnitStatus, message?: string, details?: string }

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
export function decodeXml (s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, c: string) => c.replace(/&/g, '\u0000amp;'))
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => e[0] === '#'
      ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : ENT[e.toLowerCase()])
    .replace(/\u0000amp;/g, '&')
}

function attrs (tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1]] = decodeXml(m[3] ?? m[4] ?? '')
  return out
}

/** Parses JUnit XML into flat test cases; suite = innermost <testsuite name>. */
export function parseJUnit (xml: string): JUnitCase[] {
  const src = xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?xml[\s\S]*?\?>/, '')
  if (!/<testsuites?[\s>]|<testcase[\s>]/.test(src)) throw new Error('Not JUnit XML: no <testsuite> or <testcase> element found.')
  const out: JUnitCase[] = []
  const stack: string[] = []
  const re = /<(\/?)(testsuites|testsuite|testcase)\b([^>]*?)(\/?)>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) != null) {
    const [, close, tag, rawAttrs, selfClose] = m
    if (tag === 'testsuite') {
      if (close === '/') stack.pop()
      else if (selfClose !== '/') stack.push(attrs(rawAttrs).name ?? '')
      continue
    }
    if (tag !== 'testcase' || close === '/') continue
    const a = attrs(rawAttrs)
    let body = ''
    if (selfClose !== '/') {
      const end = src.indexOf('</testcase>', re.lastIndex)
      if (end === -1) throw new Error(`Unclosed <testcase name="${a.name ?? '?'}">.`)
      body = src.slice(re.lastIndex, end)
      re.lastIndex = end + '</testcase>'.length
    }
    const c: JUnitCase = { suite: [...stack].reverse().find((s) => s !== '') ?? a.classname ?? 'Tests', name: a.name ?? '(unnamed)', status: 'passed' }
    if (a.classname != null && a.classname !== '') c.classname = a.classname
    if (a.time != null && !Number.isNaN(Number(a.time))) c.time = Number(a.time)
    const bad = /<(failure|error)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/.exec(body)
    if (bad != null) {
      c.status = 'failed'
      const ba = attrs(bad[2])
      c.message = ba.message ?? ba.type
      const text = decodeXml(bad[4] ?? '').trim()
      if (text !== '') c.details = text
    } else if (/<skipped\b/.test(body)) {
      c.status = 'skipped'
      const sa = /<skipped\b([^>]*)/.exec(body)
      if (sa != null) c.message = attrs(sa[1]).message
    }
    out.push(c)
  }
  return out
}
