import {useEffect,useState} from 'react'
import {projectBriefSuggestions} from '@shared/cutout-brief-prefill'
import type {ClipPreflight} from '@shared/cutout-permanent'
import {Button,inputCls} from '../../components/ui'
import {errorText} from '../../lib/format'
import {useProject} from '../../store/project'

export function SceneBriefBatchApproval({rows,onSaved}:{rows:ClipPreflight[];onSaved:()=>Promise<void>}){
 const {project,characters}=useProject(),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 if(!project)return null
 const pending=rows.filter(r=>!r.brief.approved)
 const approve=async()=>{
  setBusy(true);setMessage('');const results:string[]=[];let done=0
  try{
   await useProject.getState().flush();if(useProject.getState().saveState==='error')throw Error('Brief proyek belum tersimpan. Simpan dan coba lagi.')
   const fresh=await window.api.cutoutStudio.report(project.id)
   for(const row of pending){
    const current=fresh.find(r=>r.clipId===row.clipId)
    if(!current||current.brief.source!==row.brief.source){results.push(row.title+': sumber berubah, tinjau usulan terbaru.');continue}
    if(current.brief.characterProposal&&!current.brief.characters.length){results.push(row.title+': perlu memilih/menambah tokoh yang sesuai.');continue}
    try{await window.api.cutoutStudio.saveBrief(project.id,row.clipId,{...current.brief,locationCertain:true,approved:true});done++}catch(e){results.push(row.title+': '+errorText(e))}
   }
   await onSaved();setMessage(done+' Scene Brief disetujui. '+results.join('\n'))
  }catch(e){setMessage(errorText(e))}finally{setBusy(false)}
 }
 return <div className="my-3 rounded border border-line p-3" data-brief-batch>
 <h3 className="font-semibold">Scene Brief terisi otomatis · tinjau sekaligus</h3>
 <p className="my-2 text-xs text-muted">Narasi, rencana adegan dan Brief proyek mengisi kebutuhan visual. Detail di luar narasi adalah usulan editorial. Tombol di bawah menerima usulan era/lokasi yang terlihat; izin kredit tetap terpisah.</p>
 <details open><summary>Ringkasan {rows.length} klip · {pending.length} belum disetujui</summary><div className="max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th>Klip</th><th>Era / lokasi / cahaya</th><th>Tokoh / pakaian / properti</th></tr></thead><tbody>{rows.map(r=><tr className="border-t border-line align-top" key={r.clipId}><td className="p-2">{r.title}<br/>{r.brief.approved?'Disetujui':r.brief.characterProposal&&!r.brief.characters.length?'Perlu tokoh':'Usulan siap ditinjau'}</td><td className="p-2">{r.brief.era}<br/>{r.brief.location}<br/>{r.brief.timeWeather}</td><td className="p-2">{r.brief.characters.map(id=>characters.find(c=>c.id===id)?.name??id).join(', ')||r.brief.characterProposal?.name||'Tidak memerlukan tokoh yang ditetapkan'}<p className="max-w-sm whitespace-pre-wrap">{r.brief.wardrobe}</p><p>{r.brief.props.join(', ')||'Tidak ada properti tambahan'}</p></td></tr>)}</tbody></table></div></details>
 <Button className="mt-2" size="sm" variant="primary" disabled={busy||!pending.length} onClick={()=>void approve()}>{busy?'Menyetujui…':'Setujui semua usulan Scene Brief · tanpa kredit'}</Button>
 {message&&<p role="status" className="mt-2 whitespace-pre-wrap text-xs">{message}</p>}
 </div>
}

export function CutoutBriefSetup(){
 const {project,characters,clips,savedAt,updateEditor}=useProject(),[rows,setRows]=useState<ClipPreflight[]>([]),[error,setError]=useState('')
 const refresh=async()=>{if(project?.styleId==='cutout-facts')setRows(await window.api.cutoutStudio.report(project.id))}
 useEffect(()=>{let active=true;if(project?.styleId==='cutout-facts')void window.api.cutoutStudio.report(project.id).then(r=>{if(active)setRows(r)}).catch(e=>{if(active)setError(errorText(e))});return()=>{active=false}},[project?.id,savedAt,clips.length])
 if(project?.styleId!=='cutout-facts')return null
 const defaults=projectBriefSuggestions({project,characters})
 return <section className="rounded-xl border border-line bg-surface p-4" data-brief-setup><h2 className="font-semibold">Arahan Scene Brief otomatis</h2><p className="my-2 text-xs text-muted">Tidak perlu mengetik formulir per klip. Saat naskah tersusun, era, lokasi, tokoh, pakaian dan properti langsung diisi. Detail yang tidak disebut narasi diberi label usulan untuk ditinjau sekaligus.</p><label className="my-3 block text-sm">Profil gerak produksi<select aria-label="Profil gerak di Brief" className={inputCls+' mt-1 w-full'} value={project.editor.cutoutV5?.motionProfile??'v5'} onChange={e=>updateEditor({cutoutV5:{...project.editor.cutoutV5,motionProfile:e.target.value as 'v5'|'standard'|'png-impact'|'comedy-jolt'}})}><option value="standard">Standard v6 · stabil</option><option value="v5">v5 · stabil</option><option value="png-impact">PNG masuk &amp; getar · hard cut, kiri/kanan, zoom objek</option><option value="comedy-jolt">Komedi getar · parameter referensi belum diisi</option></select></label><p className="mb-3 text-xs text-muted">PNG masuk &amp; getar adalah racikan editorial terpisah. Preview 5 detik tersedia di Visual/Produksi; aturan v5 tetap stabil.</p><dl className="text-sm"><dt>Era</dt><dd>{defaults.era}</dd><dt>Lokasi</dt><dd>{defaults.location}</dd><dt>Cahaya</dt><dd>{defaults.timeWeather}</dd><dt>Pakaian</dt><dd>{defaults.wardrobe}</dd><dt>Properti</dt><dd>{defaults.props.join(', ')||'Diambil otomatis dari narasi dan rencana adegan'}</dd></dl>{rows.length?<SceneBriefBatchApproval rows={rows} onSaved={refresh}/>:<p className="mt-3 text-xs">Susun naskah untuk menampilkan usulan semua adegan di sini. Belum ada kredit dipakai.</p>}{error&&<p role="alert">{error}</p>}</section>
}
