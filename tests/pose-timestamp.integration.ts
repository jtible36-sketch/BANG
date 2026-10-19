import assert from 'node:assert/strict'
import { app } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { closeDb } from '../src/main/db'
import { createProject, replaceScript, getBundle, getJob } from '../src/main/repo'
import { planCutoutAssets, cutoutAssetState, appendCutoutRecoveryItems } from '../src/main/cutout-assets'
import { convertReviewMissingAssets } from '../src/main/cutout-review-recovery'
import { normalizeCutoutAssetItems, type CutoutAssetItem, type CutoutAssetPlan } from '../src/shared/cutout-assets'
import { composeCutoutAssets } from '../src/shared/cutout-production'
import { createCutoutLayer, createCutoutScene, normalizeCutoutScene, cutoutAssetIds, cutoutPoseAt, CUTOUT_LIMITS, CUTOUT_POSE_TIMING_RULE } from '../src/shared/cutout-timeline'
import type { Asset, Clip } from '../src/shared/types'

const root = resolve(process.argv[2]), g = globalThis as any, checks: string[] = [], logs: string[] = []
mkdirSync(root, { recursive: true }); app.setPath('userData', join(root, 'isolated-user-data'))
app.commandLine.appendSwitch('disable-gpu'); app.on('window-all-closed', () => {})
const warn = console.warn
console.warn = (...values: unknown[]) => { logs.push(values.join(' ')); warn(...values) }
async function check(name: string, run: () => unknown | Promise<unknown>) { await run(); checks.push(name); console.log('PASS', name) }
function item(id: string, timeMs: number, layerKey = 'actor'): CutoutAssetItem { return { id, timeMs, layerKey, role: 'pose', label: id, prompt: 'Photographic isolated pose with alpha.', characterId: null } }
function fixture(items: CutoutAssetItem[]) {
  const clip = { id: 'clip', durationMs: 3000, cutout: null } as Clip
  const plan: CutoutAssetPlan = { version: 1, id: 'plan', clipId: clip.id, sourceHash: 'fixture', items }
  const assets = items.map(i => ({ id: 'image-' + i.id, kind: 'image', clipId: clip.id, width: 90, height: 160, meta: { cutoutAsset: { planId: plan.id, itemId: i.id } } })) as Asset[]
  return { clip, plan, assets }
}
const seed = (f: ReturnType<typeof fixture>) => composeCutoutAssets(f.clip, f.plan, f.assets, '9:16')
async function done(id: string) { for (let n = 0; n < 1000; n++) { const j = getJob(id)!; if (['done','failed','canceled'].includes(j.status)) return j; await new Promise(r => setTimeout(r, 10)) } throw Error('Job timeout') }
const shot = (startMs: number, endMs: number, assetIds: string[]) => ({ startMs, endMs, assetIds, narrationCue: 'pose berubah', action: 'menunjuk', location: 'Toko', focus: 'engsel', startPose: 'netral', endPose: 'menunjuk', reaction: 'penasaran', camera: 'medium', occlusion: 'tidak ada', contact: 'tidak ada', sfxCue: 'tidak ada' })
let conversion = false
g.__assetPlan = async (o: any) => {
  assert(o.system.includes(CUTOUT_POSE_TIMING_RULE), 'Planning/recovery prompt must require unique pose times')
  const p = JSON.parse(o.prompt)
  if (p.requests) { conversion = true; return { items: p.requests.map((r: any) => item(r.id, 2160)) } }
  const items = [item('base', 0), item('start', 2160), item('end', 2160)]
  return { items, director: { timing: 'provisional', shots: [shot(0,2162,items.map(i=>i.id)),shot(2162,3000,['end'])], specialAssets: [] } }
}

