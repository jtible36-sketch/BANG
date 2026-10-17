import { createServer, type IncomingMessage, type Server } from 'node:http'
import { timingSafeEqual } from 'node:crypto'

/** Private bridge transport. Public MCP is stdio; this is intentionally not a Streamable HTTP endpoint. */
export const MCP_RPC_MAX_BYTES = 4 * 1024 * 1024
export const MCP_RPC_MAX_RESPONSE_BYTES = 32 * 1024 * 1024
export class NaraflowRpcError extends Error {
  constructor(public readonly code: number, message: string) { super(message) }
}
export type NaraflowRpcDispatch = (method: string, params: unknown) => unknown | Promise<unknown>

export function createNaraflowRpcServer(token: string, dispatch: NaraflowRpcDispatch): Server {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid bridge token')
  const secret = Buffer.from(`Bearer ${token}`)
  let active = 0
  const server = createServer(async (req, res) => {
    const send = (status: number, value: unknown) => {
      if (res.writableEnded || res.destroyed) return
      let body = JSON.stringify(value)
      if (Buffer.byteLength(body) > MCP_RPC_MAX_RESPONSE_BYTES) {
        status = 500; body = JSON.stringify({ error: { code: -32603, message: 'Respons terlalu besar. Gunakan proyek yang lebih kecil.' } })
      }
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Connection: 'close' })
      res.end(body)
    }
    const reject = (status: number, message: string) => {
      send(status, { error: { code: -32600, message } }); req.resume()
    }
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    if (req.socket.remoteAddress !== '127.0.0.1' || req.headers.host !== `127.0.0.1:${port}`) return reject(403, 'Loopback host required')
    // The stdio relay never sets Origin. Reject all browser origins, including localhost.
    if (req.headers.origin !== undefined || req.headers['sec-fetch-site'] !== undefined) return reject(403, 'Browser origins are not accepted')
    const supplied = Buffer.from(req.headers.authorization ?? '')
    if (supplied.length !== secret.length || !timingSafeEqual(supplied, secret)) return reject(401, 'Authentication required')
    if (req.url !== '/rpc') return reject(404, 'Unknown endpoint')
    if (req.method !== 'POST') return reject(405, 'POST required')
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) return reject(415, 'JSON required')
    if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') return reject(415, 'Encoded bodies are not accepted')
    const declared = Number(req.headers['content-length'] ?? 0)
    if (!Number.isFinite(declared) || declared > MCP_RPC_MAX_BYTES) return reject(413, 'Request too large')
    if (active >= 8) return reject(429, 'Too many requests')
    active++
    try {
      const value: unknown = JSON.parse(await readBody(req))
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NaraflowRpcError(-32600, 'Invalid request')
      const request = value as Record<string, unknown>
      if (Object.keys(request).some(k => !['method', 'params'].includes(k)) || typeof request.method !== 'string') throw new NaraflowRpcError(-32600, 'Invalid request')
      if (!['tools/list', 'tools/call'].includes(request.method)) throw new NaraflowRpcError(-32601, 'Method not found')
      send(200, { result: await dispatch(request.method, request.params) })
    } catch (error) {
      if (error instanceof NaraflowRpcError) send(error.code === -32013 ? 413 : 400, { error: { code: error.code, message: error.message } })
      else if (error instanceof SyntaxError) send(400, { error: { code: -32700, message: 'Invalid JSON' } })
      else send(500, { error: { code: -32603, message: 'Naraflow bridge gagal memproses permintaan.' } })
    } finally { active-- }
  })
  server.requestTimeout = 15_000
  server.headersTimeout = 10_000
  server.keepAliveTimeout = 1_000
  server.maxHeadersCount = 32
  return server
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0; let ended = false
    const finish = (error?: Error) => {
      if (ended) return
      ended = true; clearTimeout(timer)
      if (error) reject(error); else resolve(Buffer.concat(chunks).toString('utf8'))
    }
    const timer = setTimeout(() => { finish(new NaraflowRpcError(-32600, 'Request timed out')); req.resume() }, 10_000)
    req.on('data', (chunk: Buffer) => {
      if (ended) return
      size += chunk.length
      if (size > MCP_RPC_MAX_BYTES) { finish(new NaraflowRpcError(-32013, 'Request too large')); req.resume() }
      else chunks.push(chunk)
    })
    req.once('end', () => finish())
    req.once('error', finish)
    req.once('aborted', () => finish(new NaraflowRpcError(-32600, 'Request aborted')))
  })
}
