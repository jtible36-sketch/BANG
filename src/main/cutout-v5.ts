import {validateComedyScene} from '@shared/comedy-jolt'
import {loadComedyProfile} from './cutout-studio'
import {cutoutAssetState} from './cutout-assets'
import {generatedForItem} from '@shared/cutout-production'
import {poseSpacingWarnings} from '@shared/cutout-plan-diagnostics'
import {createHash} from 'node:crypto'
import {readFileSync,realpathSync,statSync} from 'node:fs'
import {relative,isAbsolute,sep} from 'node:path'
import {cutoutReadiness} from '@shared/cutout-shot-rules'
import {validateLicenseManifest,licenseAttribution,type AssetLicenseManifest} from '@shared/asset-license'
import {cutoutAssetIds} from '@shared/cutout-timeline'
import type {Asset,ProjectBundle} from '@shared/types'
import {assetAbsPath,projectDir} from './paths'
import {getBundle} from './repo'
import {getDb} from './db'
import {emit} from './events'
function assetFile(a:Asset):string {const root=realpathSync(projectDir(a.projectId)),file=realpathSync(assetAbsPath(a.projectId,a.localPath)),rel=relative(root,file);if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)||!statSync(file).isFile()||statSync(file).size<1)throw Error('Aset tidak dapat dibaca.');return file}
export function productionReadiness(projectId:string){const b=getBundle(projectId);return cutoutReadiness(b,a=>{try{assetFile(a);return true}catch{return false}}).map(row=>{
 const activeClip=b.clips.find(c=>c.id===row.clipId)!;if(b.project.editor.cutoutV5?.motionProfile==='comedy-jolt'&&activeClip.cutout){try{validateComedyScene(activeClip.cutout,activeClip,b.assets.find(a=>a.id===activeClip.audioAssetId)?.meta.words??[],(b.project.editor.cutoutV5.comedyCues??[]).filter(cue=>!cue.clipId||cue.clipId===activeClip.id),loadComedyProfile());row.findings=row.findings.filter(f=>!['character-wobble','camera-shake'].includes(f.rule));row.reasons=row.findings.map(f=>f.message);if(row.status==='blocked'&&!row.findings.some(f=>f.severity==='error')&&!row.missingAssets.length)row.status='ok'}catch(e){row.status='blocked';row.reasons.push((e as Error).message)}}
 const state=cutoutAssetState(row.clipId),items=state.stale?[]:state.plan?.items??[],generated=items.map(i=>state.plan?generatedForItem(b.assets,state.plan,i.id):undefined).filter((a):a is Asset=>!!a&&(()=>{try{assetFile(a);return true}catch{return false}})()),reviewed=generated.filter(a=>(a.meta.cutoutAsset as any)?.review==='approved').length
 const assetPreparation={planned:items.length,generated:generated.length,reviewed,generationNeeded:!items.length||generated.length<items.length,warnings:poseSpacingWarnings(items,b.project.editor.cutoutV5?.poseSpacingWarningMs??500)}
 const clip=b.clips.find(c=>c.id===row.clipId)!,hasComposition=!!clip.cutout?.enabled||!!clip.videoAssetId
 if(!hasComposition&&assetPreparation.generationNeeded)return {...row,status:'blocked' as const,reasons:['aset belum dibuat. Susun kebutuhan dan generate paket di Visual atau aktifkan Generate aset. Minimal dua layer terpisah (background dan objek/pose) diperlukan.',...row.reasons],assetPreparation}
 return {...row,assetPreparation}
})}

/** Explicit UI action; does not import/download media or alter composition. Hash is computed locally. */
export function recordAssetLicense(projectId:string,assetId:string,raw:AssetLicenseManifest,internetImage=false):Asset {
 const b=getBundle(projectId);if(b.project.styleId!=='cutout-facts')throw Error('Manifest v5 hanya untuk preset Cutout Fakta & Komedi.')
 if(typeof internetImage!=='boolean')throw Error('Jenis manifest tidak valid.')
 const a=b.assets.find(a=>a.id===assetId);if(!a)throw Error('Aset bukan milik proyek.');if(internetImage&&!['image','overlay'].includes(a.kind))throw Error('Pilih aset gambar.')
 const isInternet=internetImage||['image','overlay'].includes(a.kind)&&raw?.source!=='original'
 const sha256=createHash('sha256').update(readFileSync(assetFile(a))).digest('hex'),manifest=validateLicenseManifest({...raw,sha256},isInternet),meta={...a.meta,licenseManifest:manifest,...(isInternet?{internetSource:true}:{} )}
 getDb().prepare('UPDATE assets SET meta_json=? WHERE id=? AND project_id=?').run(JSON.stringify(meta),assetId,projectId);const updated={...a,meta};emit.asset(updated);return updated
}
/** Only media actually referenced by the output needs provenance. Legacy non-cutout exports are unchanged. */
export function exportLicenseReport(b:ProjectBundle):string {
 if(b.project.styleId!=='cutout-facts')return ''
 const sfx=new Set((b.project.editor.sfx??[]).map(c=>c.assetId)),used=new Set([...sfx,...b.clips.flatMap(c=>[c.imageAssetId,c.videoAssetId,...cutoutAssetIds(c.cutout)].filter((id):id is string=>!!id)),...b.project.editor.overlays.filter(o=>o.kind==='image').map(o=>o.assetId)])
 const lines:string[]=[];for(const a of b.assets.filter(a=>used.has(a.id)&&(sfx.has(a.id)||a.meta.internetSource||a.meta.licenseManifest||a.provider==='local'&&['image','overlay'].includes(a.kind)))){const m=validateLicenseManifest(a.meta.licenseManifest,!!a.meta.internetSource);if(createHash('sha256').update(readFileSync(assetFile(a))).digest('hex')!==m.sha256)throw Error('SHA-256 lisensi tidak cocok untuk aset '+a.id);lines.push(a.id+'\n'+licenseAttribution(m))}return lines.join('\n\n')
}
