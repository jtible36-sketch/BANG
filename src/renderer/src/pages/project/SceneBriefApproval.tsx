import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import type {SceneBrief} from '@shared/cutout-permanent'
import {Button,inputCls} from '../../components/ui'
import {errorText} from '../../lib/format'

/** Approval records an editorial decision only; generation has its own credit consent. */
export function SceneBriefApproval({brief,title,characters,onSave,onClose}:{
 brief:SceneBrief;title:string;characters:{id:string;name:string}[];
 onSave:(brief:SceneBrief)=>Promise<void>;onClose:()=>void
}){
 const [draft,setDraft]=useState(()=>structuredClone(brief)),[props,setProps]=useState(brief.props.join('\n')),
 [busy,setBusy]=useState(false),[error,setError]=useState(''),panel=useRef<HTMLDivElement>(null)
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;panel.current?.focus();return()=>previous?.focus()},[])
 const save=async(approved:boolean)=>{
  setError('')
  const next={...draft,props:props.split('\n').map(s=>s.trim()).filter(Boolean),approved}
  if(![next.era,next.location,next.timeWeather,next.wardrobe,next.reason].every(s=>s.trim())){setError('Isi era, lokasi, waktu/cuaca, pakaian, dan alasan keputusan dahulu.');return}
  if(approved&&(!next.locationCertain||/lokasi-tidak-pasti|belum ditetapkan/i.test(next.location+' '+next.era))){setError('Tentukan era dan lokasi, lalu centang konfirmasi lokasi sebelum menyetujui.');return}
  if(approved&&brief.characterProposal&&!next.characters.length){setError('Pilih tokoh proyek yang sesuai, atau tutup dan tambah karakter dahulu. Identity sheet tidak dibuat otomatis.');return}
  setBusy(true)
  try{await onSave(next);onClose()}catch(e){setError(errorText(e))}finally{setBusy(false)}
 }
 return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
 <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="scene-brief-title" tabIndex={-1}
 className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-surface p-5 text-sm text-ink"
 onKeyDown={e=>{if(e.key==='Escape'&&!busy)onClose();if(e.key==='Tab'){const nodes=panel.current?.querySelectorAll<HTMLElement>('input:not(:disabled),textarea:not(:disabled),button:not(:disabled),summary');const first=nodes?.[0],last=nodes?.[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}}}>
 <h2 id="scene-brief-title" className="text-lg font-semibold">Tinjau & setujui Scene Brief</h2>
 <p className="my-2 font-semibold">{title}</p><p className="mb-3 text-muted">Periksa kesesuaian cerita sebelum menyetujui. Menyimpan Brief tidak men-generate aset dan tidak memakai kredit.</p>
 <fieldset disabled={busy} className="space-y-3">
 {(['era','location','timeWeather','wardrobe','reason'] as const).map(key=><label key={key} className="block">{{era:'Era / tahun',location:'Lokasi',timeWeather:'Waktu & cuaca',wardrobe:'Pakaian sesuai era',reason:'Alasan pemilihan era dan lokasi'}[key]}<textarea rows={key==='reason'||key==='wardrobe'?2:1} className={inputCls+' mt-1 w-full'} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value,approved:false})}/></label>)}
 <label className="flex items-start gap-2"><input type="checkbox" checked={draft.locationCertain} onChange={e=>setDraft({...draft,locationCertain:e.target.checked,approved:false})}/>Saya telah memastikan lokasi dan era untuk adegan ini.</label>
 <fieldset className="rounded border border-line p-2"><legend>Tokoh proyek</legend>{characters.map(c=><label className="mr-4 inline-flex items-center gap-2" key={c.id}><input type="checkbox" checked={draft.characters.includes(c.id)} onChange={e=>setDraft({...draft,characters:e.target.checked?[...draft.characters,c.id]:draft.characters.filter(id=>id!==c.id),approved:false})}/>{c.name}</label>)}{!characters.length&&<p>Belum ada tokoh proyek. Tambahkan di panel karakter bila adegan memerlukan tokoh.</p>}{brief.characterProposal&&<p className="mt-2 text-muted">Tokoh yang diperlukan: {brief.characterProposal.name} · {brief.characterProposal.wardrobe}. Pilih identitas yang sesuai atau tambah karakter dahulu.</p>}</fieldset>
 <label className="block">Properti (satu per baris)<textarea rows={3} className={inputCls+' mt-1 w-full'} value={props} onChange={e=>setProps(e.target.value)}/></label>
 <details><summary>Bukti narasi & peringatan</summary>{brief.evidence.map((e,i)=><p className="mt-1" key={i}>{e.field}: “{e.quote}” · {e.source}</p>)}{brief.warnings.map(w=><p className="mt-1" key={w}>Peringatan: {w}</p>)}</details>
 </fieldset>
 {error&&<p role="alert" className="my-3 text-bad-ink">{error}</p>}
 <div className="sticky bottom-0 mt-4 flex flex-wrap gap-2 border-t border-line bg-surface pt-3">
 <Button variant="primary" disabled={busy} onClick={()=>void save(true)}>{busy?'Menyimpan…':'Setujui Scene Brief'}</Button>
 <Button disabled={busy} onClick={()=>void save(false)}>Simpan draf</Button><Button disabled={busy} onClick={onClose}>Batal</Button>
 </div></div></div>,document.body)
}
