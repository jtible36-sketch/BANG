const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),esbuild=require('esbuild')
const root=path.resolve(__dirname,'..'),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'naraflow-special-clips-test-'))
const modules={
 './naraflow-mcp':`export const getNaraflowMcpStatus=()=>({running:false,descriptorPath:'fixture',relayPath:'fixture'});`,
 './codex-text':`export const generateCodexJson=options=>globalThis.__assetPlan(options);`,
 './codex-connections':`export const requireCodexConnection=()=>{};export const withCodexConnection=async(c,fn,signal)=>fn(signal);export const codexConnectionStatus=async()=>({available:true,authenticated:true,imageGeneration:true,connections:{image:true,visual:true}});`,
 './providers/codex':`export const validateCodexSelection=async options=>{if(options.effort==='invalid')throw Error('Effort tidak didukung');return options};export const generatePNG=options=>globalThis.__assetGenerate(options);`,
 './providers/flow-mcp':`export class FlowResponseError extends Error{};export const requireFlowReady=async()=>{if(globalThis.__notReady)throw Error('provider offline')};export const readFlowStatus=async()=>({available:true,signedIn:true,inProject:true});export const cancelFlowRemote=async()=>{};export const flowOutputPath=p=>p;export const flowOwnerStatus=async()=>({jobs:[globalThis.__remote]});export const flowCall=async(method,args)=>{globalThis.__flowCalls.push({method,args});if(method==='generate'){if(globalThis.__flowCalls.filter(c=>c.method==='generate').length===globalThis.__failAt)throw new FlowResponseError('fixture rejected');globalThis.__remote={id:'remote-'+globalThis.__flowCalls.length,status:'done',files:[globalThis.__flowImage],project:args.project};if(globalThis.__uncertain)throw Error('lost connection');return {jobs:[globalThis.__remote]}}return {jobs:[globalThis.__remote]}};`,
 './events':`export const emit={job:()=>{},asset:()=>{},clip:()=>{},character:()=>{},editorAutomation:()=>{}};`,
 './services/higgsfield':`export const cancelRequest=async()=>{};`
}
async function main(){
 const outfile=path.join(scratch,'suite.cjs')
 await esbuild.build({entryPoints:[path.join(root,'tests/cutout-v6.integration.ts')],outfile,platform:'node',format:'cjs',bundle:true,tsconfig:path.join(root,'tsconfig.node.json'),external:['electron'],plugins:[{name:'controlled-providers',setup(build){
  build.onResolve({filter:/.*/},args=>{if(Object.hasOwn(modules,args.path))return {path:args.path,namespace:'fixture'};if(['better-sqlite3','ffmpeg-static'].includes(args.path))return {path:require.resolve(args.path),external:true}})
  build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:modules[args.path],loader:'js'}))
 }}]})
 const env={...process.env,CUTOUT_FFMPEG:require('ffmpeg-static')};delete env.ELECTRON_RUN_AS_NODE
 const child=spawn(require('electron'),[outfile,scratch],{env,cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']})
 child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr)
 const timer=setTimeout(()=>child.kill(),180000)
 const code=await new Promise(resolve=>child.on('exit',resolve));clearTimeout(timer)
 if(code!==0)throw Error('Cutout assets integration failed: '+code)
 const result=JSON.parse(fs.readFileSync(path.join(scratch,'result.json'),'utf8'))
 if(process.env.CUTOUT_TEST_OUTPUT||process.argv[2]){const dest=path.resolve(process.env.CUTOUT_TEST_OUTPUT||process.argv[2]);fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'cutout-v6-check.json'),JSON.stringify(result,null,2))}
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{const real=fs.realpathSync(scratch);if(path.dirname(real)===fs.realpathSync(os.tmpdir())&&path.basename(real).startsWith('naraflow-special-clips-test-'))fs.rmSync(real,{recursive:true,force:true})})
