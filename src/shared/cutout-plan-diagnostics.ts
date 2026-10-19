/** Group identity is layerKey. The fallback is ONLY for legacy plans without one. */
export interface GroupItem {id:string;layerKey?:string;role?:string;characterId?:string|null;timeMs?:number;motionRole?:'mover'|'static'|null;motionRoleSource?:'plan'|'group';usage?:'scheduled'|'variant';assetId?:string}
export function cutoutGroupKey(i:GroupItem):string {return i.layerKey||(i.role==='background'?'background':['character','pose'].includes(i.role??'')?`actor-${i.characterId??'main'}`:i.id)}
export function groupMotion(item:GroupItem,items:GroupItem[]):{value:'mover'|'static'|null;source:string} {
 const values=[...new Set(items.filter(i=>cutoutGroupKey(i)===cutoutGroupKey(item)).map(i=>i.motionRole).filter(Boolean))];
 if(values.length>1)throw Error(`Grup ${cutoutGroupKey(item)} memiliki motionRole bertentangan; selaraskan rencana aset sebelum produksi.`)
 if(item.motionRole)return {value:item.motionRole,source:item.motionRoleSource==='group'?'turunan grup layerKey':'rencana aset'}
 return {value:values[0]??null,source:values.length?'turunan grup layerKey':'belum ditetapkan (rencana legacy)'}
}
/** Optional review candidates are available for explicit replacement, not extra timed poses. */
export function scheduledItem(i:GroupItem):boolean {return i.usage!=='variant'&&!(i.id.startsWith('review-')&&i.usage===undefined)}
export const DIRECTOR_MOTION_RULE='Grup = layerKey. motionRole kosong/null mewarisi grup; jangan menaikkan grup static menjadi mover diam-diam. Pergantian pose berarti perubahan assetId, bukan entri hold/duplikat aset sama. Kandidat usage:variant hanya pengganti opsional, jangan dijadwalkan otomatis. Maksimal 2 layer bergerak per shot; perubahan pose, parent/IK/mask/parallax dan anak parent bergerak ikut dihitung. Static boleh dipakai sebagai layer hold. timeMs harus UNIK dalam satu grup layerKey.'
export function poseSpacingWarnings(items:GroupItem[],thresholdMs=500):string[] {
 // 500ms is a conservative authoring warning, NOT a reference measurement or animation speed limit.
 if(!Number.isFinite(thresholdMs)||thresholdMs<0||thresholdMs>10000)throw Error('Ambang peringatan pose harus 0–10000 ms.')
 const out:string[]=[];for(const key of new Set(items.map(cutoutGroupKey))){const poses=items.filter(i=>cutoutGroupKey(i)===key).sort((a,b)=>(a.timeMs??0)-(b.timeMs??0));for(let n=1;n<poses.length;n++){const a=poses[n-1],b=poses[n],gap=(b.timeMs??0)-(a.timeMs??0);if(a.id!==b.id&&gap<thresholdMs)out.push(`Pose grup ${key}: ${a.id} (${a.timeMs} ms) → ${b.id} (${b.timeMs} ms), jarak ${gap} ms < ${thresholdMs} ms. Tinjau keterbacaan; kandidat varian belum dijadwalkan.`)}}return out
}
interface InventoryItem {id:string;role:string;label:string;layerKey?:string;motionRole?:string|null;review?:string;generated:boolean;width?:number|null;height?:number|null}
const concepts:[string,RegExp][]=[['hammer',/\b(hammer|palu)\b/i],['chisel',/\b(chisel|pahat)\b/i],['plate',/\b(piring|porcelain plate|dinner plate)\b/i],['can',/\b(kaleng|tin can|food can)\b/i]]
/** Conservative lexical reconciliation, not pixel recognition. Replacement/quality gaps stay missing.
 * Match an explicit object concept in BOTH description and a generated prop's label. */
export function reconcileMissingClaims(descriptions:string[],inventory:InventoryItem[]):{missingAssets:string[];problems:string[]} {
 const missingAssets:string[]=[],problems:string[]=[];
 for(const description of descriptions){
  const requested=concepts.filter(([,r])=>r.test(description));
  const replacement=/\b(replace(?:ment)?|broken|damaged|incompatible|wrong (?:pose|perspective)|pengganti|rusak|perspektif salah)\b/i.test(description);
  const matches=!replacement&&requested.length?inventory.filter(i=>i.generated&&i.role==='prop'&&requested.some(([,r])=>r.test(i.label))):[];
  if(matches.length&&requested.every(([,r])=>matches.some(i=>r.test(i.label))))problems.push(`Sumber: model tinjauan. Klaim aset hilang direkonsiliasi dengan inventaris: ${matches.map(i=>`${i.id} «${i.label}»`).join(', ')} sudah tersedia. Perbaiki visibilitas, skala, kontak, occlusion atau penempatan pada permukaan plate; jangan generate duplikat. Klaim asli: ${description}`);
  else missingAssets.push(description)
 }return {missingAssets,problems}
}
