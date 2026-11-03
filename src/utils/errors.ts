export class HulyMcpError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'HulyMcpError'
  }
}

type ToolResult = { content: Array<{ type: 'text', text: string }> }

export function wrapToolHandler<T extends Record<string, unknown>> (
  handler: (args: T) => Promise<string>
): (args: T) => Promise<ToolResult> {
  return async (args: T): Promise<ToolResult> => {
    try {
      const text = await handler(args)
      return { content: [{ type: 'text', text }] }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(message.startsWith('Huly MCP: ') ? message : `Huly MCP: ${message}`)
    }
  }
}