void app.whenReady().then(async () => {
  await check('seed preserves both 2160ms poses and logs the exact +1ms adjustment', () => {
    const f = fixture([item('base',0),item('a',2160),item('b',2160)]), original = structuredClone(f)
    logs.length=0; const s=seed(f), layer=s.layers[0]
    assert.deepEqual(layer.poses.map(p=>p.timeMs),[2160,2161]); assert.deepEqual(cutoutAssetIds(s),['image-base','image-a','image-b'])
    assert(logs.includes('timeMs digeser otomatis: b 2160→2161')); assert.deepEqual(f,original)
    assert.equal(cutoutPoseAt(layer,2160),'image-a'); assert.equal(cutoutPoseAt(layer,2161),'image-b')
  })
  await check('three collisions cascade forward and never discard an asset', () => {
    const s=seed(fixture([item('base',0),item('a',2160),item('b',2160),item('c',2160),item('d',2161)]))
    assert.deepEqual(s.layers[0].poses.map(p=>p.timeMs),[2160,2161,2162,2163]); assert.equal(cutoutAssetIds(s).length,5)
  })
  await check('base image gets its own millisecond and separate layer groups can share a timestamp', () => {
    const s=seed(fixture([item('a',2160),item('b',2160),item('prop',2160,'prop')]))
    assert.equal(s.layers[0].inMs,2160); assert.equal(s.layers[0].poses[0].timeMs,2161); assert.equal(s.layers[1].inMs,2160)
  })
  await check('resume respects occupied times and repeated composition stays byte-identical', () => {
    const f=fixture([item('base',0),item('a',2160)]); const existing=seed(f), before=structuredClone(existing)
    const extra=fixture([item('base',0),item('a',2160),item('b',2160)])
    extra.clip.cutout=existing; const s=seed(extra)
    assert.deepEqual(s.layers[0].poses.map(p=>p.timeMs),[2160,2161]); assert.deepEqual(existing,before)
    extra.clip.cutout=s; logs.length=0; assert.deepEqual(seed(extra),s); assert.equal(logs.length,0)
  })
  await check('asset normalization repairs group collisions before planner validation without mutating input', () => {
    const raw=[item('a',2160),item('b',2160),item('prop',2160,'prop')], before=structuredClone(raw)
    const result=normalizeCutoutAssetItems(raw,3000,[])
    assert.deepEqual(result.map(i=>i.timeMs),[2160,2161,2160]); assert.deepEqual(raw,before)
    assert.deepEqual(normalizeCutoutAssetItems(result,3000,[]),result)
  })
  await check('implicit character groups receive the same collision protection', () => {
    const a=item('a',100),b=item('b',100); delete a.layerKey;delete b.layerKey
    assert.deepEqual(normalizeCutoutAssetItems([a,b],3000,[]).map(i=>i.timeMs),[100,101])
  })
  await check('imported duplicate pose times are repaired, sorted and logged, preserving fractional times', () => {
    const s=createCutoutScene(),l=createCutoutLayer('actor','Actor','base');s.layers=[l]
    l.poses=[{id:'a',assetId:'a',timeMs:2160.5},{id:'b',assetId:'b',timeMs:2160.5}]
    logs.length=0;const result=normalizeCutoutScene(s)!
    assert.deepEqual(result.layers[0].poses.map(p=>p.timeMs),[2160.5,2161.5]);assert(logs.includes('timeMs digeser otomatis: b 2160.5→2161.5'))
    assert.equal(s.layers[0].poses[1].timeMs,2160.5)
  })
  await check('duplicate IDs and duplicate camera/object key times are still rejected', () => {
    const s=createCutoutScene(),l=createCutoutLayer('actor','Actor','base');s.layers=[l]
    l.poses=[{id:'same',assetId:'a',timeMs:1},{id:'same',assetId:'b',timeMs:1}]; assert.throws(()=>normalizeCutoutScene(s),/ID pose harus unik/)
    l.poses=[];l.keyframes=['a','b'].map(id=>({id,timeMs:10,transform:l.transform,easing:'linear'}));assert.throws(()=>normalizeCutoutScene(s),/Waktu keyframe objek/)
    l.keyframes=[];s.camera.keyframes=['a','b'].map(id=>({id,timeMs:10,x:0,y:0,zoom:1,easing:'linear'}));assert.throws(()=>normalizeCutoutScene(s),/Waktu keyframe kamera/)
    assert.throws(()=>normalizeCutoutAssetItems([item('a',0),item('a',0)],3000,[]),/ID kebutuhan/)
  })
  await check('no free millisecond before clip/global limit gives an explicit error without extending duration', () => {
    assert.throws(()=>normalizeCutoutAssetItems([item('a',2999),item('b',2999)],3000,[]),/Tidak ada milidetik kosong/)
    assert.throws(()=>seed(fixture([item('a',2999),item('b',2999)])),/Tidak ada milidetik kosong/)
    const s=createCutoutScene(),l=createCutoutLayer('actor','Actor','base');s.layers=[l]
    l.poses=['a','b'].map(id=>({id,assetId:id,timeMs:CUTOUT_LIMITS.timeMs}));assert.throws(()=>normalizeCutoutScene(s),/Tidak ada milidetik kosong/)
  })
  let id='',plan:CutoutAssetPlan
  await check('actual planning job persists adjusted times and reloads them unchanged from SQLite', async () => {
    const p=createProject({durationSec:60}); id=p.id
    replaceScript(id,'Fixture',[{title:'Pintu',story:'Tokoh menunjuk engsel.',narration:'Pintu bergerak.',durationMs:3000}])
    const clip=getBundle(id).clips[0], j=await done(planCutoutAssets(clip.id).id);assert.equal(j.status,'done',j.error??'')
    plan=cutoutAssetState(clip.id).plan!;assert.deepEqual(plan.items.map(i=>i.timeMs),[0,2160,2161]);closeDb()
    assert.deepEqual(cutoutAssetState(clip.id).plan,plan)
  })
  await check('missing-asset conversion returns adjusted times before retry metadata is saved', async () => {
    const b=getBundle(id),clip=b.clips[0]
    const additions=await convertReviewMissingAssets({key:'fixture',descriptions:['New pose'],clip,bundle:b,plan,signal:new AbortController().signal})
    assert(conversion);assert.equal(additions[0].timeMs,2162)
    const next=appendCutoutRecoveryItems(clip.id,plan.id,plan.sourceHash,additions)
    assert.equal(next.items.at(-1)!.timeMs,2162);assert(next.director!.shots[1].assetIds.includes(additions[0].id))
    assert.deepEqual(appendCutoutRecoveryItems(clip.id,plan.id,plan.sourceHash,additions),next)
    assert.deepEqual(next.items.slice(0,3),plan.items);plan=next
  })
  await check('direct append persists collision repair and assigns the resulting shot, without replacing old items', () => {
    const clip=getBundle(id).clips[0],addition=item('manual-repair',2160),next=appendCutoutRecoveryItems(clip.id,plan.id,plan.sourceHash,[addition])
    assert.equal(next.items.at(-1)!.timeMs,2163);assert(next.director!.shots[1].assetIds.includes(addition.id))
    assert.equal(next.id,plan.id);assert.deepEqual(next.items.slice(0,4),plan.items)
    assert.deepEqual(cutoutAssetState(clip.id).plan,next)
  })
  const result={status:'passed',checks,actualElectron:true,actualSQLite:true,providers:'controlled; no external generation',userProjectsChanged:false}
  writeFileSync(join(root,'pose-timestamp-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));closeDb();app.quit()
}).catch(e=>{console.error(e);closeDb();app.exit(1)})
