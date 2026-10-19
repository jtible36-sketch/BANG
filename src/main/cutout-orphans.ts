import {cutoutOrphans} from '@shared/cutout-orphans'
import {generatedForItem} from '@shared/cutout-production'
import {getBundle} from './repo'
import {getDb} from './db'
import {cutoutAssetState} from './cutout-assets'
import {emit} from './events'

export function orphanAssetReport(projectId:string){const b=getBundle(projectId),report=cutoutOrphans(b);return {...report,targets:b.project.styleId==='cutout-facts'?b.clips.map(c=>{const state=cutoutAssetState(c.id);return {clipId:c.id,title:c.title,itemIds:state.stale?[]:(state.plan?.items??[]).filter(i=>!generatedForItem(state.assets,state.plan!,i.id)).map(i=>i.id)}}):[]}}
function checked(projectId:string,assetId:string,confirmed:boolean){const b=getBundle(projectId),orphan=cutoutOrphans(b).assets.find(a=>a.assetId===assetId);if(confirmed!==true||b.project.styleId!=='cutout-facts'||!orphan||orphan.archived)throw Error('Pilih aset yatim aktif dan konfirmasikan tindakan terlebih dahulu.');if(b.jobs.some(j=>['queued','running'].includes(j.status)))throw Error('Tunggu atau batalkan job proyek sebelum menangani aset yatim.');return {b,asset:b.assets.find(a=>a.id===assetId)!,orphan}}
export function archiveOrphanAsset(projectId:string,assetId:string,confirmed:boolean){const {asset}=checked(projectId,assetId,confirmed),meta={...asset.meta,cutoutOrphanArchive:{at:Date.now(),clipId:asset.clipId}};getDb().prepare('UPDATE assets SET meta_json=? WHERE id=? AND project_id=?').run(JSON.stringify(meta),assetId,projectId);const next={...asset,meta};emit.asset(next);return next}
export function linkOrphanAsset(projectId:string,assetId:string,targetClipId:string,confirmed:boolean){
 const {b,asset,orphan}=checked(projectId,assetId,confirmed),clip=b.clips.find(c=>c.id===targetClipId);if(!clip)throw Error('Klip tujuan tidak ada di proyek ini.');const state=cutoutAssetState(targetClipId),item=state.plan?.items.find(i=>i.id===orphan.itemId)
 if(asset.kind!=='image'||!item||!state.plan||state.stale)throw Error('Tautkan hanya gambar dengan itemId yang cocok pada rencana klip tujuan terkini.');if(generatedForItem(state.assets,state.plan,item.id))throw Error('Item tujuan sudah memiliki aset; tidak ditimpa diam-diam.');if((asset.meta.cutoutAsset as any)?.role!==item.role||asset.characterId&&item.characterId&&asset.characterId!==item.characterId)throw Error('Jenis aset atau identitas tidak cocok dengan kebutuhan tujuan.')
 const meta={...asset.meta,cutoutOrphanLink:{at:Date.now(),oldClipId:asset.clipId,oldPlanId:(asset.meta.cutoutAsset as any)?.planId},cutoutAsset:{...(asset.meta.cutoutAsset as object),planId:state.plan.id,itemId:item.id,layerKey:item.layerKey,locationKey:item.locationKey,review:'needs-review'}}
 getDb().prepare('UPDATE assets SET clip_id=?,meta_json=? WHERE id=? AND project_id=?').run(targetClipId,JSON.stringify(meta),assetId,projectId);const next={...asset,clipId:targetClipId,meta};emit.asset(next);return next
}
