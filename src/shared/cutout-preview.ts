import type {Asset,ProjectBundle} from './types'
import type {CutoutAssetItem,CutoutAssetState} from './cutout-assets'
import {composeBasicCutout} from './cutout-permanent'
import {availableCutoutAssets} from './cutout-orphans'
import {generatedForItem} from './cutout-production'
import {scheduledItem,cutoutGroupKey} from './cutout-plan-diagnostics'
import {cutoutAssetIds,type CutoutScene} from './cutout-timeline'
export const PREVIEW_ASSET_PREFIX='preview-missing:'
export interface CutoutClipPreview {kind:'preview';projectId:string;clipId:string;title:string;durationMs:number;createdAt:number;scene:CutoutScene|null;assets:Asset[];placeholders:{assetId:string;itemId:string;label:string}[];warnings:string[]}
/** Virtual placeholders live in preview results only; they are never inserted into the asset inventory. */
export function composeCutoutPreview(bundle:ProjectBundle,clipId:string,state:CutoutAssetState):CutoutClipPreview {
 const clip=bundle.clips.find(c=>c.id===clipId);if(bundle.project.styleId!=='cutout-facts'||!clip)throw Error('Pratinjau hanya untuk klip Cutout proyek ini.')
 const plan=structuredClone(state.plan??{version:1 as const,id:'preview-plan-'+clip.id,clipId,sourceHash:'preview-only',items:[] as CutoutAssetItem[]}),warnings:string[]=state.stale?['Rencana usang; pratinjau hanya untuk inspeksi, bukan hasil produksi.']:[],assets=availableCutoutAssets(bundle).filter(a=>a.clipId===clipId),placeholders:CutoutClipPreview['placeholders']=[]
 const add=(role:'background'|'prop',id:string,label:string)=>{while(plan.items.some(i=>i.id===id))id+='x';plan.items.push({id,role,label,prompt:'Kebutuhan pratinjau belum tersedia',characterId:null,timeMs:0,layerKey:id,motionRole:'static'})}
 if(!plan.items.some(i=>scheduledItem(i)&&i.role==='background'))add('background','preview-bg','Background tanpa tokoh belum direncanakan')
 if(new Set(plan.items.filter(scheduledItem).map(cutoutGroupKey)).size<2)add('prop','preview-subject','Tokoh / properti sesuai narasi belum direncanakan')
 for(const [index,item] of plan.items.entries())if(scheduledItem(item)&&!generatedForItem(assets,plan,item.id)){
  const id=PREVIEW_ASSET_PREFIX+clip.id+':'+index;placeholders.push({assetId:id,itemId:item.id,label:item.label});assets.push({id,projectId:bundle.project.id,clipId,characterId:null,kind:'image',provider:'local',model:null,prompt:item.label,remoteId:null,remoteUrl:null,localPath:'__preview__/virtual-placeholder',url:'',durationMs:null,width:item.role==='background'?720:512,height:item.role==='background'?1280:512,createdAt:0,meta:{cutoutAsset:{planId:plan.id,itemId:item.id,role:item.role},previewPlaceholder:true}})
 }
 let scene:CutoutScene|null=null;try{const result=composeBasicCutout(clip,plan,assets,bundle.project.aspectRatio);scene=result.scene;warnings.push(...result.warnings)}catch(e){warnings.push('Rencana belum dapat dirender: '+(e as Error).message+'. Daftar kebutuhan tetap dapat ditinjau.')}
 return {kind:'preview',projectId:bundle.project.id,clipId,title:clip.title,durationMs:Math.floor(clip.durationMs),createdAt:Date.now(),scene,assets,placeholders,warnings}
}
export function assertNoPreviewPlaceholders(bundle:ProjectBundle):void {if(bundle.project.styleId!=='cutout-facts')return;for(const c of bundle.clips)if(cutoutAssetIds(c.cutout).some(id=>id.startsWith(PREVIEW_ASSET_PREFIX)))throw Error('Pratinjau '+c.title+' masih memakai placeholder. Lengkapi aset lalu susun hasil produksi sebelum ekspor final.')}
