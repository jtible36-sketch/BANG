const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { spawn } = require('node:child_process')
const { createRequire } = require('node:module')

// In the staged audit directory, read unchanged source/dependencies from the app,
// with staged source taking precedence. Installed in the app, this is ordinary
// project-local resolution. Neither mode opens the user's Naraflow database.
const overlay = path.resolve(__dirname, '..')
const root = process.env.NARAFLOW_SOURCE_ROOT
  ? path.resolve(process.env.NARAFLOW_SOURCE_ROOT)
  : fs.existsSync(path.join(overlay, 'package.json')) ? overlay : 'E:\\BANG'
const appRequire = createRequire(path.join(root, 'package.json'))
const esbuild = appRequire('esbuild')
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'naraflow-cutout-direction-test-'))
const modules = {
 // Scoped media-consent fixture only; no real providers. Real gate tested separately.
 './cutout-studio':`export const requireBriefApproved=()=>({approved:true,fixtureConsent:true});export const requireAssetConsent=()=>{};export const consumeAssetConsent=()=>{};export const readClipOutcomes=()=>[];export const completedClipMatches=()=>false;export const studioReport=()=>[];export const writeClipOutcome=()=>{};export const loadComedyProfile=()=>({id:'comedy-jolt',verified:false});`,
  './naraflow-mcp': `export const getNaraflowMcpStatus=()=>({running:false,descriptorPath:'fixture',relayPath:'fixture'});`,
  './codex-text': `export const generateCodexJson=options=>{if(!options.schema?.properties?.approved&&!options.system.includes('timeMs harus UNIK dalam satu grup layerKey; jangan pernah memberi dua pose dalam grup yang sama timestamp yang sama.'))throw Error('Missing uniqueness rule in planner/composer/repair prompt');return globalThis.__assetPlan(options)};`,
  './codex-connections': `export const requireCodexConnection=()=>{};export const withCodexConnection=async(c,fn,signal)=>fn(signal);export const codexConnectionStatus=async()=>({available:true,authenticated:true,imageGeneration:true,connections:{image:true,visual:true}});`,
  './providers/codex': `export const validateCodexSelection=async options=>options;export const generatePNG=options=>globalThis.__assetGenerate(options);`,
  './providers/flow-mcp': `export class FlowResponseError extends Error{};export const requireFlowReady=async()=>{throw Error('No live Flow in this test')};export const readFlowStatus=async()=>({available:false});export const cancelFlowRemote=async()=>{};export const flowOutputPath=p=>p;export const flowOwnerStatus=async()=>({jobs:[]});export const flowCall=async()=>{throw Error('No live Flow in this test')};`,
  './events': `export const emit={job:j=>globalThis.__progress?.push(j.message),asset:()=>{},clip:()=>{},character:()=>{},editorAutomation:()=>{}};`,
  './services/higgsfield': `export const cancelRequest=async()=>{};`
}
function sourceFile(relative) {
  for (const base of [...new Set([overlay, root])]) {
    const candidate = path.join(base, relative)
    for (const file of [candidate, candidate + '.ts', candidate + '.tsx', candidate + '.js', candidate + '.cjs', path.join(candidate, 'index.ts')]) {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return file
    }
  }
}
async function main() {
  const repairs = process.argv[3] === 'repairs'
  const entry = repairs ? path.join(root, 'tests/asset-inclusion-repair.integration.ts') : path.join(overlay, 'tests/pose-timestamp.integration.ts')
  const resultName = repairs ? 'asset-inclusion-repair-check.json' : 'pose-timestamp-check.json'
  const outfile = path.join(scratch, 'suite.cjs')
  await esbuild.build({
    entryPoints: [entry], outfile,
    platform: 'node', format: 'cjs', bundle: true, tsconfig: path.join(root, 'tsconfig.node.json'),
    nodePaths: [path.join(root, 'node_modules')], external: ['electron'],
    plugins: [{ name: 'isolated-controlled-providers', setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        if (Object.hasOwn(modules, args.path)) return { path: args.path, namespace: 'fixture' }
        if (['better-sqlite3', 'ffmpeg-static'].includes(args.path)) return { path: appRequire.resolve(args.path), external: true }
        if (args.path.startsWith('@shared/')) return { path: sourceFile('src/shared/' + args.path.slice(8)) }
        if (args.path.startsWith('.') && args.importer) {
          const candidate = path.resolve(path.dirname(args.importer), args.path)
          for (const base of [overlay, root]) {
            const relative = path.relative(base, candidate)
            if (!relative.startsWith('..') && !path.isAbsolute(relative) && /^(src|tests)[\\/]/.test(relative)) {
              const file = sourceFile(relative)
              if (file) return { path: file }
            }
          }
        }
      })
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js' }))
    } }]
  })
  const env = { ...process.env, CUTOUT_FFMPEG: appRequire('ffmpeg-static') }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(appRequire('electron'), [outfile, scratch], { env, cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)
  const timer = setTimeout(() => child.kill(), 180000)
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve) })
  clearTimeout(timer)
  if (code !== 0) throw Error('Cutout direction integration failed: ' + code)
  const result = JSON.parse(fs.readFileSync(path.join(scratch, resultName), 'utf8'))
  if (process.argv[2] || process.env.CUTOUT_TEST_OUTPUT) {
    const dest = path.resolve(process.argv[2] || process.env.CUTOUT_TEST_OUTPUT)
    fs.mkdirSync(dest, { recursive: true })
    fs.writeFileSync(path.join(dest, resultName), JSON.stringify(result, null, 2))
  }
  console.log(JSON.stringify(result))
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  const real = fs.realpathSync(scratch)
  if (path.dirname(real) === fs.realpathSync(os.tmpdir()) && path.basename(real).startsWith('naraflow-cutout-direction-test-')) fs.rmSync(real, { recursive: true, force: true })
})
