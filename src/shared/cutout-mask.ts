export interface CutoutMask {
  kind: 'rect' | 'ellipse' | 'polygon'
  x: number; y: number; width: number; height: number
  points: { x: number; y: number }[]
  invert: boolean; feather: number
}
export const createCutoutMask = (): CutoutMask => ({ kind: 'rect', x: 0, y: 0, width: 1, height: 1, points: [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }], invert: false, feather: 0 })
export interface CutoutMaskKeyframe { id: string; timeMs: number; mask: CutoutMask; easing: 'linear'|'hold' }
export function normalizeCutoutMaskKeys(raw: unknown,base:CutoutMask|null|undefined): CutoutMaskKeyframe[] {
  if(raw==null)return []
  if(!Array.isArray(raw)||raw.length>512||raw.length&&!base)throw new Error('Keyframe mask memerlukan mask dasar; maksimal 512 key.')
  const ids=new Set<string>(),times=new Set<number>()
  return raw.map((v:CutoutMaskKeyframe)=>{
    if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['id','timeMs','mask','easing'].includes(k))||typeof v.id!=='string'||!/^[a-zA-Z0-9_.:-]{1,128}$/.test(v.id)||ids.has(v.id)||!Number.isInteger(v.timeMs)||v.timeMs<0||v.timeMs>86400000||times.has(v.timeMs)||!['linear','hold'].includes(v.easing))throw new Error('Keyframe mask tidak valid atau waktu berulang.')
    ids.add(v.id);times.add(v.timeMs);const mask=normalizeCutoutMask(v.mask)
    if(!mask)throw new Error('Keyframe mask harus mempunyai bentuk.')
    return {id:v.id,timeMs:v.timeMs,easing:v.easing,mask}
  }).sort((a,b)=>a.timeMs-b.timeMs)
}
/** Different shape/topology/inversion switches at the key; compatible contours interpolate. */
export function cutoutMaskAt(base:CutoutMask|null|undefined,keys:CutoutMaskKeyframe[]|undefined,timeMs:number):CutoutMask|null {
  if(!base)return null
  let previous=base,start=0
  for(const key of keys??[]){
    if(timeMs<key.timeMs){
      if(key.easing==='hold'||previous.kind!==key.mask.kind||previous.invert!==key.mask.invert||previous.points.length!==key.mask.points.length)return previous
      const t=Math.max(0,Math.min(1,(timeMs-start)/(key.timeMs-start))),mix=(a:number,b:number)=>a+(b-a)*t
      return {...previous,x:mix(previous.x,key.mask.x),y:mix(previous.y,key.mask.y),width:mix(previous.width,key.mask.width),height:mix(previous.height,key.mask.height),feather:mix(previous.feather,key.mask.feather),points:previous.points.map((p,i)=>({x:mix(p.x,key.mask.points[i].x),y:mix(p.y,key.mask.points[i].y)}))}
    }
    previous=key.mask;start=key.timeMs
  }
  return previous
}
export function normalizeCutoutMask(raw: unknown): CutoutMask | null {
  if (raw == null) return null
  const v = raw as CutoutMask
  const number = (n: unknown, min: number, max: number): number => {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw new Error('Nilai mask di luar batas.')
    return n
  }
  if (!['rect', 'ellipse', 'polygon'].includes(v.kind) || typeof v.invert !== 'boolean' || !Array.isArray(v.points) || v.points.length < 3 || v.points.length > 64) throw new Error('Mask harus persegi, elips, atau poligon 3–64 titik.')
  return { kind: v.kind, x: number(v.x, 0, 1), y: number(v.y, 0, 1), width: number(v.width, .001, 1), height: number(v.height, .001, 1),
    points: v.points.map(p => ({ x: number(p?.x, 0, 1), y: number(p?.y, 0, 1) })), invert: v.invert, feather: number(v.feather, 0, .25) }
}
/** Shared SVG alpha mask, decoded by Chromium in both editor and export. */
export function cutoutMaskSvg(mask: CutoutMask, ratio = 1): string {
  const w = 1000, h = 1000 / Math.max(.01, ratio)
  const x = mask.x * w, y = mask.y * h, width = mask.width * w, height = mask.height * h
  const shape = mask.kind === 'ellipse' ? `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}"` : mask.kind === 'polygon'
    ? `<polygon points="${mask.points.map(p => `${p.x * w},${p.y * h}`).join(' ')}"` : `<rect x="${x}" y="${y}" width="${width}" height="${height}"`
  const blur = mask.feather * Math.min(w, h)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><filter id="f" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${blur}"/></filter><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" style="mask-type:luminance"><rect width="100%" height="100%" fill="${mask.invert ? 'white' : 'black'}"/>${shape} fill="${mask.invert ? 'black' : 'white'}"${blur ? ' filter="url(#f)"' : ''}/></mask></defs><rect width="100%" height="100%" fill="white" mask="url(#m)"/></svg>`
}
