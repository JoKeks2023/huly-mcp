// Products (products plugin, read-only): a product is a controlled-documents space,
// its versions form a chain (parent = previous version, state Active/Released).
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatDate, markupToText } from '../utils/format'
import type { z } from 'zod'
import type { ListProductsSchema, GetProductSchema } from '../schemas'

const P = { Product: 'products:class:Product', Version: 'products:class:ProductVersion', NoParent: 'products:ids:NoParentVersion' } as const
const STATE = ['Active', 'Released']

const versionName = (v: any): string => `${String(v.major)}.${String(v.minor)}.${String(v.patch)}${v.codename != null && v.codename !== '' ? ` "${String(v.codename)}"` : ''}`

export const listProducts = wrapToolHandler<z.infer<typeof ListProductsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const products: any[] = await client.findAll(P.Product, { archived: false })
  if (products.length === 0) return 'No products.'
  const lines: string[] = []
  for (const p of products) {
    const versions: any[] = await client.findAll(P.Version, { space: p._id })
    const active = versions.filter((v) => v.state === 0).map(versionName)
    lines.push(`- **${String(p.name)}** — ${versions.length} version(s)${active.length > 0 ? `, active: ${active.join(', ')}` : ''} — \`${String(p._id)}\``)
  }
  return `## Products (${products.length})\n\n${lines.join('\n')}`
})

export const getProduct = wrapToolHandler<z.infer<typeof GetProductSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const all: any[] = await client.findAll(P.Product, {})
  const hits = all.filter((p) => p._id === args.product || String(p.name).toLowerCase() === args.product.toLowerCase())
  if (hits.length !== 1) throw new Error(hits.length === 0 ? `Product '${args.product}' not found.` : `Product '${args.product}' is ambiguous.`)
  const p = hits[0]
  const versions: any[] = await client.findAll(P.Version, { space: p._id })
  versions.sort((a, b) => b.major - a.major || b.minor - a.minor || b.patch - a.patch)
  const lines = [`## ${String(p.name)}`, '', `**Id:** \`${String(p._id)}\``]
  const desc = [p.description, markupToText(p.fullDescription)].filter((x) => x != null && x !== '').join('\n\n')
  if (desc !== '') lines.push('', desc)
  lines.push('', `### Versions (${versions.length})`)
  for (const v of versions) {
    const d = markupToText(v.description)
    lines.push(`- **${versionName(v)}** — ${STATE[v.state] ?? String(v.state)}${v.readonly === true ? ', read-only' : ''} · ${formatDate(v.createdOn)}${d !== '' ? `\n  ${d.replace(/\n/g, ' ').slice(0, 200)}` : ''}`)
  }
  return lines.join('\n')
})
