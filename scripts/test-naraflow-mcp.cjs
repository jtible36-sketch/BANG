'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const { spawn } = require('node:child_process')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..')
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'naraflow-mcp-test-'))
let service
let child

const mockModules = {
 './narration-tempo':`export const retimeNarration=async()=>({id:'tempo-1',status:'queued'});`,
  './script-revision':`export const createScriptRevision=async()=>({projectId:'copy-1',revision:'copy-r1',reused:false});`,
  './narration':`export const generateNarration=()=>({id:'voice-1',status:'queued'});`,
  electron: `export const app={isPackaged:false,getAppPath:()=>${JSON.stringify(root)}}; export const nativeImage={createFromBuffer:()=>({isEmpty:()=>false,getSize:()=>({width:10,height:10}),toPNG:()=>Buffer.from('fixture')})};`,
  './paths': `export const dataDir=()=>${JSON.stringify(scratch)};`,
  './repo': `export const listProjects=()=>[{id:'project-1',title:'Fixture'}]; export const getBundle=()=>({project:{editor:{duckMusic:true}},clips:[{id:'clip-1'}]}); export const getJob=id=>({id,projectId:'project-1',kind:'export',status:'done',progress:1,message:'completed.mp4',error:null,payload:{secret:'NEVER-EXPOSE'}});`,
  './cutout-assets': `export const cutoutAssetState=()=>({plan:{id:'plan-1'},stale:false,assets:[],jobs:[]});export const planCutoutAssets=()=>({id:'plan-job',status:'queued'});export const saveCutoutAssetPlan=(clipId,items)=>({id:'plan-1',clipId,items});export const generateCutoutAsset=()=>({id:'asset-job',status:'queued'});export const recoverCutoutAssets=async()=>[];`,
  './editor-automation': `export const ensureEditorsReady=async()=>{if(global.__mcpDirty)throw Error('Unsaved editor')};export const editorAutomationStatus=async()=>({connected:true}); export const getEditingContext=id=>({projectId:id,revision:'r1'}); export const validateEditingPlan=(id,rev,plan)=>{if(rev!=='r1')throw Error('Stale revision'); if(global.__mcpDirty)throw Error('Unsaved editor');return {valid:true,plan}}; export const applyEditingPlan=(id,rev,plan)=>{validateEditingPlan(id,rev,plan);global.__mcpApply=(global.__mcpApply||0)+1;return {revision:'r2',summary:plan.summary,undoId:'undo-1',bundle:{private:'not returned'}}}; export const undoEditingPlan=()=>({revision:'r3',summary:'Undo',undoId:'undo-2'});`,
  './media-import': `export const readManagedImageBytes=(asset,project)=>{if(project!=='project-1'||asset!=='image-1')throw Error('Asset not in project');return Buffer.from('fixture')};`,
  './exporter': `export const startExport=(projectId,opts)=>{global.__mcpExport={projectId,opts};return {id:'export-1',status:'queued'}};`
}

async function build() {
  await esbuild.build({ entryPoints: [path.join(root, 'src/main/naraflow-mcp.ts')], tsconfig: path.join(root, 'tsconfig.node.json'), bundle: true, platform: 'node', format: 'cjs', outfile: path.join(scratch, 'service.cjs'), plugins: [{ name: 'isolated-services', setup(build) {
    build.onResolve({ filter: /.*/ }, args => Object.hasOwn(mockModules, args.path) && (args.path === 'electron' || args.importer.replace(/\\/g, '/').endsWith('/src/main/naraflow-mcp.ts')) ? { path: args.path, namespace: 'fixture' } : undefined)
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mockModules[args.path], loader: 'js' }))
  } }] })
  await esbuild.build({ entryPoints: [path.join(root, 'src/main/naraflow-mcp-protocol.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: path.join(scratch, 'protocol.cjs') })
}

function httpCall(port, token, overrides = {}) {
  const body = overrides.body ?? JSON.stringify({ method: 'tools/list', params: {} })
  return new Promise((resolve, reject) => {
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...overrides.headers }
    for (const key of Object.keys(headers)) if (headers[key] === undefined) delete headers[key]
    const request = http.request({ host: '127.0.0.1', port, method: overrides.method ?? 'POST', path: overrides.path ?? '/rpc', headers }, response => {
      let data = ''
      response.on('data', chunk => { data += chunk })
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(data) }))
    })
    request.on('error', error => reject(new Error(`HTTP case ${JSON.stringify({ ...overrides, body: typeof overrides.body === 'string' ? `${overrides.body.length} bytes` : undefined })}: ${error.message}`))); request.end(body)
  })
}

