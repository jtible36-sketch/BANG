import type {Clip,ProjectBundle} from './types'
import type {SceneBrief} from './cutout-permanent'
import {DEFAULT_ERA_RULES} from './cutout-permanent'

export interface SceneBriefDefaults {era?:string;location?:string;timeWeather?:string;wardrobe?:string;props?:string[]}
const unset=(s:string)=>!s||/belum ditetapkan|lokasi-tidak-pasti|perlu konfirmasi|Belum ada tokoh/i.test(s)
const year=(s:string)=>s.match(/\b(?:1\d{3}|20\d{2})(?:\s*[–—-]\s*(?:1\d{3}|20\d{2}))?\b/)?.[0]??s.match(/\b(?:abad\s+(?:ke[- ]?)?\d+|masa kini|present.day|modern|sekarang)\b/i)?.[0]
const place=(s:string)=>s.match(/(?:lokasi|location|latar|setting)\s*:\s*([^.;\n]{3,140})/i)?.[1]?.trim()??s.match(/\b(?:dek kapal[^.;\n]{0,70}|dapur[^.;\n]{0,60}|bengkel[^.;\n]{0,60}|Arctic[^.;\n]{0,60}|Arktik|Inggris|England|British kitchen|ship deck|rumah sakit|laboratorium|supermarket|pasar|hotel|pabrik|kantor|sekolah|jalan[^.;\n]{0,50})\b/i)?.[0]
const propWords=/\b(palu|pahat|sendok|kaleng|roda|pembuka|wadah|makanan|mesin|kapal|pisau|peti|troli|piring|gelas|rak|meja|cermin|kaca|kertas|buku|kamera|mobil|sepeda|hammer|chisel|spoon|can opener|plate|rack|table|mirror)\b/gi
/** Local proposals, never factual claims or implicit inheritance from the preceding scene. */
export function prefillSceneBrief(base:SceneBrief,clip:Clip,bundle:Pick<ProjectBundle,'project'|'characters'>):SceneBrief {
 const d=bundle.project.editor.cutoutV5?.sceneDefaults??{},out=structuredClone(base),scene=clip.story+'\n'+clip.visualPrompt.split(/Avoid:/i)[0],context=bundle.project.synopsis
 const propose=(field:string,value:string,source:string)=>{out.evidence.push({field,quote:value+' · '+source,startWord:null,endWord:null,startMs:null,endMs:null,source:'proposal'})}
 if(unset(out.era)){
  const contextYears=[...new Set(context.match(/\b(?:1\d{3}|20\d{2})\b/g)??[])],value=year(scene)??d.era??(contextYears.length===1?contextYears[0]:undefined)??'Rekonstruksi tanpa penanda tahun (narasi tidak menyebut periode)'
  out.era=value;propose('era',value,year(scene)?'rencana adegan':d.era?'Brief proyek':'usulan editorial; tinjau sebelum generasi')
 }
 if(unset(out.location)){
  out.location=place(scene)??d.location??'Set rekonstruksi netral untuk '+(clip.title||bundle.project.title)
  out.locationCertain=false;propose('location',out.location,'usulan rencana adegan / Brief proyek, bukan kutipan fakta narasi')
 }
 // Hypothetical narration remains a proposed location, explicitly accepted only by the review action.
 if(!out.locationCertain&&!out.evidence.some(e=>e.field==='location'&&e.source==='proposal'))propose('location',out.location,'visualisasi hipotetis yang perlu ditinjau')
 if(unset(out.timeWeather)){
  out.timeWeather=d.timeWeather??scene.match(/\b(?:pagi|siang|sore|malam|sunset|daylight|morning|night|mendung|cerah|overcast|snowy)[^.;\n]{0,70}/i)?.[0]??'Siang, cuaca cerah; pencahayaan konsisten (usulan visual)';propose('timeWeather',out.timeWeather,'arahan pencahayaan, bukan fakta sejarah')
 }
 const costumeMatch=scene.match(/(?:wearing|dressed in|mengenakan)\s+([^.;\n]{3,220})|(?:pakaian|kostum)\s*:\s*([^.;\n]{3,220})/i),costume=costumeMatch?.[1]??costumeMatch?.[2]
 if(costume||d.wardrobe||unset(out.wardrobe)){out.wardrobe=costume??d.wardrobe??'Pakaian sederhana sesuai '+out.era+'; pertahankan identitas tokoh proyek, hindari atribut modern pada rekonstruksi sejarah.';propose('wardrobe',out.wardrobe,'kostum usulan; periksa kesesuaian era')}
 if(!out.characters.length){const named=bundle.characters.filter(c=>new RegExp('\\b'+c.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(clip.narration+' '+scene));if(named.length){out.characters=named.map(c=>c.id);delete out.characterProposal}}
 out.props=[...new Set([...out.props,...(scene.match(propWords)??[]),...(d.props??[])].map(s=>s.toLowerCase()))].slice(0,64)
 for(const p of out.props.filter(p=>!base.props.includes(p)))propose('prop',p,'rencana adegan / Brief proyek')
 out.reason=out.evidence.some(e=>e.source==='proposal')?'Narasi menjadi dasar; detail yang tidak disebut diisi sebagai usulan dari rencana adegan dan Brief proyek. Tidak mewarisi lokasi klip sebelumnya tanpa kelanjutan eksplisit.':base.reason
 out.warnings=out.warnings.filter(w=>!/^Era belum disebut jelas|^Lokasi tidak pasti/.test(w));if(out.evidence.some(e=>e.source==='proposal'))out.warnings.push('Terisi otomatis: usulan editorial perlu ditinjau; bukan fakta yang telah diverifikasi.')
 const proposedYear=Number(out.era.match(/\d{4}/)?.[0]);if(proposedYear)for(const rule of bundle.project.editor.cutoutV5?.eraRules??DEFAULT_ERA_RULES)try{if(proposedYear<rule.before&&new RegExp(rule.pattern,'i').test(scene+' '+out.props.join(' '))&&!out.warnings.includes(rule.warning))out.warnings.push(rule.warning)}catch{out.warnings.push('Aturan era '+rule.id+' tidak valid; perbaiki kamus.')}
 // Revoke approval on a changed storyboard, defaults, or project brief as well as narration/identity.
 out.source=JSON.stringify(['scene-prefill-1',base.source,clip.story,bundle.project.synopsis,d,bundle.characters.map(c=>[c.id,c.name,c.description])])
 return out
}
export function projectBriefSuggestions(bundle:Pick<ProjectBundle,'project'|'characters'>):Required<SceneBriefDefaults>{
 const s=bundle.project.synopsis,d=bundle.project.editor.cutoutV5?.sceneDefaults??{},years=[...new Set(s.match(/\b(?:1\d{3}|20\d{2})\b/g)??[])];return {era:d.era??(years.length===1?years[0]:'Mengikuti era masing-masing adegan'),location:d.location??place(s)??'Mengikuti lokasi masing-masing adegan',timeWeather:d.timeWeather??'Siang; cahaya hangat, arah cahaya konsisten (usulan)',wardrobe:d.wardrobe??'Kostum mengikuti era adegan dan identitas tokoh proyek',props:d.props??[...new Set((s.match(propWords)??[]).map(s=>s.toLowerCase()))]}
}
