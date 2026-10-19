import type {Clip,Overlay,WordTiming} from './types'
import {CUTOUT_V5_RULES,cutoutRules,type CutoutRules} from './cutout-shot-rules'
export interface ProposedShot {startMs:number;endMs:number;text:string;kind:'typical'|'explainer'|'montage';warning?:string}
export interface ShotProposalSet {source:string;shots:ProposedShot[];accepted:boolean}
export interface KeywordRules {numbers:boolean;properNames:boolean;terms:string[]}
export const DEFAULT_KEYWORDS:KeywordRules={numbers:true,properNames:true,terms:['cermin','kompas','jarum','air','mesin','pintu','logam','api']}
export interface SfxKeywordRule {words:string[];category:string;assetId?:string;volumeDb:number}
export const DEFAULT_SFX_RULES:SfxKeywordRule[]=['pintu','lipat','putar','logam','air','api'].map(category=>({words:[category],category,volumeDb:-24}))
const clean=(s:string)=>s.toLocaleLowerCase('id').replace(/[^\p{L}\p{N}]/gu,'')
export function keyword(text:string,rules:KeywordRules=DEFAULT_KEYWORDS):boolean{return rules.numbers&&/\d/.test(text)||rules.properNames&&/^\p{Lu}[\p{L}-]+$/u.test(text)||rules.terms.some(t=>clean(t)===clean(text))}
/** Stable input identity, includes actual word timestamps. Acceptance never rewrites audio duration. */
export function proposalSource(clip:Clip,words:WordTiming[]):string{return JSON.stringify([clip.narration,clip.durationMs,clip.audioAssetId,words])}
export function validRecordedWords(words:WordTiming[],durationMs:number):boolean {let end=0;return words.length>0&&words.every(w=>{const ok=typeof w.text==='string'&&!!w.text.trim()&&Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.start>=end-.02&&w.end>w.start&&w.end*1000<=durationMs+150;end=w.end;return ok})}
/** Dynamic programming chooses clause/word boundaries from recorded timestamps, not a fixed-duration grid.
 * Long holds are legal. Too-short recordings are returned honestly with a warning. */
export function proposeShots(clip:Clip,words:WordTiming[],raw:CutoutRules=CUTOUT_V5_RULES):ShotProposalSet {
 if(!validRecordedWords(words,clip.durationMs))throw Error('Timing kata rekaman belum tersedia/valid. Sinkronkan caption dengan Whisper lokal dahulu.')
 const r=cutoutRules(raw).shotDurationMs,n=words.length,bounds=[0,...words.slice(1).map(w=>Math.round(w.start*1000)),clip.durationMs],cost=Array(n+1).fill(Infinity),prev=Array(n+1).fill(-1);cost[0]=0
 for(let j=1;j<=n;j++)for(let i=Math.max(0,j-60);i<j;i++){const span=bounds[j]-bounds[i];if(span>r.explainerMax||span<r.montageMin&&!(i===0&&j===n))continue;const count=j-i,clause=/[.!?;,：:]$/.test(words[j-1].text),penalty=(span<r.typicalMin?20+(r.typicalMin-span)/100:span>r.typicalMax?4+(span-r.typicalMax)/1000:0)+Math.abs(count-11)*.3+(clause?0:3)+1;if(cost[i]+penalty<cost[j]){cost[j]=cost[i]+penalty;prev[j]=i}}
 if(prev[n]<0)throw Error('Tidak ada pemecahan shot yang sesuai timing rekaman. Tinjau jeda/timestamp kata.')
 const shots:ProposedShot[]=[];for(let j=n;j>0;){const i=prev[j],span=bounds[j]-bounds[i];shots.unshift({startMs:bounds[i],endMs:bounds[j],text:words.slice(i,j).map(w=>w.text).join(' '),kind:span>r.typicalMax?'explainer':'typical',...(span<r.typicalMin?{warning:'Rentang pendek; tinjau sebagai montase atau gabungkan.'}:{})});j=i}return {source:proposalSource(clip,words),shots,accepted:false}
}
export function validateProposal(set:ShotProposalSet,clip:Clip,words:WordTiming[],raw?:CutoutRules):void {
 if(set.source!==proposalSource(clip,words))throw Error('Usulan timing usang; rekaman/narasi/durasi berubah.')
 if(!Array.isArray(set.shots)||!set.shots.length||set.shots.length>128)throw Error('Daftar usulan shot tidak valid.')
 const r=cutoutRules(raw).shotDurationMs;let end=0,montage=0;for(const s of set.shots){const d=s.endMs-s.startMs;if(!Number.isFinite(s.endMs)||s.startMs!==end||d<r.montageMin||d>r.explainerMax||typeof s.text!=='string'||!s.text.trim())throw Error('Shot harus menyambung tepat, tanpa celah, dan dalam batas durasi.');montage=d<=r.montageMax?montage+1:0;if(montage>r.montageMaxConsecutive)throw Error('Terlalu banyak shot montase berurutan.');end=s.endMs}if(end!==clip.durationMs)throw Error('Akhir shot harus sama dengan durasi rekaman.')
}
export function eraProposals(clip:Clip,words:WordTiming[],offsetMs=0,holdMs=1500):Overlay[]{
 const text=words.map(w=>w.text).join(' '),pattern=/\b(?:\d{4}(?:\s*(?:SM|M))?|abad\s+ke[- ]?\d+(?:\s*(?:SM|M))?|(?:sekitar\s+)?\d{1,4}\s+SM)\b/gi,out:Overlay[]=[]
 for(const match of text.matchAll(pattern)){const index=text.slice(0,match.index).trim().split(/\s+/).filter(Boolean).length,start=Math.round((words[index]?.start??0)*1000);out.push({id:'era-'+clip.id+'-'+start,kind:'text',text:match[0],anchor:5,x:.5,y:.5,start:(offsetMs+start)/1000,end:(offsetMs+Math.min(clip.durationMs,start+holdMs))/1000,size:.14,color:'#FFD84D',style:'outline',bold:true})}return out
}
export function proposeSfx(clip:Clip,words:WordTiming[],offsetMs:number,rules:SfxKeywordRule[]){return words.flatMap((w,i)=>rules.filter(r=>r.words.some(t=>clean(t)===clean(w.text))).map((r,j)=>({id:'suggested-sfx-'+clip.id+'-'+i+'-'+j,category:r.category,assetId:r.assetId??null,startMs:Math.round(offsetMs+w.start*1000),volumeDb:Math.min(-12,Math.max(-60,r.volumeDb)),text:w.text}))).slice(0,128)}
