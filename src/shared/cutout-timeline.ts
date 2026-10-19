import { normalizeShotMetadata, type CutoutShot } from './cutout-shot-types'
import { cutoutEase, clampMotion } from './cutout-easing'
export type { CutoutEasing } from './cutout-easing'
import type { CutoutEasing } from './cutout-easing'
import { normalizeSpecialVideo, type SpecialVideo } from './special-clips'
import { normalizeCutoutMask, normalizeCutoutMaskKeys, cutoutMaskAt, type CutoutMaskKeyframe, type CutoutMask } from './cutout-mask'
import { normalizeCutoutIk, orderCutoutIk, cutoutIkAt, solveCutoutIk, type CutoutIkChain } from './cutout-ik'
/** Deterministic, frame-rate-independent object animation shared by preview and export. */

export interface CutoutTransform { x: number; y: number; scale: number; rotation: number; opacity: number }
export interface CutoutKeyframe { id: string; timeMs: number; transform: CutoutTransform; easing: CutoutEasing }
export interface CutoutPose { id: string; timeMs: number; assetId: string }
export interface CutoutLayer {
  motionRole?: 'mover' | 'static'
  id: string; name: string; assetId: string | null; parentId: string | null
  /** Width relative to frame width; source image proportions are always preserved. */
  width: number; pivotX: number; pivotY: number
  /** Camera parallax amount for a root layer. Children inherit the root's camera. */
  depth: number; inMs: number; outMs: number | null; visible: boolean
  transform: CutoutTransform; keyframes: CutoutKeyframe[]; poses: CutoutPose[]
  mask?: CutoutMask | null
  maskKeyframes?: CutoutMaskKeyframe[]
}
export interface CutoutCameraKeyframe { id: string; timeMs: number; x: number; y: number; zoom: number; easing: CutoutEasing }
export interface CutoutCamera { x: number; y: number; zoom: number; keyframes: CutoutCameraKeyframe[] }
export interface CutoutScene { shots?: CutoutShot[]; specialVideo?: SpecialVideo; version: 1; enabled: boolean; backgroundColor: string; camera: CutoutCamera; layers: CutoutLayer[]; ik?: CutoutIkChain[] }
export type CutoutMatrix = [number, number, number, number, number, number]
export interface CutoutDrawItem { layerId: string; assetId: string; matrix: CutoutMatrix; width: number; height: number; opacity: number; mask?: CutoutMask | null }
export interface CutoutAssetSize { width: number | null; height: number | null }

export const CUTOUT_EASINGS: { id: CutoutEasing; label: string }[] = [
  { id: 'linear', label: 'Linear' }, { id: 'ease-in', label: 'Percepat' },
  { id: 'ease-out', label: 'Perlambat' }, { id: 'ease-in-out', label: 'Halus' }, { id: 'hold', label: 'Tahan' }, {id:'back-out',label:'Lewati lalu menetap'}, {id:'spring',label:'Pegas lembut'}
]
export const CUTOUT_LIMITS = { layers: 64, keys: 8192, poses: 8192, timeMs: 86_400_000 } as const

