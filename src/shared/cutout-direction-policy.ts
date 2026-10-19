import type { Asset } from './types'
import type { CutoutDirector } from './cutout-director'
import { cutoutCameraAt, evaluateCutoutScene, type CutoutDrawItem, type CutoutScene, type CutoutTransform } from './cutout-timeline'

export interface CutoutDirectionAudit { problems: string[]; missingAssets: string[] }
type AssetEvidence = { role?: string; transparentFraction?: number }
const CONTACT_EASING = new Set(['linear', 'hold'])
const ELASTIC_EASING = new Set(['spring', 'back-out'])
const WIDTH = 720, HEIGHT = 1280

function evidence(asset: Asset | undefined): AssetEvidence {
  const value = asset?.meta.cutoutAsset
  return value && typeof value === 'object' ? value as AssetEvidence : {}
}
function useful(item: CutoutDrawItem): boolean {
  if (item.opacity <= .01) return false
  const [a,b,c,d,e,f] = item.matrix
  const corners = [[e,f],[a*item.width+e,b*item.width+f],[c*item.height+e,d*item.height+f],[a*item.width+c*item.height+e,b*item.width+d*item.height+f]]
  return Math.min(WIDTH, Math.max(...corners.map(p=>p[0]))) - Math.max(0, Math.min(...corners.map(p=>p[0]))) > 1 &&
    Math.min(HEIGHT, Math.max(...corners.map(p=>p[1]))) - Math.max(0, Math.min(...corners.map(p=>p[1]))) > 1
}
function physicalAsset(asset: Asset): string {
  return asset.localPath ? asset.localPath.replace(/\\/g, '/').toLowerCase() : asset.id
}
function changed(a: readonly number[], b: readonly number[]): boolean { return a.some((v,i)=>Math.abs(v-b[i])>1e-5) }
function numbers(item: CutoutDrawItem): number[] { return [...item.matrix, item.opacity] }
function transformNumbers(t: CutoutTransform): number[] { return [t.x,t.y,t.scale,t.rotation,t.opacity] }

/** Structural/geometry policy for automatic reference-style edits only.
 * Metadata is not pixel proof of a clean plate, real alpha, identity, or a pose.
 * Contact semantics and a contextual reaction still need the composition reviewer.
 * Bounded geometry samples do not certify every frame. Exact authored track checks
 * complement samples, including inherited motion; do this BEFORE baking frames.
 */
