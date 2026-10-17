import type { CaptionChunk } from './captions'
export interface ExportRange { startMs: number; endMs: number }
export interface RenderRange extends ExportRange { durationMs: number; startSec: number; endSec: number; durationSec: number }
/** Half-open In/Out interval aligned to the selected output frame grid. */
export function exportRange(raw: unknown,totalMs: number,fps: number): RenderRange {
  if(!Number.isFinite(totalMs)||totalMs<=0||![30,60].includes(fps))throw new Error('Timeline/FPS ekspor tidak valid.')
  let startMs=0,endMs=totalMs
  if(raw!=null){
    if(typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['startMs','endMs'].includes(k)))throw new Error('Rentang ekspor harus berisi startMs dan endMs.')
    const r=raw as ExportRange
    if(!Number.isFinite(r.startMs)||!Number.isFinite(r.endMs)||r.startMs<0||r.endMs<=r.startMs||r.endMs>totalMs+1e-6)throw new Error('Isi rentang ekspor di dalam timeline dengan akhir setelah awal.')
    startMs=Math.floor(r.startMs*fps/1000+1e-8)*1000/fps
    endMs=Math.min(totalMs,Math.ceil(r.endMs*fps/1000-1e-8)*1000/fps)
  }
  return {startMs,endMs,durationMs:endMs-startMs,startSec:startMs/1000,endSec:endMs/1000,durationSec:(endMs-startMs)/1000}
}
/** SRT only: retain spoken chunks at the range edges and rebase their timestamps. */
export function rangeCaptionChunks(chunks:CaptionChunk[],range:RenderRange):CaptionChunk[] {
  return chunks.filter(c=>c.end>range.startSec&&c.start<range.endSec).map(c=>({...c,start:Math.max(0,c.start-range.startSec),end:Math.min(range.durationSec,c.end-range.startSec),words:c.words.filter(w=>w.end>range.startSec&&w.start<range.endSec).map(w=>({...w,start:Math.max(0,w.start-range.startSec),end:Math.min(range.durationSec,w.end-range.startSec)}))})).filter(c=>c.words.length)
}
export function hasClipVisual(clip:{imageAssetId:string|null;videoAssetId:string|null;motionType:string;cutout?:{enabled:boolean;specialVideo?:{assetId:string};layers:{visible:boolean;assetId:string|null;poses:{assetId:string}[]}[]}|null}):boolean {
  return clip.cutout?.enabled?!!clip.cutout.specialVideo?.assetId||clip.cutout.layers.some(l=>l.visible&&!!(l.assetId||l.poses.length)):!!(clip.imageAssetId||(clip.motionType==='video'&&clip.videoAssetId))
}