export function createCutoutScene(): CutoutScene {
  return { version: 1, enabled: true, backgroundColor: '#16202A', camera: { x: 0, y: 0, zoom: 1, keyframes: [] }, layers: [] }
}
export function createCutoutLayer(id: string, name: string, assetId: string | null): CutoutLayer {
  return { id, name, assetId, parentId: null, width: 0.35, pivotX: 0.5, pivotY: 0.5, depth: 1,
    inMs: 0, outMs: null, visible: true, transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 }, keyframes: [], poses: [] }
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} tidak valid.`)
  return value as Record<string, unknown>
}
function number(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} harus angka ${min}–${max}.`)
  return value
}
function identifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(value)) throw new Error(`${label} tidak valid.`)
  return value
}
function flag(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} harus aktif atau nonaktif.`)
  return value
}
function easing(value: unknown): CutoutEasing {
  if (!CUTOUT_EASINGS.some(item => item.id === value)) throw new Error('Jenis interpolasi keyframe tidak dikenal.')
  return value as CutoutEasing
}
function transform(value: unknown): CutoutTransform {
  const v = object(value, 'Transform objek')
  return { x: number(v.x, -10, 10, 'Posisi X'), y: number(v.y, -10, 10, 'Posisi Y'),
    scale: number(v.scale, 0.01, 10, 'Skala'), rotation: number(v.rotation, -36_000, 36_000, 'Rotasi'), opacity: number(v.opacity, 0, 1, 'Opacity') }
}
export const CUTOUT_POSE_TIMING_RULE = 'timeMs harus UNIK dalam satu grup layerKey; jangan pernah memberi dua pose dalam grup yang sama timestamp yang sama.'

/** Preserve every pose; move a collision forward by whole milliseconds and log it. */
export function claimCutoutPoseTime(id:string,requested:number,occupied:Set<number>,endExclusive=CUTOUT_LIMITS.timeMs+1):number {
  let resolved=time(requested)
  while(occupied.has(resolved)&&resolved<endExclusive&&resolved<=CUTOUT_LIMITS.timeMs)resolved+=1
  if(resolved>=endExclusive||resolved>CUTOUT_LIMITS.timeMs)throw new Error(`Tidak ada milidetik kosong setelah ${requested} untuk pose ${id} di dalam durasi. Pisahkan/atur ulang pose; tidak ada pose dibuang.`)
  occupied.add(resolved)
  if(resolved!==requested)console.warn(`timeMs digeser otomatis: ${id} ${requested}→${resolved}`)
  return resolved
}

function sequence<T extends { id: string; timeMs: number }>(raw: unknown, max: number, parse: (value: unknown) => T, label: string): T[] {
  if (!Array.isArray(raw) || raw.length > max) throw new Error(`${label} maksimal ${max} entri.`)
  const result = raw.map(parse).sort((a, b) => a.timeMs - b.timeMs)
  if (new Set(result.map(item => item.id)).size !== result.length) throw new Error(`ID ${label} harus unik.`)
  if(label==='pose'){
    const occupied=new Set<number>()
    for(const item of result)item.timeMs=claimCutoutPoseTime(item.id,item.timeMs,occupied)
    result.sort((a,b)=>a.timeMs-b.timeMs)
  }else if (new Set(result.map(item => item.timeMs)).size !== result.length) throw new Error(`Waktu ${label} tidak boleh berulang.`)
  return result
}
function time(value: unknown): number { return number(value, 0, CUTOUT_LIMITS.timeMs, 'Waktu animasi (ms)') }

/** Validate persisted or imported animation. Never silently discard a broken rig. */
export function normalizeCutoutScene(value: unknown): CutoutScene | null {
  if (value == null) return null
  const v = object(value, 'Komposisi Cutout')
  if (v.version !== 1) throw new Error('Versi komposisi Cutout belum didukung.')
  if (typeof v.backgroundColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v.backgroundColor)) throw new Error('Warna latar Cutout harus format #RRGGBB.')
  const c = object(v.camera, 'Kamera Cutout')
  const camera: CutoutCamera = { x: number(c.x, -10, 10, 'Kamera X'), y: number(c.y, -10, 10, 'Kamera Y'), zoom: number(c.zoom, 0.1, 10, 'Zoom kamera'),
    keyframes: sequence(c.keyframes, CUTOUT_LIMITS.keys, raw => {
      const k = object(raw, 'Keyframe kamera')
      return { id: identifier(k.id, 'ID keyframe kamera'), timeMs: time(k.timeMs), x: number(k.x, -10, 10, 'Kamera X'), y: number(k.y, -10, 10, 'Kamera Y'), zoom: number(k.zoom, 0.1, 10, 'Zoom kamera'), easing: easing(k.easing) }
    }, 'keyframe kamera') }
  if (!Array.isArray(v.layers) || v.layers.length > CUTOUT_LIMITS.layers) throw new Error(`Komposisi maksimal ${CUTOUT_LIMITS.layers} layer.`)
  const layers: CutoutLayer[] = v.layers.map(raw => {
    const l = object(raw, 'Layer Cutout')
    if (typeof l.name !== 'string' || !l.name.trim() || l.name.length > 120) throw new Error('Nama layer harus berisi 1–120 karakter.')
    if(l.motionRole!==undefined&&!['mover','static'].includes(String(l.motionRole)))throw new Error('Peran gerak layer tidak valid.')
    const inMs = time(l.inMs), outMs = l.outMs === null ? null : time(l.outMs)
    if (outMs !== null && outMs <= inMs) throw new Error('Waktu keluar layer harus setelah waktu masuk.')
    return { ...(l.motionRole?{motionRole:l.motionRole as 'mover'|'static'}:{}), id: identifier(l.id, 'ID layer'), name: l.name.trim(), assetId: l.assetId === null ? null : identifier(l.assetId, 'ID aset'),
      parentId: l.parentId === null ? null : identifier(l.parentId, 'ID induk'), width: number(l.width, 0.005, 10, 'Lebar layer'),
      pivotX: number(l.pivotX, -2, 3, 'Pivot X'), pivotY: number(l.pivotY, -2, 3, 'Pivot Y'), depth: number(l.depth, 0, 2, 'Kedalaman'),
      inMs, outMs, visible: flag(l.visible, 'Visibilitas'), transform: transform(l.transform),
      ...(l.mask === undefined ? {} : { mask: normalizeCutoutMask(l.mask) }),
      ...(l.maskKeyframes == null ? {} : {maskKeyframes:normalizeCutoutMaskKeys(l.maskKeyframes,normalizeCutoutMask(l.mask))}),
      keyframes: sequence(l.keyframes, CUTOUT_LIMITS.keys, rawKey => {
        const k = object(rawKey, 'Keyframe objek')
        return { id: identifier(k.id, 'ID keyframe'), timeMs: time(k.timeMs), transform: transform(k.transform), easing: easing(k.easing) }
      }, 'keyframe objek'),
      poses: sequence(l.poses, CUTOUT_LIMITS.poses, rawPose => {
        const p = object(rawPose, 'Pergantian pose')
        return { id: identifier(p.id, 'ID pose'), timeMs: time(p.timeMs), assetId: identifier(p.assetId, 'Aset pose') }
      }, 'pose') }
  })
  const byId = new Map(layers.map(layer => [layer.id, layer]))
  if (byId.size !== layers.length) throw new Error('ID layer harus unik.')
  if(v.shots!==undefined){
    const registered=new Set(layers.flatMap(l=>[l.assetId,...l.poses.map(p=>p.assetId)]))
    for(const shot of normalizeShotMetadata(v.shots)){
      if(!registered.has(shot.startPose)||!registered.has(shot.endPose))throw new Error('Pose metadata shot harus tersedia pada layer komposisi.')
      if(shot.movers.some(id=>!byId.has(id)||byId.get(id)!.motionRole==='static'))throw new Error('Mover metadata shot harus layer yang tersedia dan diizinkan bergerak.')
    }
  }
  for (const layer of layers) {
    const chain = new Set([layer.id])
    let parent = layer.parentId
    while (parent !== null) {
      if (chain.has(parent)) throw new Error('Rig tidak boleh memiliki hubungan induk yang melingkar.')
      const ancestor = byId.get(parent)
      if (!ancestor) throw new Error('Induk rig tidak ditemukan. Pilih ulang induk layer.')
      chain.add(parent); parent = ancestor.parentId
    }
  }
  return { ...(v.shots===undefined?{}:{shots:normalizeShotMetadata(v.shots)}), version: 1, enabled: flag(v.enabled, 'Status Cutout'), backgroundColor: v.backgroundColor, camera, layers,
    ...(v.specialVideo == null ? {} : { specialVideo: normalizeSpecialVideo(v.specialVideo, layers.length) }),
    ...(v.ik === undefined ? {} : { ik: normalizeCutoutIk(v.ik, layers) }) }
}

export function cutoutAssetIds(scene: CutoutScene | null | undefined): string[] {
  return [...new Set((scene?.layers ?? []).flatMap(layer => [layer.assetId, ...layer.poses.map(pose => pose.assetId)]).filter((id): id is string => !!id))]
}


function at<T extends Record<string, number>, K extends { timeMs: number; easing: CutoutEasing }>(base: T, keys: K[], timeMs: number, values: (key: K) => T): T {
  const t = Number.isFinite(timeMs) ? Math.max(0, timeMs) : 0
  let previousTime = 0, previous = base
  for (const key of [...keys].sort((a, b) => a.timeMs - b.timeMs)) {
    const target = values(key)
    if (t < key.timeMs) {
      const progress = cutoutEase((t - previousTime) / (key.timeMs - previousTime), key.easing)
      return Object.fromEntries(Object.keys(base).map(name => [name, previous[name] + (target[name] - previous[name]) * progress])) as T
    }
    previousTime = key.timeMs; previous = target
  }
  return { ...previous }
}

export function cutoutTransformAt(layer: CutoutLayer, timeMs: number): CutoutTransform {
  const value=at({ ...layer.transform }, layer.keyframes, timeMs, key => ({ ...key.transform }))
  return {...value,x:clampMotion(value.x,-10,10),y:clampMotion(value.y,-10,10),rotation:clampMotion(value.rotation,-36000,36000),scale:clampMotion(value.scale,.01,10),opacity:clampMotion(value.opacity,0,1)}
}
export function cutoutCameraAt(camera: CutoutCamera, timeMs: number): { x: number; y: number; zoom: number } {
  const value=at({ x: camera.x, y: camera.y, zoom: camera.zoom }, camera.keyframes, timeMs, key => ({ x: key.x, y: key.y, zoom: key.zoom }))
  return {...value,x:clampMotion(value.x,-10,10),y:clampMotion(value.y,-10,10),zoom:clampMotion(value.zoom,.1,10)}
}
export function cutoutPoseAt(layer: CutoutLayer, timeMs: number): string | null {
  let asset = layer.assetId
  for (const pose of [...layer.poses].sort((a, b) => a.timeMs - b.timeMs)) {
    if (pose.timeMs > timeMs) break
    asset = pose.assetId
  }
  return asset
}

export function multiplyCutoutMatrix(a: CutoutMatrix, b: CutoutMatrix): CutoutMatrix {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]
}
const translation = (x: number, y: number): CutoutMatrix => [1, 0, 0, 1, x, y]

/** Resolve pivots and FK parenting before the root's depth-dependent camera transform. */
export function evaluateCutoutScene(scene: CutoutScene, timeMs: number, width: number, height: number, assets: Record<string, CutoutAssetSize>): CutoutDrawItem[] {
  if (!scene.enabled) return []
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Ukuran kanvas Cutout tidak valid.')
  const t = Number.isFinite(timeMs) ? Math.max(0, timeMs) : 0
  const camera = cutoutCameraAt(scene.camera, t)
  const layers = new Map(scene.layers.map(layer => [layer.id, layer]))
  const transforms = new Map(scene.layers.map(layer => [layer.id, cutoutTransformAt(layer, t)]))
  const matrixFor = (id: string | null): CutoutMatrix => {
    if (!id) return [1,0,0,1,0,0]
    const layer = layers.get(id)!, tr = transforms.get(id)!, rad = tr.rotation*Math.PI/180
    const local: CutoutMatrix = [Math.cos(rad)*tr.scale,Math.sin(rad)*tr.scale,-Math.sin(rad)*tr.scale,Math.cos(rad)*tr.scale,tr.x*width,tr.y*height]
    return layer.parentId ? multiplyCutoutMatrix(matrixFor(layer.parentId),local) : local
  }
  for (const chain of orderCutoutIk(scene.ik ?? [], scene.layers)) {
    const upper = layers.get(chain.upperId), lower = layers.get(chain.lowerId)
    if (!upper || !lower || lower.parentId !== upper.id) throw new Error('Rantai IK tidak valid.')
    let current=chain
    if(chain.targetLayerId){
      const target=layers.get(chain.targetLayerId)!,value=cutoutIkAt(chain,t),asset=assets[cutoutPoseAt(target,t)??'']
      const w=target.width*width,h=w*(asset?.width&&asset?.height?asset.height/asset.width:1),m=matrixFor(target.id)
      const x=(value.targetX-target.pivotX)*w,y=(value.targetY-target.pivotY)*h
      let tx=m[0]*x+m[2]*y+m[4],ty=m[1]*x+m[3]*y+m[5]
      // Match contact in screen space even when the target and limb have different parallax depths.
      const depth=(id:string):number=>{let l=layers.get(id)!;while(l.parentId)l=layers.get(l.parentId)!;return l.depth}
      const td=depth(target.id),ud=depth(upper.id),tz=Math.max(.1,1+(camera.zoom-1)*td),uz=Math.max(.1,1+(camera.zoom-1)*ud)
      tx=(tx*tz+width/2*(1-tz)-camera.x*width*td*tz-width/2*(1-uz)+camera.x*width*ud*uz)/uz
      ty=(ty*tz+height/2*(1-tz)-camera.y*height*td*tz-height/2*(1-uz)+camera.y*height*ud*uz)/uz
      current={...chain,targetX:tx/width,targetY:ty/height,weight:value.weight,keyframes:[]}
    }
    const solved = solveCutoutIk(current, t, transforms.get(upper.id)!, transforms.get(lower.id)!, matrixFor(upper.parentId), width, height)
    transforms.set(upper.id,solved.upper); transforms.set(lower.id,solved.lower)
  }
  type State = { matrix: CutoutMatrix; opacity: number; visible: boolean; depth: number }
  const cache = new Map<string, State>(), visiting = new Set<string>()
  const resolve = (layer: CutoutLayer): State => {
    const cached = cache.get(layer.id)
    if (cached) return cached
    if (visiting.has(layer.id)) throw new Error('Rig memiliki siklus induk.')
    visiting.add(layer.id)
    const tr = transforms.get(layer.id)!, rad = tr.rotation * Math.PI / 180
    const local: CutoutMatrix = [Math.cos(rad) * tr.scale, Math.sin(rad) * tr.scale, -Math.sin(rad) * tr.scale, Math.cos(rad) * tr.scale, tr.x * width, tr.y * height]
    const parentLayer = layer.parentId ? layers.get(layer.parentId) : null
    if (layer.parentId && !parentLayer) throw new Error('Induk rig tidak ditemukan.')
    const parent = parentLayer ? resolve(parentLayer) : null
    const state: State = { matrix: parent ? multiplyCutoutMatrix(parent.matrix, local) : local,
      opacity: (parent?.opacity ?? 1) * tr.opacity,
      visible: (parent?.visible ?? true) && layer.visible && t >= layer.inMs && (layer.outMs === null || t < layer.outMs),
      depth: parent?.depth ?? layer.depth }
    cache.set(layer.id, state); visiting.delete(layer.id)
    return state
  }
  const result: CutoutDrawItem[] = []
  for (const layer of scene.layers) {
    const state = resolve(layer), assetId = cutoutPoseAt(layer, t)
    if (!assetId || !state.visible || state.opacity <= 0) continue
    const asset = assets[assetId], w = width * layer.width
    const ratio = asset?.width && asset?.height && Number.isFinite(asset.width) && Number.isFinite(asset.height) && asset.width > 0 && asset.height > 0 ? asset.height / asset.width : 1
    const h = w * ratio
    const zoom = Math.max(0.1, 1 + (camera.zoom - 1) * state.depth)
    const view: CutoutMatrix = [zoom, 0, 0, zoom, width / 2 * (1 - zoom) - camera.x * width * state.depth * zoom, height / 2 * (1 - zoom) - camera.y * height * state.depth * zoom]
    const matrix = multiplyCutoutMatrix(multiplyCutoutMatrix(view, state.matrix), translation(-layer.pivotX * w, -layer.pivotY * h))
    result.push({ layerId: layer.id, assetId, matrix, width: w, height: h, opacity: state.opacity, ...(layer.mask ? { mask: cutoutMaskAt(layer.mask,layer.maskKeyframes,t) } : {}) })
  }
  return result
}
