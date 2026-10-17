import { cutoutEase, CUTOUT_EASING_IDS, clampMotion } from './cutout-easing'
import type { CutoutEasing, CutoutLayer, CutoutMatrix, CutoutTransform } from './cutout-timeline'
export interface CutoutIkKeyframe { id: string; timeMs: number; targetX: number; targetY: number; weight: number; easing: CutoutEasing }
export interface CutoutIkChain {
  id: string; name: string; enabled: boolean; upperId: string; lowerId: string
  /** End effector in lower-layer local coordinates, as fractions of the frame. */
  endX: number; endY: number; targetX: number; targetY: number; bend: 1 | -1; weight: number; keyframes: CutoutIkKeyframe[]
  /** Optional contact anchor on another layer, in fractions of its source image. */
  targetLayerId?: string | null
}
export function normalizeCutoutIk(raw: unknown, layers: CutoutLayer[]): CutoutIkChain[] {
  if (raw == null) return []
  if (!Array.isArray(raw) || raw.length > 16) throw new Error('Maksimal 16 rantai IK per klip.')
  const n = (v: unknown, min: number, max: number): number => { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error('Nilai IK di luar batas.'); return v }
  const id = (v: unknown): string => { if (typeof v !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(v)) throw new Error('ID IK tidak valid.'); return v }
  const used = new Set<string>(), ids = new Set<string>()
  const result = raw.map((v: CutoutIkChain) => {
    const upper = layers.find(l => l.id === v.upperId), lower = layers.find(l => l.id === v.lowerId)
    if (!upper || !lower || lower.parentId !== upper.id) throw new Error('IK memerlukan dua layer berurutan: tulang bawah harus berinduk pada tulang atas.')
    if (used.has(upper.id) || used.has(lower.id)) throw new Error('Satu tulang tidak boleh dipakai oleh dua rantai IK.')
    used.add(upper.id); used.add(lower.id)
    const chainId = id(v.id)
    if (ids.has(chainId)) throw new Error('ID rantai IK berulang.'); ids.add(chainId)
    if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 120 || typeof v.enabled !== 'boolean' || (v.bend !== 1 && v.bend !== -1)) throw new Error('Pengaturan IK tidak valid.')
    if(v.targetLayerId!==undefined&&v.targetLayerId!==null)id(v.targetLayerId)
    const endX = n(v.endX, -10, 10), endY = n(v.endY, -10, 10)
    if (Math.hypot(endX, endY) < .001) throw new Error('Ujung tulang IK harus berjarak dari sendi.')
    if (Math.hypot(lower.transform.x, lower.transform.y) < .001) throw new Error('Letakkan tulang bawah berjarak dari pivot tulang atas sebelum membuat IK.')
    if (!Array.isArray(v.keyframes) || v.keyframes.length > 8192) throw new Error('Maksimal 8192 keyframe target IK.')
    const times = new Set<number>(), keyIds = new Set<string>()
    const keyframes = v.keyframes.map(k => {
      const keyId = id(k.id), timeMs = n(k.timeMs, 0, 86_400_000)
      if (times.has(timeMs) || keyIds.has(keyId) || !CUTOUT_EASING_IDS.includes(k.easing)) throw new Error('Keyframe IK tidak valid atau berulang.')
      times.add(timeMs); keyIds.add(keyId)
      return { id: keyId, timeMs, targetX: n(k.targetX, -10, 10), targetY: n(k.targetY, -10, 10), weight: n(k.weight, 0, 1), easing: k.easing }
    }).sort((a,b) => a.timeMs - b.timeMs)
    return { id: chainId, name: v.name.trim(), enabled: v.enabled, upperId: upper.id, lowerId: lower.id, endX, endY,
      ...(v.targetLayerId?{targetLayerId:id(v.targetLayerId)}:{}), targetX: n(v.targetX, -10, 10), targetY: n(v.targetY, -10, 10), weight: n(v.weight, 0, 1), bend: v.bend, keyframes }
  })
  // Two disjoint chains can still depend on one another through ancestors: solve in root order.
  return orderCutoutIk(result,layers)
}
export function cutoutIkAt(chain: CutoutIkChain, timeMs: number): { targetX: number; targetY: number; weight: number } {
  let before = { targetX: chain.targetX, targetY: chain.targetY, weight: chain.weight }, previousTime = 0
  for (const k of chain.keyframes) {
    if (timeMs < k.timeMs) {
      let t = Math.max(0, Math.min(1, (timeMs - previousTime) / (k.timeMs - previousTime)))
      t=cutoutEase(t,k.easing)
      return { targetX: clampMotion(before.targetX + (k.targetX-before.targetX)*t,-10,10), targetY: clampMotion(before.targetY + (k.targetY-before.targetY)*t,-10,10), weight: clampMotion(before.weight + (k.weight-before.weight)*t,0,1) }
    }
    previousTime = k.timeMs; before = { targetX: k.targetX, targetY: k.targetY, weight: k.weight }
  }
  return before
}
/** Analytic two-bone IK in the upper bone's parent space. Unreachable targets clamp to reach. */
export function solveCutoutIk(chain: CutoutIkChain, timeMs: number, upper: CutoutTransform, lower: CutoutTransform, parent: CutoutMatrix, width: number, height: number): { upper: CutoutTransform; lower: CutoutTransform } {
  if (!chain.enabled) return { upper, lower }
  const target = cutoutIkAt(chain, timeMs), det = parent[0]*parent[3]-parent[1]*parent[2]
  if (Math.abs(det) < 1e-10 || target.weight === 0) return { upper, lower }
  const wx = target.targetX * width-parent[4], wy = target.targetY * height-parent[5]
  const tx = (parent[3]*wx-parent[2]*wy)/det-upper.x*width, ty = (-parent[1]*wx+parent[0]*wy)/det-upper.y*height
  const ox = lower.x*width, oy = lower.y*height, ex = chain.endX*width, ey = chain.endY*height
  const a = Math.hypot(ox,oy)*upper.scale, b = Math.hypot(ex,ey)*upper.scale*lower.scale
  if (a < 1e-6 || b < 1e-6) return { upper, lower }
  const d = Math.max(Math.abs(a-b)+1e-7, Math.min(a+b-1e-7, Math.hypot(tx,ty)))
  const elbow = chain.bend * Math.acos(Math.max(-1,Math.min(1,(d*d-a*a-b*b)/(2*a*b))))
  const theta = Math.atan2(ty,tx)-Math.atan2(b*Math.sin(elbow),a+b*Math.cos(elbow))
  const upperRotation = (theta-Math.atan2(oy,ox))*180/Math.PI
  const lowerRotation = (Math.atan2(oy,ox)+elbow-Math.atan2(ey,ex))*180/Math.PI
  const blend = (from: number, to: number): number => from + (((to-from+180)%360+360)%360-180)*target.weight
  return { upper: { ...upper, rotation: blend(upper.rotation,upperRotation) }, lower: { ...lower, rotation: blend(lower.rotation,lowerRotation) } }
}

