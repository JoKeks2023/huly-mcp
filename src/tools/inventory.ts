// Inventory (beta module): categories (tree), products in categories, variants (name + SKU).
// Everything is an attached doc in the workspace space; root categories hang off a fake ref.
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import type { z } from 'zod'
import type * as S from '../schemas'

export const INV = {
  Category: 'inventory:class:Category',
  Product: 'inventory:class:Product',
  Variant: 'inventory:class:Variant',
  Root: 'inventory:global:Category',
  Space: 'core:space:Workspace'
} as const

async function findOneOf (client: any, cls: string, ref: string, what: string, query: Record<string, unknown> = {}): Promise<any> {
  const all: any[] = await client.findAll(cls, query)
  const hits = all.filter((d) => d._id === ref || String(d.name).toLowerCase() === ref.trim().toLowerCase())
  if (hits.length === 1) return hits[0]
  if (hits.length === 0) throw new Error(`${what} '${ref}' not found.`)
  throw new Error(`${what} '${ref}' is ambiguous — pass its id.`)
}

export const listInventory = wrapToolHandler<z.infer<typeof S.ListInventorySchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const [cats, products, variants]: any[][] = await Promise.all([client.findAll(INV.Category, {}), client.findAll(INV.Product, {}), client.findAll(INV.Variant, {})])
  if (cats.length === 0 && products.length === 0) return 'Inventory is empty (or the module is not enabled).'
  const lines: string[] = []
  const walk = (parent: string, depth: number): void => {
    for (const c of cats.filter((x) => x.attachedTo === parent).sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
      lines.push(`${'  '.repeat(depth)}- 📁 **${String(c.name)}** — \`${String(c._id)}\``)
      for (const p of products.filter((x) => x.attachedTo === c._id)) {
        const vs = variants.filter((v) => v.attachedTo === p._id).map((v) => `${String(v.name)} (${String(v.sku)})`)
        lines.push(`${'  '.repeat(depth + 1)}- ${String(p.name)}${vs.length > 0 ? ` — ${vs.join(', ')}` : ''} — \`${String(p._id)}\``)
      }
      walk(c._id, depth + 1)
    }
  }
  walk(INV.Root, 0)
  return `## Inventory (${cats.length} categories, ${products.length} products, ${variants.length} variants)\n\n${lines.join('\n')}`
})

export const createInventoryCategory = wrapToolHandler<z.infer<typeof S.CreateInventoryCategorySchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const parent = args.parent != null ? (await findOneOf(client, INV.Category, args.parent, 'Category'))._id : INV.Root
  const id = await client.addCollection(INV.Category, INV.Space, parent, INV.Category, 'categories', { name: args.name.trim() })
  return `✅ Category **${args.name}** created — \`${String(id)}\``
})

export const createInventoryProduct = wrapToolHandler<z.infer<typeof S.CreateInventoryProductSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const cat = await findOneOf(client, INV.Category, args.category, 'Category')
  const id = await client.addCollection(INV.Product, INV.Space, cat._id, INV.Category, 'products', { name: args.name.trim() })
  for (const v of args.variants ?? []) await client.addCollection(INV.Variant, INV.Space, id, INV.Product, 'variants', { name: v.name.trim(), sku: v.sku.trim() })
  return `✅ Product **${args.name}** in ${String(cat.name)}${(args.variants ?? []).length > 0 ? ` with ${(args.variants ?? []).length} variant(s)` : ''} — \`${String(id)}\``
})

export const updateInventoryItem = wrapToolHandler<z.infer<typeof S.UpdateInventoryItemSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const doc = await client.findOne(INV.Category, { _id: args.id }) ?? await client.findOne(INV.Product, { _id: args.id }) ?? await client.findOne(INV.Variant, { _id: args.id })
  if (doc == null) throw new Error(`Inventory item '${args.id}' not found (ids come from list_inventory).`)
  const update: Record<string, unknown> = {}
  if (args.name != null) update.name = args.name.trim()
  if (args.sku != null) { if (doc._class !== INV.Variant) throw new Error('Only variants have a SKU.'); update.sku = args.sku.trim() }
  if (args.category != null) {
    if (doc._class !== INV.Product) throw new Error('Only products can move to another category.')
    update.attachedTo = (await findOneOf(client, INV.Category, args.category, 'Category'))._id
  }
  if (Object.keys(update).length === 0) throw new Error('Nothing to change.')
  await client.updateDoc(doc._class, doc.space, doc._id, update)
  return `✅ ${String(update.name ?? doc.name)} updated: ${Object.keys(update).map((k) => k === 'attachedTo' ? 'category' : k).join(', ')}.`
})

export const deleteInventoryItem = wrapToolHandler<z.infer<typeof S.DeleteInventoryItemSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const doc = await client.findOne(INV.Category, { _id: args.id }) ?? await client.findOne(INV.Product, { _id: args.id }) ?? await client.findOne(INV.Variant, { _id: args.id })
  if (doc == null) throw new Error(`Inventory item '${args.id}' not found (ids come from list_inventory).`)
  const children: any[] = doc._class === INV.Category
    ? [...await client.findAll(INV.Category, { attachedTo: doc._id }), ...await client.findAll(INV.Product, { attachedTo: doc._id })]
    : doc._class === INV.Product ? await client.findAll(INV.Variant, { attachedTo: doc._id }) : []
  if (children.length > 0 && args.recursive !== true) throw new Error(`${String(doc.name)} still contains ${children.length} item(s) — pass recursive=true to delete them too.`)
  const remove = async (d: any): Promise<number> => {
    let n = 0
    const kids: any[] = d._class === INV.Category
      ? [...await client.findAll(INV.Category, { attachedTo: d._id }), ...await client.findAll(INV.Product, { attachedTo: d._id })]
      : d._class === INV.Product ? await client.findAll(INV.Variant, { attachedTo: d._id }) : []
    for (const k of kids) n += await remove(k)
    await client.removeCollection(d._class, d.space, d._id, d.attachedTo, d.attachedToClass, d.collection)
    return n + 1
  }
  const n = await remove(doc)
  return `🗑️ ${String(doc.name)} deleted${n > 1 ? ` (with ${n - 1} item(s) inside)` : ''}.`
})
