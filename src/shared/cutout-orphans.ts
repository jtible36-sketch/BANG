import type {Asset,ProjectBundle} from './types'
export interface OrphanAsset {assetId:string;oldClipId:string;itemId:string|null;label:string;archived:boolean}
export interface OrphanReport {orphanAssetCount:number;archivedCount:number;groups:{oldClipId:string;count:number}[];assets:OrphanAsset[]}
// Exported read-only fixture inventories omit projectId; explicit foreign ownership is still rejected.
const belongs=(asset:Asset,projectId:string)=>asset.projectId==null||asset.projectId===projectId
export function cutoutOrphans(bundle:ProjectBundle):OrphanReport {
 const clips=new Set(bundle.clips.map(c=>c.id)),assets:OrphanAsset[]=bundle.project.styleId!=='cutout-facts'?[]:bundle.assets.filter(a=>belongs(a,bundle.project.id)&&a.clipId!=null&&!clips.has(a.clipId)).map(a=>({assetId:a.id,oldClipId:a.clipId!,itemId:typeof (a.meta.cutoutAsset as any)?.itemId==='string'?(a.meta.cutoutAsset as any).itemId:null,label:typeof a.meta.filename==='string'?a.meta.filename:a.prompt||a.id,archived:!!a.meta.cutoutOrphanArchive})),active=assets.filter(a=>!a.archived)
 return {orphanAssetCount:active.length,archivedCount:assets.length-active.length,groups:[...new Set(active.map(a=>a.oldClipId))].map(oldClipId=>({oldClipId,count:active.filter(a=>a.oldClipId===oldClipId).length})),assets}
}
export function availableCutoutAssets(bundle:ProjectBundle):Asset[]{if(bundle.project.styleId!=='cutout-facts')return bundle.assets;const clips=new Set(bundle.clips.map(c=>c.id));return bundle.assets.filter(a=>belongs(a,bundle.project.id)&&!a.meta.cutoutOrphanArchive&&(a.clipId==null||clips.has(a.clipId)))}