/** Contacts and inherited joints must be solved before chains depending on them. */
export function orderCutoutIk(chains: CutoutIkChain[], layers: CutoutLayer[]): CutoutIkChain[] {
  const byId=new Map(layers.map(l=>[l.id,l])),owner=new Map(chains.flatMap(c=>[[c.upperId,c],[c.lowerId,c]] as [string,CutoutIkChain][]))
  const result:CutoutIkChain[]=[],done=new Set<string>(),visiting=new Set<string>()
  const lineage=(id:string|null|undefined):string[]=>{const ids:string[]=[],seen=new Set<string>();while(id){if(seen.has(id)||!byId.has(id))throw new Error('Target/induk IK tidak valid.');seen.add(id);ids.push(id);id=byId.get(id)!.parentId}return ids}
  for(const c of chains)if(c.targetLayerId&&lineage(c.targetLayerId).some(id=>id===c.upperId||id===c.lowerId))throw new Error('Target kontak IK tidak boleh berada pada tulang sendiri atau turunannya.')
  const visit=(c:CutoutIkChain):void=>{
    if(done.has(c.id))return
    if(visiting.has(c.id))throw new Error('Hubungan target kontak IK melingkar.')
    visiting.add(c.id)
    for(const id of [...lineage(byId.get(c.upperId)?.parentId),...lineage(c.targetLayerId)]){const dependency=owner.get(id);if(dependency&&dependency.id!==c.id)visit(dependency)}
    visiting.delete(c.id);done.add(c.id);result.push(c)
  }
  chains.forEach(visit);return result
}
