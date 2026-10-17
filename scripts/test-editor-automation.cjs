'use strict'
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..')
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'naraflow-edit-test-'))
global.__fixtureEvents = []
const modules = {
 './cutout-composition-review':`export const reviewProductionComposition=async()=>({approved:true,problems:[],missingAssets:[]});`,
  './special-clips': `export const prepareSpecialVideos=()=>{throw Error('Special video needs integration fixture')};`,
  './cutout-auto-production': `export const prepareProductionAssets=()=>{throw Error('Production mode needs integration fixture')};export const productionContactSheets=()=>{throw Error('Production mode needs integration fixture')};`,
  electron: `export const app={isPackaged:false,getPath:()=>${JSON.stringify(scratch)},getAppPath:()=>${JSON.stringify(root)}}; export const webContents={fromId:()=>({once:()=>{},isDestroyed:()=>false})}; export const nativeImage={createFromBuffer:()=>({isEmpty:()=>false,getSize:()=>({width:10,height:10}),toPNG:()=>Buffer.from('fixture')})};`,
  './events': `export const emit={editorAutomation:value=>global.__fixtureEvents.push(value),job:()=>{}};`,
  './codex-text': `export const generateCodexJson=(options)=>global.__generateCodex(options);`,
  './codex-connections': `export const requireCodexConnection=()=>{}; export const codexConnectionStatus=async()=>({available:true,authenticated:true,connections:{visual:true},message:'fixture'});`,
  './media-import': `export const readManagedImageBytes=()=>Buffer.from('fixture');`,
  './naraflow-mcp': `export const getNaraflowMcpStatus=()=>({running:true,descriptorPath:'fixture',relayPath:'fixture'});`,
  './services/higgsfield': `export const cancelRequest=async()=>{};`,
  './providers/flow-mcp': `export const cancelFlowRemote=async()=>{};`
}
async function main() {
  const outfile = path.join(scratch, 'suite.cjs')
  await esbuild.build({ entryPoints: [path.join(root, 'tests/editor-automation.test.ts')], tsconfig: path.join(root, 'tsconfig.node.json'), bundle: true, platform: 'node', format: 'cjs', outfile, plugins: [{ name: 'isolated-edit-runtime', setup(build) {
    build.onResolve({ filter: /.*/ }, args => {
      if(args.path==='./special-clips' && !args.importer.endsWith('editor-automation.ts')) return undefined
      if (Object.hasOwn(modules, args.path)) return { path: args.path, namespace: 'fixture' }
      if (args.path === 'better-sqlite3') return { path: require.resolve('better-sqlite3'), external: true }
      return undefined
    })
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js' }))
  } }] })
  await require(outfile).run()
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  const resolved = fs.realpathSync(scratch)
  if (path.dirname(resolved) === fs.realpathSync(os.tmpdir()) && path.basename(resolved).startsWith('naraflow-edit-test-')) fs.rmSync(resolved, { recursive: true, force: true })
})
