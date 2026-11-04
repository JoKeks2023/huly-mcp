// Local file access for uploads/downloads. Off unless HULY_FILE_ROOT names a directory:
// the server may run remotely (Docker), where arbitrary paths would expose its own files.
import { realpathSync, existsSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'

export function fileRoot (env: NodeJS.ProcessEnv = process.env): string | undefined {
  const root = env.HULY_FILE_ROOT
  return root != null && root !== '' ? realpathSync(root) : undefined
}

/** Absolute path inside HULY_FILE_ROOT, or an error explaining how to enable local files. */
export function localPath (path: string, env: NodeJS.ProcessEnv = process.env): string {
  const root = fileRoot(env)
  if (root == null) throw new Error('Local file paths are disabled. Set HULY_FILE_ROOT to a directory to allow them, or pass contentBase64.')
  const abs = resolve(root, path)
  // Resolve symlinks of the existing part so a link cannot point outside the root.
  const existing = existsSync(abs) ? realpathSync(abs) : resolve(realpathSync(dirname(abs)), abs.split(sep).pop() ?? '')
  if (existing !== root && !existing.startsWith(root + sep)) throw new Error(`'${path}' is outside HULY_FILE_ROOT.`)
  return existing
}

const TEXT_TYPES = /^(text\/|application\/(json|xml|javascript|x-yaml|yaml|sql|x-sh|toml)|image\/svg)/

export const isTextType = (mime: string | undefined): boolean => TEXT_TYPES.test(mime ?? '')

const EXT_TYPES: Record<string, string> = {
  txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json', html: 'text/html', xml: 'application/xml',
  yaml: 'application/yaml', yml: 'application/yaml', pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', zip: 'application/zip', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  mp4: 'video/mp4', mp3: 'audio/mpeg', ts: 'text/plain', js: 'text/javascript', sh: 'application/x-sh'
}

export const mimeFromName = (name: string): string => EXT_TYPES[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
