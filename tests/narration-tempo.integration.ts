import assert from 'node:assert/strict'
import {app} from 'electron'
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import ffmpeg from 'ffmpeg-static'
import {createProject,replaceScript,getBundle,insertAsset,patchClip,getJob} from '../src/main/repo'
import {getEditingContext} from '../src/main/editor-automation'
import {retimeNarration} from '../src/main/narration-tempo'
import {projectDir} from '../src/main/paths'
import {closeDb,getDb} from '../src/main/db'
const root=resolve(process.argv[2]);mkdirSync(root,{recursive:true});app.setPath('userData',join(root,'isolated-user-data'));app.commandLine.appendSwitch('disable-gpu');app.on('window-all-closed',()=>{})
async function done(id:string){for(let i=0;i<2000;i++){const j=getJob(id)!;if(['done','failed','canceled'].includes(j.status))return j;await new Promise(r=>setTimeout(r,10))}throw Error('timeout')}
app.whenReady().then(async()=>{
 const p=createProject({durationSec:60,styleId:'cutout-facts'});replaceScript(p.id,'Tempo fixture',[{title:'One',story:'One',narration:'Satu dua tiga empat.',durationMs:4000}]);const c=getBundle(p.id).clips[0],file=join(projectDir(p.id),'voice.wav');execFileSync(ffmpeg!,['-v','error','-f','lavfi','-i','sine=frequency=440:sample_rate=44100:duration=4','-c:a','pcm_s16le',file],{windowsHide:true});const source=insertAsset({projectId:p.id,clipId:c.id,kind:'audio',provider:'fixture',prompt:c.narration,localPath:'voice.wav',durationMs:4000,meta:{words:[{word:'Satu',start:.4,end:.8},{word:'dua',start:1.2,end:1.6},{word:'tiga',start:2,end:2.4},{word:'empat.',start:2.8,end:3.2}]}});patchClip(c.id,{audioAssetId:source.id});const before=getEditingContext(p.id)
 await assert.rejects(retimeNarration(p.id,before.revision,2),/Tempo/)
 await assert.rejects(retimeNarration(p.id,'old',1.35),/Revisi|revisi/)
 const job=await retimeNarration(p.id,before.revision,1.35),result=await done(job.id);assert.equal(result.status,'done',result.error??'');const b=getBundle(p.id),a=b.assets.find(a=>a.id===b.clips[0].audioAssetId)!;assert.notEqual(a.id,source.id);assert.equal(a.provider,'local');assert.equal(b.assets.length,2);assert(existsSync(file));assert(Math.abs(a.durationMs!-4000/1.35)<80);assert(Math.abs((a.meta.words as any[])[1].start-1.2/1.35)<1e-9)
 const raw=execFileSync(ffmpeg!,['-v','error','-i',join(projectDir(p.id),a.localPath),'-f','s16le','-ac','1','-ar','44100','pipe:1'],{windowsHide:true,maxBuffer:2e6});let crossings=0;for(let i=2;i<raw.length;i+=2)if(raw.readInt16LE(i-2)<0&&raw.readInt16LE(i)>=0)crossings++;const hz=crossings/(raw.length/2/44100);assert(Math.abs(hz-440)<5)
 const revision=getEditingContext(p.id).revision;getDb().prepare('UPDATE projects SET editor_json=json_set(editor_json,\'$.overlays\',json(?)) WHERE id=?').run(JSON.stringify([{id:'label',kind:'text',text:'Already timed',start:0,end:1}]),p.id);await assert.rejects(retimeNarration(p.id,getEditingContext(p.id).revision,1.1),/sebelum/)
 writeFileSync(join(root,'narration-tempo-check.json'),JSON.stringify({status:'passed',actualFFmpeg:true,originalPreserved:true,rate:1.35,sourceMs:4000,outputMs:a.durationMs,pitchHz:hz,wordTimingsScaled:true,staleRevisionRejected:true,existingTimedVisualsRejected:true,liveUserDatabaseTouched:false},null,2));closeDb();app.quit()
}).catch(e=>{console.error(e);closeDb();app.exit(1)})