function startRelay(descriptor) {
  const proc = spawn(process.execPath, [path.join(root, 'resources/naraflow-mcp/server.cjs'), '--connection', descriptor], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  let pending = '', stderr = '', queued = []
  const readers = []
  proc.stdout.on('data', chunk => {
    pending += chunk.toString()
    let newline
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline); pending = pending.slice(newline + 1)
      const value = JSON.parse(line)
      const reader = readers.shift()
      if (reader) reader(value); else queued.push(value)
    }
  })
  proc.stderr.on('data', chunk => { stderr += chunk.toString() })
  const next = () => new Promise((resolve, reject) => {
    if (queued.length) return resolve(queued.shift())
    const timeout = setTimeout(() => reject(Error('Relay response timeout')), 10_000)
    readers.push(value => { clearTimeout(timeout); resolve(value) })
  })
  return { proc, stderr: () => stderr, send: value => proc.stdin.write(typeof value === 'string' ? value : JSON.stringify(value) + '\n'), next, request: async value => { proc.stdin.write(JSON.stringify(value) + '\n'); return next() } }
}

async function main() {
  await build()
  service = require(path.join(scratch, 'service.cjs'))
  const { port, descriptorPath, relayPath } = await service.startNaraflowMcp()
  const descriptor = JSON.parse(fs.readFileSync(descriptorPath, 'utf8'))
  const token = descriptor.token
  assert.equal(descriptor.host, '127.0.0.1')
  assert.equal(descriptor.token.length, 64)
  assert.equal(relayPath, path.join(root, 'resources/naraflow-mcp/server.cjs'))
  assert.equal(service.getNaraflowMcpStatus().running, true)
  assert.equal(JSON.stringify(service.getNaraflowMcpStatus()).includes(token), false)
  assert.equal((await service.startNaraflowMcp()).port, port)
  assert.equal((await httpCall(port, token)).status, 200)
  assert.equal((await httpCall(port, 'x'.repeat(64))).status, 401)
  assert.equal((await httpCall(port, token, { headers: { Host: 'attacker.example' } })).status, 403)
  assert.equal((await httpCall(port, token, { headers: { Origin: 'http://localhost' } })).status, 403)
  assert.equal((await httpCall(port, token, { headers: { 'Sec-Fetch-Site': 'same-origin' } })).status, 403)
  assert.equal((await httpCall(port, token, { method: 'GET' })).status, 405)
  assert.equal((await httpCall(port, token, { path: '/other' })).status, 404)
  assert.equal((await httpCall(port, token, { headers: { 'Content-Type': 'text/plain' } })).status, 415)
  assert.equal((await httpCall(port, token, { headers: { 'Content-Encoding': 'gzip' } })).status, 415)
  assert.equal((await httpCall(port, token, { body: '{' })).body.error.code, -32700)
  assert.equal((await httpCall(port, token, { body: '[]' })).body.error.code, -32600)
  assert.equal((await httpCall(port, token, { body: JSON.stringify({ method: 'shell', params: {} }) })).body.error.code, -32601)
  assert.equal((await httpCall(port, token, { body: '{}', headers: { 'Content-Length': 4 * 1024 * 1024 + 1 } })).status, 413)
  // A server may close an oversized upload while Windows is still sending it; both outcomes reject it.
  const oversized = await httpCall(port, token, { body: ' '.repeat(4 * 1024 * 1024 + 1), headers: { 'Content-Length': undefined, 'Transfer-Encoding': 'chunked' } }).catch(error => {
    if (/ECONNRESET|EPIPE/.test(error.message)) return { status: 413 }
    throw error
  })
  assert.equal(oversized.status, 413)
  const call = (name, arguments_) => service.dispatchNaraflowMcp('tools/call', { name, arguments: arguments_ })
  assert.equal((await call('naraflow_status', {})).structuredContent.editor.connected, true)
  assert.deepEqual((await call('naraflow_get_project', { projectId: 'project-1' })).structuredContent, { projectId: 'project-1', revision: 'r1' })
  assert.equal((await call('naraflow_preview_asset', { projectId: 'project-1', assetId: 'image-1' })).content[1].type, 'image')
  assert.equal((await call('naraflow_preview_asset', { projectId: 'foreign', assetId: 'image-1' })).isError, true)
  await assert.rejects(call('naraflow_get_project', { projectId: '../private' }), /ID tidak valid/)
  await assert.rejects(call('naraflow_get_project', { projectId: 'project-1', unexpected: true }), /Argumen/)
  await assert.rejects(call('shell', {}), /Unknown tool/)
  const plan = { summary: 'Move actor', clips: [] }
  assert.equal((await call('naraflow_get_asset_plan',{projectId:'project-1',clipId:'clip-1'})).structuredContent.plan.id,'plan-1')
  assert.equal((await call('naraflow_get_asset_plan',{projectId:'project-1',clipId:'foreign'})).isError,true)
  assert.equal((await call('naraflow_plan_cutout_assets',{projectId:'project-1',clipId:'clip-1',expectedRevision:'stale'})).isError,true)
  assert.equal((await call('naraflow_generate_cutout_asset',{projectId:'project-1',clipId:'clip-1',expectedRevision:'r1',planId:'plan-1',itemId:'item-1',provider:'codex',format:'webp'})).structuredContent.jobId,'asset-job')
  assert.equal((await call('naraflow_validate_edit', { projectId: 'project-1', expectedRevision: 'stale', plan })).isError, true)
  assert.equal((await call('naraflow_apply_edit', { projectId: 'project-1', expectedRevision: 'r1', plan })).structuredContent.revision, 'r2')
  assert.equal((await call('naraflow_undo_edit', { projectId: 'project-1', expectedRevision: 'r2' })).structuredContent.revision, 'r3')
  const job = await call('naraflow_get_job', { projectId: 'project-1', jobId: 'job-1' })
  assert.equal(JSON.stringify(job).includes('NEVER-EXPOSE'), false)
  assert.equal((await call('naraflow_get_job', { projectId: 'foreign', jobId: 'job-1' })).isError, true)
  const exported = await call('naraflow_export_project', { projectId: 'project-1', expectedRevision: 'r1' })
  assert.equal(exported.structuredContent.jobId, 'export-1')
  assert.equal(global.__mcpExport.opts.folder, path.join(scratch, 'exports', 'mcp'))
  assert.match(global.__mcpExport.opts.fileName, /^naraflow-[0-9a-f-]+\.mp4$/)
  global.__mcpDirty = true
  assert.equal((await call('naraflow_export_project', { projectId: 'project-1', expectedRevision: 'r1' })).isError, true)
  global.__mcpDirty = false
  await assert.rejects(call('naraflow_export_project', { projectId: 'project-1', expectedRevision: 'r1', resolution: '1080' }), /Resolusi/)
  await assert.rejects(call('naraflow_export_project', { projectId: 'project-1', expectedRevision: 'r1', folder: 'C:/secret' }), /Argumen/)

  const relay = startRelay(descriptorPath); child = relay.proc
  const rpc = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) })
  assert.equal((await relay.request(rpc(1, 'tools/list'))).error.code, -32002)
  const initialized = await relay.request(rpc(2, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'isolated-test', version: '1' } }))
  assert.equal(initialized.result.protocolVersion, '2025-06-18')
  relay.send({ jsonrpc: '2.0', method: 'notifications/initialized' })
  const listed = await relay.request(rpc(3, 'tools/list'))
  assert.equal(listed.result.tools.length, 17)
  assert.equal(listed.result.tools.find(t => t.name === 'naraflow_apply_edit').inputSchema.properties.plan.type, 'object')
  assert.equal((await relay.request(rpc(4, 'tools/call', { name: 'naraflow_get_project', arguments: { projectId: 'project-1' } }))).result.structuredContent.revision, 'r1')
  relay.send({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'naraflow_apply_edit', arguments: { projectId: 'project-1', expectedRevision: 'r1', plan } } })
  const before = global.__mcpApply
  assert.deepEqual((await relay.request(rpc(5, 'ping'))).result, {})
  assert.equal(global.__mcpApply, before)
  relay.send('{broken}\n'); assert.equal((await relay.next()).error.code, -32700)
  assert.equal((await relay.request([])).error.code, -32600)
  assert.equal((await relay.request(rpc(6, 'unknown'))).error.code, -32601)
  relay.send('x'.repeat(4 * 1024 * 1024 + 1) + '\n')
  assert.equal((await relay.next()).error.code, -32600)
  assert.deepEqual((await relay.request(rpc(7, 'ping'))).result, {})
  assert.equal(relay.stderr(), '')
  // Keep the same client alive while Naraflow closes and relaunches with a fresh port/token.
  service.stopNaraflowMcp()
  assert.equal(fs.existsSync(descriptorPath), false)
  const offlineList = await relay.request(rpc(8, 'tools/list'))
  assert.deepEqual(offlineList.result.tools, listed.result.tools)
  const offlineCall = await relay.request(rpc(9, 'tools/call', { name: 'naraflow_status', arguments: {} }))
  assert.equal(offlineCall.error.code, -32001)
  const restarted = await service.startNaraflowMcp()
  assert.equal(restarted.descriptorPath, descriptorPath)
  assert.notEqual(JSON.parse(fs.readFileSync(descriptorPath, 'utf8')).token, token)
  const reconnected = await relay.request(rpc(10, 'tools/call', { name: 'naraflow_status', arguments: {} }))
  assert.equal(reconnected.result.structuredContent.running, true)
  child.stdin.end(); await new Promise(resolve => child.once('exit', resolve)); child = null
  service.stopNaraflowMcp()
  assert.equal(fs.existsSync(descriptorPath), false)
  assert.equal(service.getNaraflowMcpStatus().running, false)
  console.log('Naraflow MCP passed: real stdio relay, 17 tools, online/offline schema discovery, reconnect after app restart, image scoping, asset generation guards, edit/undo/export guards, host/origin/auth/body bounds, lifecycle, notifications and descriptor cleanup. Isolated fixtures; no user database opened.')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  child?.kill(); service?.stopNaraflowMcp()
  const resolved = fs.realpathSync(scratch)
  if (path.dirname(resolved) === fs.realpathSync(os.tmpdir()) && path.basename(resolved).startsWith('naraflow-mcp-test-')) fs.rmSync(resolved, { recursive: true, force: true })
})
