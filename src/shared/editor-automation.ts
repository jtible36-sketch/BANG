import { CUTOUT_EASING_IDS } from './cutout-easing'
import type { EditorSettings, ProjectBundle, TransitionId } from './types'
import { normalizeCutoutScene, CUTOUT_LIMITS, type CutoutScene } from './cutout-timeline'
import { normalizeSoundEffects } from './sfx'

export interface EditorEditPlan {
  summary: string
  clips: { clipId: string; cutout?: CutoutScene | null; transition?: TransitionId; durationMs?: number }[]
  editor?: Partial<Pick<EditorSettings, 'sfx' | 'captionStyle' | 'captionPosition' | 'captionSize' | 'captionScale' | 'captionBg' | 'captionHighlight' | 'captionColor' | 'musicVolumeDb' | 'duckMusic' | 'overlays'>>
}
export interface EditorAutomationStatus {
  codexReady: boolean; codexMessage: string
  mcp?: { running: boolean; descriptorPath: string; relayPath: string; error?: string }
}
export interface EditorAutomationResult { bundle: ProjectBundle; revision: string; summary: string; undoId: string }
export interface EditorAutomationEvent extends EditorAutomationResult { projectId: string }

type Schema = Record<string, any>
const num = (minimum: number, maximum: number): Schema => ({ type: 'number', minimum, maximum })
const str = (maxLength = 128): Schema => ({ type: 'string', minLength: 1, maxLength })
const id: Schema = { ...str(), pattern: '^[a-zA-Z0-9_.:-]+$' }
const color: Schema = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }
const bool: Schema = { type: 'boolean' }
const nullable = (s: Schema): Schema => ({ anyOf: [s, { type: 'null' }] })
const obj = (properties: Record<string, Schema>, required = Object.keys(properties)): Schema => ({ type: 'object', properties, required, additionalProperties: false })
const arr = (items: Schema, maxItems: number): Schema => ({ type: 'array', items, maxItems })
const en = (...values: string[]): Schema => ({ type: 'string', enum: values })
const time = { type: 'integer', minimum: 0, maximum: 86_400_000 }
const easing = en(...CUTOUT_EASING_IDS)
const transform = obj({ x: num(-10, 10), y: num(-10, 10), scale: num(.01, 10), rotation: num(-36000, 36000), opacity: num(0, 1) })
const camera = { x: num(-10, 10), y: num(-10, 10), zoom: num(.1, 10) }
const mask = obj({ kind: en('rect', 'ellipse', 'polygon'), x: num(0,1), y: num(0,1), width: num(.001,1), height: num(.001,1), points: { ...arr(obj({ x: num(0,1), y: num(0,1) }),64), minItems:3 }, invert: bool, feather: num(0,.25) })
const ikTarget = { targetX: num(-10,10), targetY: num(-10,10), weight: num(0,1) }
const ik = arr(obj({ targetLayerId: nullable(id), id, name: str(120), enabled: bool, upperId: id, lowerId: id, endX: num(-10,10), endY: num(-10,10), ...ikTarget, bend: { type:'integer',enum:[1,-1] }, keyframes: arr(obj({ id, timeMs: time, ...ikTarget, easing }),CUTOUT_LIMITS.keys) }, ['id','name','enabled','upperId','lowerId','endX','endY','targetX','targetY','weight','bend','keyframes']),16)
const layerProperties = { id, name: str(120), assetId: nullable(id), parentId: nullable(id), width: num(.005, 10), pivotX: num(-2, 3), pivotY: num(-2, 3), depth: num(0, 2),
  inMs: time, outMs: nullable(time), visible: bool, transform,
  keyframes: arr(obj({ id, timeMs: time, transform, easing }), CUTOUT_LIMITS.keys), poses: arr(obj({ id, timeMs: time, assetId: id }), CUTOUT_LIMITS.poses), mask: nullable(mask), maskKeyframes: arr(obj({id,timeMs:time,mask,easing:en('linear','hold')}),512) }
const cutout = obj({ version: { type: 'integer', enum: [1] }, enabled: bool, backgroundColor: color,
  camera: obj({ ...camera, keyframes: arr(obj({ id, timeMs: time, ...camera, easing }), CUTOUT_LIMITS.keys) }),
  layers: arr(obj(layerProperties,Object.keys(layerProperties).filter(k=>!['mask','maskKeyframes'].includes(k))),CUTOUT_LIMITS.layers), ik, specialVideo: obj({assetId:id,startMs:time,speed:num(.25,4),action:str(2000)}) }, ['version','enabled','backgroundColor','camera','layers'])
const overlayBase = { id, anchor: { type: 'integer', minimum: 1, maximum: 9 }, x: num(-2, 3), y: num(-2, 3), start: num(0, 86400), end: nullable(num(0, 86400)) }
const editorProperties = {
  sfx: arr(obj({ id, assetId: id, startMs: time, offsetMs: time, durationMs: { ...time, minimum: 1 }, volumeDb: num(-60, 0), fadeInMs: time, fadeOutMs: time }), 128),
  captionStyle: en('karaoke', 'tebal', 'minimal', 'subtitle', 'none'), captionPosition: en('atas', 'tengah', 'bawah'), captionSize: en('kecil', 'sedang', 'besar'),
  captionScale: num(.5,1.8), captionBg: obj({color,opacity:num(0,1)}), captionHighlight: color, captionColor: color, musicVolumeDb: num(-60, 0), duckMusic: bool,
  overlays: arr({ anyOf: [obj({ ...overlayBase, kind: en('image'), assetId: id, width: num(.005, 2), opacity: num(0, 1) }),
    obj({ ...overlayBase, kind: en('text'), text: str(2000), size: num(.005, .5), color, style: en('plain', 'outline', 'box'), bold: bool })] }, 64)
}
const clipProperties = { clipId: id, cutout: nullable(cutout), transition: en('cut', 'fade', 'slideleft', 'zoomin'), durationMs: { type: 'integer', minimum: 100, maximum: 3_600_000 } }
export const EDITOR_EDIT_PLAN_SCHEMA: Schema = obj({ summary: str(4000), clips: arr(obj(clipProperties, ['clipId']), 500), editor: obj(editorProperties, []) }, ['summary', 'clips'])