export function auditCutoutDirection(scene: CutoutScene, assets: Asset[], durationMs: number,
  director?: Pick<CutoutDirector, 'shots'>, options?:{moverWarning?:boolean}): CutoutDirectionAudit {
  const problems = new Set<string>(), missingAssets = new Set<string>()
  const result = (): CutoutDirectionAudit => ({problems:[...problems], missingAssets:[...missingAssets]})
  if (!scene.enabled) { problems.add('Cutout referensi memerlukan komposisi aktif.'); return result() }
  // A deliberately selected continuous-action clip is a different render path.
  if (scene.specialVideo) return result()
  if (!Number.isFinite(durationMs) || durationMs <= 0) { problems.add('Durasi komposisi tidak valid.'); return result() }
  const byAsset = new Map(assets.map(a=>[a.id,a])), byLayer = new Map(scene.layers.map(l=>[l.id,l]))
  const end = Math.max(0, durationMs-.001), points = new Set<number>([0,end])
  const add = (t:number):void => { if (t>=0 && t<=end) { points.add(t); if(t>0)points.add(Math.max(0,t-.001)) } }
  for(const layer of scene.layers) {
    add(layer.inMs); if(layer.outMs!==null)add(layer.outMs)
    for(const k of [...layer.keyframes,...layer.poses,...(layer.maskKeyframes??[])])add(k.timeMs)
  }
  for(const k of scene.camera.keyframes)add(k.timeMs)
  for(const chain of scene.ik??[])for(const k of chain.keyframes)add(k.timeMs)
  for(const shot of director?.shots??[]) { add(shot.startMs); add(shot.endMs) }
  const sorted=[...points].sort((a,b)=>a-b)
  for(let i=1;i<sorted.length;i++)points.add((sorted[i-1]+sorted[i])/2)
  const allTimes=[...points].sort((a,b)=>a-b)
  const times=allTimes.length<=128?allTimes:Array.from({length:128},(_,i)=>allTimes[Math.round(i*(allTimes.length-1)/127)])
  const metrics=Object.fromEntries(assets.map(a=>[a.id,{width:a.width,height:a.height}]))
  const visibleIds=new Set<string>(), visibleLayers=new Set<string>(), moving=new Set<string>()
  const previous=new Map<string,CutoutDrawItem>(), poseSeen=new Map<string,string>(), maskSeen=new Map<string,string>()
  const samples:Array<{t:number;draw:CutoutDrawItem[]}>=[]
  const depths=new Set<number>()
  for(const t of times) {
    let draw:CutoutDrawItem[]
    try { draw=evaluateCutoutScene(scene,t,WIDTH,HEIGHT,metrics).filter(useful) }
    catch { problems.add('Komposisi/rig belum dapat dievaluasi; periksa hubungan layer dan target IK.'); return result() }
    samples.push({t,draw})
    for(const item of draw){let layer=byLayer.get(item.layerId)!,seen=new Set<string>();while(layer.parentId&&!seen.has(layer.id)){seen.add(layer.id);layer=byLayer.get(layer.parentId)!}depths.add(layer.depth)}
  }
  // Identical root depth is one common view even when it is not the default 1.
  // With distinct depths, retain deviations from the normal depth=1 framing.
  const sharedDepth=depths.size===1?[...depths][0]:1
  let layered=false
  for(const {t,draw} of samples) {
    const identities=new Set(draw.map(d=>byAsset.get(d.assetId)).filter((a):a is Asset=>!!a).map(physicalAsset))
    if(identities.size>1)layered=true
    const camera=cutoutCameraAt(scene.camera,t)
    // Remove the shared view, preserving differential parallax.
    const z=Math.max(.1,1+(camera.zoom-1)*sharedDepth),vx=WIDTH/2*(1-z)-camera.x*WIDTH*sharedDepth*z,vy=HEIGHT/2*(1-z)-camera.y*HEIGHT*sharedDepth*z
    for(const item of draw) {
      visibleLayers.add(item.layerId);visibleIds.add(item.assetId)
      if(!byAsset.has(item.assetId))missingAssets.add(`Aset gambar yang tersedia untuk ID ${item.assetId}.`)
      const m=item.matrix
      const normalized:CutoutDrawItem={...item,matrix:[m[0]/z,m[1]/z,m[2]/z,m[3]/z,(m[4]-vx)/z,(m[5]-vy)/z]}
      const before=previous.get(item.layerId)
      if(before&&changed(numbers(before),numbers(normalized)))moving.add(item.layerId)
      if(poseSeen.has(item.layerId)&&poseSeen.get(item.layerId)!==item.assetId)moving.add(item.layerId)
      const mask=JSON.stringify(item.mask??null)
      if(maskSeen.has(item.layerId)&&maskSeen.get(item.layerId)!==mask)moving.add(item.layerId)
      previous.set(item.layerId,normalized);poseSeen.set(item.layerId,item.assetId);maskSeen.set(item.layerId,mask)
    }
  }
  if(!layered)missingAssets.add('Minimal dua layer gambar terpisah yang terlihat bersama: background tanpa tokoh dan objek/pose/properti. Duplikasi satu foto tidak dihitung.')
  const used=[...visibleIds].map(id=>byAsset.get(id)).filter((a):a is Asset=>!!a)
  if(!used.some(a=>evidence(a).role==='background'))missingAssets.add('Background tanpa tokoh yang terpisah dan terkonfirmasi; metadata aset saat ini belum menunjukkan background tersebut.')
  for(const a of used) {
    const meta=evidence(a)
    if(meta.role&&meta.role!=='background'&&meta.transparentFraction===0)missingAssets.add(`Alpha nyata untuk ${a.id} (${meta.role}); metadata mencatat gambar sepenuhnya opak.`)
  }
  // Exact authored-value checks avoid treating repeated static frame keys as motion.
  // Ancestors propagate movement even when descendants have no authored keys.
  const ownMoving=new Set<string>()
  for(const layer of scene.layers) {
    const start=Math.max(0,layer.inMs),stop=Math.min(durationMs,layer.outMs??durationMs)
    let last=layer.transform,lastTime=0
    for(const k of layer.keyframes) {
      if(k.timeMs<=0){last=k.transform;lastTime=k.timeMs;continue}
      const affectsVisibleTime=k.easing==='hold'?k.timeMs>start&&k.timeMs<stop:Math.max(lastTime,start)<Math.min(k.timeMs,stop)
      if(affectsVisibleTime&&changed(transformNumbers(last),transformNumbers(k.transform)))ownMoving.add(layer.id)
      last=k.transform;lastTime=k.timeMs
      if(lastTime>=stop)break
    }
    let pose=layer.assetId
    for(const p of layer.poses){if(p.timeMs>=stop)break;if(p.timeMs>start&&p.assetId!==pose)ownMoving.add(layer.id);pose=p.assetId}
  }
  for(const id of visibleLayers) {
    let current=byLayer.get(id),seen=new Set<string>()
    while(current&&!seen.has(current.id)) {
      seen.add(current.id)
      if(ownMoving.has(current.id)){moving.add(id);break}
      current=current.parentId?byLayer.get(current.parentId):undefined
    }
  }
  if(moving.size>2&&!options?.moverWarning)problems.add(`Maksimal 2 layer bergerak per klip; terdeteksi ${moving.size}: ${[...moving].map(id=>byLayer.get(id)?.name??id).join(', ')}. Gerak induk, IK, pose, mask dan parallax ikut dihitung; framing kamera bersama dikecualikan.`)
  const jointIds=new Set(scene.layers.filter(l=>l.parentId).flatMap(l=>[l.id,l.parentId!]))
  const contactIds=new Set<string>()
  for(const chain of scene.ik??[])if(chain.enabled&&(chain.weight>0||chain.keyframes.some(k=>k.timeMs<=durationMs&&k.weight>0))) {
    for(const id of [chain.upperId,chain.lowerId,chain.targetLayerId].filter((v):v is string=>!!v)) {
      let current=byLayer.get(id),seen=new Set<string>()
      while(current&&!seen.has(current.id)){seen.add(current.id);contactIds.add(current.id);current=current.parentId?byLayer.get(current.parentId):undefined}
    }
    if(chain.keyframes.some(k=>k.timeMs>0&&k.timeMs<=durationMs&&!CONTACT_EASING.has(k.easing)))problems.add(`Target kontak IK “${chain.name}” harus memakai linear/hold.`)
  }
  for(const layer of scene.layers)if(visibleLayers.has(layer.id)) {
    const keys=layer.keyframes.filter(k=>k.timeMs>0&&k.timeMs<=durationMs)
    if(contactIds.has(layer.id)&&keys.some(k=>!CONTACT_EASING.has(k.easing)))problems.add(`Layer kontak IK “${layer.name}” harus memakai linear/hold.`)
    const elastic=keys.some(k=>ELASTIC_EASING.has(k.easing))
    if(elastic&&jointIds.has(layer.id))problems.add(`Sendi/anggota rig “${layer.name}” tidak boleh memakai spring/back-out.`)
    else if(elastic) {
      const roles=new Set([layer.assetId,...layer.poses.map(p=>p.assetId)].map(id=>evidence(byAsset.get(id??'')).role).filter(Boolean))
      // A pose can be a contextual reaction; pixel/narrative review must decide.
      if(roles.has('background')||roles.has('foreground')||roles.has('part'))problems.add(`Spring/back-out pada “${layer.name}” hanya untuk properti atau reaksi kecil; peran aset ini ${[...roles].join('/')}.`)
    }
  }
  if(scene.camera.keyframes.some(k=>k.timeMs>0&&k.timeMs<=durationMs&&ELASTIC_EASING.has(k.easing)))problems.add('Kamera tidak boleh memakai spring/back-out; gunakan framing stabil atau push-in singkat.')
  // One push-in and return is valid. Repeated fast reversals within the SAME
  // shot are observable oscillation; hold keys at declared hard cuts are not shake.
  const ranges=director?.shots.length?director.shots:[{startMs:0,endMs:durationMs}]
  for(const range of ranges)for(const axis of ['x','y','zoom'] as const) {
    let value=cutoutCameraAt(scene.camera,range.startMs)[axis],sign=0,lastChange=range.startMs,reversals=0
    for(const k of scene.camera.keyframes.filter(k=>k.timeMs>range.startMs&&k.timeMs<=range.endMs)) {
      const delta=k[axis]-value,next=Math.abs(delta)>1e-5?Math.sign(delta):0
      if(k.easing==='hold'&&k.timeMs===range.endMs){sign=0;reversals=0}
      else if(next) {
        if(sign&&next!==sign&&k.timeMs-lastChange<=600)reversals++;else if(k.timeMs-lastChange>600)reversals=0
        sign=next;lastChange=k.timeMs
      }
      value=k[axis]
      if(reversals>=2){problems.add('Kamera bolak-balik cepat dalam satu shot; hilangkan shake/goyang.');break}
    }
  }
  return result()
}
