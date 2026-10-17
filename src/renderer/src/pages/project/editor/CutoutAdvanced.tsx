import { useEffect, useState } from 'react'
import { createCutoutMask, cutoutMaskAt, type CutoutMaskKeyframe, type CutoutMask } from '@shared/cutout-mask'
import { cutoutIkAt, type CutoutIkChain } from '@shared/cutout-ik'
import type { CutoutLayer, CutoutScene } from '@shared/cutout-timeline'
import { createCutoutLayer } from '@shared/cutout-timeline'
import { Button, cx, inputCls } from '../../../components/ui'

function N({label,value,min=-10,max=10,onChange}:{label:string;value:number;min?:number;max?:number;onChange(n:number):void}){
  const [text,setText]=useState(String(value));useEffect(()=>setText(String(Number(value.toFixed(4)))),[value])
  return <label className="min-w-0 text-[11px]">{label}<input aria-label={label} className={cx(inputCls,'mt-1 w-full text-xs')} value={text} type="number" step="0.01" min={min} max={max} onChange={e=>setText(e.target.value)} onBlur={()=>{const n=Number(text);if(text.trim()&&Number.isFinite(n)&&n>=min&&n<=max)onChange(n);else setText(String(value))}}/></label>
}
export function CutoutMaskPanel({layer,timeMs,durationMs,onChange,onKeys}:{layer:CutoutLayer;timeMs:number;durationMs:number;onChange(mask:CutoutMask|null):void;onKeys(keys:CutoutMaskKeyframe[]):void}){
  const [mode,setMode]=useState<'base'|'key'>('base'),keys=layer.maskKeyframes??[]
  const mask=mode==='key'?cutoutMaskAt(layer.mask,keys,timeMs):layer.mask
  const set=(patch:Partial<CutoutMask>):void=>{
    if(!mask)return
    if(mode==='base'){onChange({...mask,...patch});return}
    const existing=keys.find(k=>k.timeMs===timeMs)
    if(!existing&&keys.length>=512||timeMs>=durationMs)return
    onKeys([...keys.filter(k=>k.timeMs!==timeMs),{id:existing?.id??crypto.randomUUID(),timeMs,mask:{...mask,...patch},easing:existing?.easing??'linear' as const}].sort((a,b)=>a.timeMs-b.timeMs))
  }
  return <section className="flex flex-col gap-3 border-b border-line px-[18px] py-4"><h3 className="text-sm font-semibold">Masking layer</h3>
    <label className="flex gap-2 text-xs"><input type="checkbox" aria-label="Aktifkan mask layer" checked={!!mask} onChange={e=>onChange(e.target.checked?createCutoutMask():null)}/>Aktifkan mask</label>
    {mask&&<><select aria-label="Mode animasi mask" className={cx(inputCls,'text-xs')} value={mode} onChange={e=>setMode(e.target.value as 'base'|'key')}><option value="base">Mask dasar</option><option value="key">Keyframe pada playhead</option></select><Button size="sm" disabled={timeMs>=durationMs||keys.length>=512&&!keys.some(k=>k.timeMs===timeMs)} onClick={()=>{setMode('key');const current=cutoutMaskAt(layer.mask,keys,timeMs);if(current)onKeys([...keys.filter(k=>k.timeMs!==timeMs),{id:keys.find(k=>k.timeMs===timeMs)?.id??crypto.randomUUID(),timeMs,mask:structuredClone(current),easing:'linear' as const}].sort((a,b)=>a.timeMs-b.timeMs))}}>Simpan mask · {(timeMs/1000).toFixed(3)}s</Button>{keys.map(k=><div className="flex items-center gap-1 text-xs" key={k.id}><span>{(k.timeMs/1000).toFixed(3)}s</span><select aria-label={`Interpolasi mask ${k.id}`} className={cx(inputCls,'min-w-0 flex-1 text-xs')} value={k.easing} onChange={e=>onKeys(keys.map(v=>v.id===k.id?{...v,easing:e.target.value as 'linear'|'hold'}:v))}><option value="linear">Linear</option><option value="hold">Tahan</option></select><Button size="sm" onClick={()=>onKeys(keys.filter(v=>v.id!==k.id))}>Hapus</Button></div>)}<select aria-label="Bentuk mask" className={cx(inputCls,'text-xs')} value={mask.kind} onChange={e=>set({kind:e.target.value as CutoutMask['kind']})}><option value="rect">Persegi / crop</option><option value="ellipse">Elips</option><option value="polygon">Poligon</option></select>
      {mask.kind!=='polygon'?<div className="grid grid-cols-2 gap-2"><N label="Mask X (%)" value={mask.x*100} min={0} max={100} onChange={v=>set({x:v/100})}/><N label="Mask Y (%)" value={mask.y*100} min={0} max={100} onChange={v=>set({y:v/100})}/><N label="Lebar mask (%)" value={mask.width*100} min={.1} max={100} onChange={v=>set({width:v/100})}/><N label="Tinggi mask (%)" value={mask.height*100} min={.1} max={100} onChange={v=>set({height:v/100})}/></div>:<>{mask.points.map((p,i)=><div className="grid grid-cols-[1fr_1fr_auto] items-end gap-1" key={i}><N label={`Titik ${i+1} X (%)`} value={p.x*100} min={0} max={100} onChange={v=>set({points:mask.points.map((q,j)=>j===i?{...q,x:v/100}:q)})}/><N label={`Titik ${i+1} Y (%)`} value={p.y*100} min={0} max={100} onChange={v=>set({points:mask.points.map((q,j)=>j===i?{...q,y:v/100}:q)})}/><Button size="sm" disabled={mask.points.length<=3} onClick={()=>set({points:mask.points.filter((_,j)=>i!==j)})}>×</Button></div>)}<Button size="sm" disabled={mask.points.length>=64} onClick={()=>set({points:[...mask.points,{x:.5,y:.5}]})}>Tambah titik mask</Button></>}
      <N label="Feather mask (%)" value={mask.feather*100} min={0} max={25} onChange={v=>set({feather:v/100})}/><label className="flex gap-2 text-xs"><input aria-label="Balik mask" type="checkbox" checked={mask.invert} onChange={e=>set({invert:e.target.checked})}/>Balik mask (lubang)</label>
      <p className="text-[11px] text-muted">Koordinat relatif gambar. Mask mengikuti gerak/pose dan dapat berubah di playhead; posisi, ukuran, titik dan feather ikut preview/ekspor. Perubahan bentuk, jumlah titik atau invert memakai pergantian diskret; bukan rotoscope otomatis. Untuk kontur rambut, gunakan alpha aset dan tinjau tepinya.</p></>}
  </section>
}
export function CutoutIkPanel({scene,timeMs,durationMs,save}:{scene:CutoutScene;timeMs:number;durationMs:number;save(scene:CutoutScene):boolean}){
  const [selected,setSelected]=useState<string|null>(null),[mode,setMode]=useState<'base'|'key'>('base')
  const chains=scene.ik??[],chain=chains.find(c=>c.id===selected)??chains[0]
  const patch=(p:Partial<CutoutIkChain>):void=>{if(chain)save({...scene,ik:chains.map(c=>c.id===chain.id?{...c,...p}:c)})}
  const value=chain?(mode==='key'?cutoutIkAt(chain,timeMs):chain):null
  const target=(p:Partial<Pick<CutoutIkChain,'targetX'|'targetY'|'weight'>>):void=>{
    if(!chain||!value)return
    if(mode==='base'){patch(p);return}
    const previous=chain.keyframes.find(k=>k.timeMs===timeMs)
    patch({keyframes:[...chain.keyframes.filter(k=>k.timeMs!==timeMs),{id:previous?.id??crypto.randomUUID(),timeMs,...value,...p,easing:previous?.easing??'ease-in-out'}]})
  }
  const add=():void=>{
    const upper=createCutoutLayer(crypto.randomUUID(),'IK · tulang atas',null),lower=createCutoutLayer(crypto.randomUUID(),'IK · tulang bawah',null)
    upper.width=lower.width=.12;upper.pivotX=lower.pivotX=0;upper.transform.x=.4;upper.transform.y=.5
    lower.parentId=upper.id;lower.transform.x=.12;lower.transform.y=0
    const next:CutoutIkChain={id:crypto.randomUUID(),name:'Lengan / kaki IK',enabled:true,upperId:upper.id,lowerId:lower.id,endX:.12,endY:0,targetX:.6,targetY:.55,bend:1,weight:1,keyframes:[]}
    if(save({...scene,layers:[...scene.layers,upper,lower],ik:[...chains,next]}))setSelected(next.id)
  }
  return <section className="flex flex-col gap-3 border-b border-line px-[18px] py-4"><h3 className="text-sm font-semibold">Inverse kinematics · 2 tulang</h3>
    <Button size="sm" disabled={chains.length>=16||scene.layers.length>62} onClick={add}>Buat rantai IK + dua slot gambar</Button>
    <p className="text-[11px] text-muted">Pasang PNG bagian tubuh pada dua slot, atur pivot sendi dan posisi anak, lalu gerakkan target. Target di luar jangkauan dijepit tanpa meregangkan gambar.</p>
    {chain&&value&&<><select aria-label="Rantai IK" value={chain.id} className={cx(inputCls,'text-xs')} onChange={e=>setSelected(e.target.value)}>{chains.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select>
      <input aria-label="Nama rantai IK" className={cx(inputCls,'text-xs')} value={chain.name} onChange={e=>{if(e.target.value.trim())patch({name:e.target.value})}}/>
      <label className="flex gap-2 text-xs"><input aria-label="IK aktif" type="checkbox" checked={chain.enabled} onChange={e=>patch({enabled:e.target.checked})}/>IK aktif</label>
      <label className="text-xs">Tulang atas<select aria-label="Tulang atas IK" className={cx(inputCls,'mt-1 w-full text-xs')} value={chain.upperId} onChange={e=>{const lower=scene.layers.find(l=>l.parentId===e.target.value);if(lower)patch({upperId:e.target.value,lowerId:lower.id})}}>{scene.layers.filter(l=>scene.layers.some(c=>c.parentId===l.id)).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label className="text-xs">Tulang bawah<select aria-label="Tulang bawah IK" className={cx(inputCls,'mt-1 w-full text-xs')} value={chain.lowerId} onChange={e=>patch({lowerId:e.target.value})}>{scene.layers.filter(l=>l.parentId===chain.upperId).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-2"><N label="Ujung lokal X (%)" value={chain.endX*100} min={-1000} max={1000} onChange={v=>patch({endX:v/100})}/><N label="Ujung lokal Y (%)" value={chain.endY*100} min={-1000} max={1000} onChange={v=>patch({endY:v/100})}/></div>
      <label className="text-xs">Target kontak mengikuti layer<select aria-label="Layer target kontak IK" className={cx(inputCls,'mt-1 w-full text-xs')} value={chain.targetLayerId??''} onChange={e=>patch({targetLayerId:e.target.value||null})}><option value="">Posisi scene</option>{scene.layers.filter(l=>l.id!==chain.upperId&&l.id!==chain.lowerId).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      {chain.targetLayerId&&<p className="text-[11px] text-muted">X/Y menjadi titik pada gambar target: 0–100%. Kontak mengikuti gerak, rotasi, skala dan kamera setiap frame. Tinjau pivot serta jangkauan tulang.</p>}
      <select aria-label="Mode target IK" value={mode} className={cx(inputCls,'text-xs')} onChange={e=>setMode(e.target.value as 'base'|'key')}><option value="base">Target dasar</option><option value="key">Keyframe di playhead</option></select>
      <div className="grid grid-cols-2 gap-2"><N label="Target IK X (%)" value={value.targetX*100} min={-1000} max={1000} onChange={v=>target({targetX:v/100})}/><N label="Target IK Y (%)" value={value.targetY*100} min={-1000} max={1000} onChange={v=>target({targetY:v/100})}/><N label="Pengaruh IK (%)" value={value.weight*100} min={0} max={100} onChange={v=>target({weight:v/100})}/></div>
      <select aria-label="Arah tekuk IK" className={cx(inputCls,'text-xs')} value={chain.bend} onChange={e=>patch({bend:Number(e.target.value) as 1|-1})}><option value="1">Tekuk kanan</option><option value="-1">Tekuk kiri</option></select>
      <Button size="sm" disabled={chain.keyframes.length>=8192||timeMs>=durationMs} onClick={()=>{setMode('key');const current=cutoutIkAt(chain,timeMs);patch({keyframes:[...chain.keyframes.filter(k=>k.timeMs!==timeMs),{id:crypto.randomUUID(),timeMs,...current,easing:'ease-in-out'}]})}}>Simpan target IK · {(timeMs/1000).toFixed(2)}s</Button>
      {chain.keyframes.map(k=><div className="flex items-center gap-2 text-xs" key={k.id}><span className="flex-1">{(k.timeMs/1000).toFixed(2)}s · {(k.targetX*100).toFixed(0)}%, {(k.targetY*100).toFixed(0)}%</span><Button size="sm" onClick={()=>patch({keyframes:chain.keyframes.filter(v=>v.id!==k.id)})}>Hapus key</Button></div>)}
      <Button size="sm" onClick={()=>save({...scene,ik:chains.filter(c=>c.id!==chain.id)})}>Hapus IK · pertahankan layer</Button></>}
  </section>
}