// Structured output requires every property. Null means unchanged for optional settings;
// cutout:null explicitly restores normal image/video playback for that listed clip.
function strictSchema(schema: Schema): Schema {
  if (schema.anyOf) return { ...schema, anyOf: schema.anyOf.map(strictSchema) }
  if (schema.type === 'array') return { ...schema, items: strictSchema(schema.items) }
  if (schema.type !== 'object') return schema
  return { ...schema, properties: Object.fromEntries(Object.entries(schema.properties).map(([key,value]) => [key, strictSchema(schema.required.includes(key) ? value as Schema : nullable(value as Schema))])), required: Object.keys(schema.properties) }
}
export const CODEX_EDIT_PLAN_SCHEMA: Schema = strictSchema(obj({ summary: str(4000), clips: arr(obj({ ...clipProperties, transition: nullable(clipProperties.transition), durationMs: nullable(clipProperties.durationMs) }), 500),
  editor: nullable(obj(Object.fromEntries(Object.entries(editorProperties).map(([k, v]) => [k, nullable(v)])))) }))

/** Small, closed-schema validator: rejects unknown fields rather than letting them reach storage. */
function check(value: unknown, schema: Schema, path: string): void {
  if (schema.anyOf) {
    if (schema.anyOf.some((s: Schema) => { try { check(value, s, path); return true } catch { return false } })) return
    throw new Error(`${path}: format tidak valid.`)
  }
  if (schema.type === 'null') { if (value !== null) throw new Error(`${path}: harus null.`); return }
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: harus objek.`)
    const v = value as Record<string, unknown>
    if (Object.keys(v).some(k => !Object.hasOwn(schema.properties, k))) throw new Error(`${path}: field tidak didukung.`)
    for (const k of schema.required ?? []) if (!Object.hasOwn(v, k)) throw new Error(`${path}.${k}: wajib diisi.`)
    for (const [k, item] of Object.entries(v)) check(item, schema.properties[k], `${path}.${k}`)
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length > schema.maxItems || value.length < (schema.minItems??0)) throw new Error(`${path}: jumlah entri tidak valid.`)
    value.forEach((v, i) => check(v, schema.items, `${path}[${i}]`))
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity) || (schema.pattern && !new RegExp(schema.pattern).test(value))) throw new Error(`${path}: teks tidak valid.`)
  } else if (schema.type === 'boolean') { if (typeof value !== 'boolean') throw new Error(`${path}: harus boolean.`) }
  else if (schema.type === 'number' || schema.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity) || (schema.type === 'integer' && !Number.isInteger(value))) throw new Error(`${path}: angka di luar batas.`)
  }
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path}: pilihan tidak dikenal.`)
}
export function normalizeEditorEditPlan(raw: unknown, fromCodex = false): EditorEditPlan {
  if (JSON.stringify(raw)?.length > 24_000_000) throw new Error('Rencana edit terlalu besar.')
  const plan = JSON.parse(JSON.stringify(raw)) as EditorEditPlan
  if (fromCodex) {
    if (!plan || !Array.isArray(plan.clips)) throw new Error('Rencana Codex tidak valid.')
    for (const c of plan.clips) { if (c.transition === null) delete c.transition; if (c.durationMs === null) delete c.durationMs; if(c.cutout && c.cutout.specialVideo === null) delete c.cutout.specialVideo; if (c.cutout && c.cutout.ik === null) delete c.cutout.ik; for(const layer of c.cutout?.layers??[])if(layer.maskKeyframes===null)delete layer.maskKeyframes }
    if (!plan.editor) delete plan.editor
    else {
      const fields = plan.editor as Record<string, unknown>
      for (const k of Object.keys(fields)) if (fields[k] === null) delete fields[k]
    }
  }
  check(plan, EDITOR_EDIT_PLAN_SCHEMA, 'Rencana')
  if (!plan.summary.trim()) throw new Error('Ringkasan edit wajib diisi.')
  if (new Set(plan.clips.map(c => c.clipId)).size !== plan.clips.length) throw new Error('Klip muncul berulang dalam rencana.')
  for (const c of plan.clips) if (Object.hasOwn(c, 'cutout')) c.cutout = normalizeCutoutScene(c.cutout)
  if (plan.editor?.sfx !== undefined) plan.editor.sfx = normalizeSoundEffects(plan.editor.sfx)
  if (plan.editor?.overlays) {
    if (new Set(plan.editor.overlays.map(o => o.id)).size !== plan.editor.overlays.length) throw new Error('ID label harus unik.')
    for (const o of plan.editor.overlays) if (o.end !== null && o.end <= o.start) throw new Error('Waktu akhir label harus setelah awal.')
  }
  return plan
}
