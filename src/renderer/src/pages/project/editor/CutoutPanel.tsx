import { validateSpecialVideo } from '@shared/special-clips'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Bone, Camera, ImagePlus, Layers, Pause, Play, Plus, Trash2 } from 'lucide-react'
import {
  CUTOUT_EASINGS, CUTOUT_LIMITS, createCutoutLayer, createCutoutScene,
  cutoutCameraAt, cutoutTransformAt, normalizeCutoutScene,
  type CutoutCamera, type CutoutEasing, type CutoutLayer, type CutoutScene, type CutoutTransform
} from '@shared/cutout-timeline'
import type { Asset, Clip } from '@shared/types'
import { cx, inputCls } from '../../../components/ui'
import { errorText } from '../../../lib/format'
import { useProject } from '../../../store/project'
import { usePlayback, useTimeline } from './engine'
import { useCutoutUi } from './CutoutFrame'
import { CutoutAssetPanel } from './CutoutAssetPanel'
import { CutoutIkPanel, CutoutMaskPanel } from './CutoutAdvanced'

const actionCls = 'inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-line-2 bg-surface px-2 py-1.5 text-xs font-semibold hover:border-ink disabled:cursor-not-allowed disabled:opacity-40'
const selectCls = `${inputCls} w-full min-w-0 text-xs`
const uid = (): string => crypto.randomUUID()
const sec = (ms: number): string => `${(ms / 1000).toFixed(2)} dtk`

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="flex flex-col gap-3 border-b border-line px-[18px] py-4"><h3 className="text-sm font-semibold">{title}</h3>{children}</section>
}

/** Incomplete input stays local; only finite, in-range values reach saved scene state. */
function NumberField({ label, value, onChange, min, max, step = 0.01, factor = 1 }: {
  label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number; factor?: number
}) {
  const shown = String(Number((value * factor).toFixed(3)))
  const [draft, setDraft] = useState(shown)
  const [invalid, setInvalid] = useState(false)
  useEffect(() => { setDraft(shown); setInvalid(false) }, [shown])
  const commit = (): void => {
    const next = Number(draft.replace(',', '.')) / factor
    if (!draft.trim() || !Number.isFinite(next) || next < min || next > max) { setInvalid(true); return }
    setInvalid(false)
    if (Math.abs(next - value) > 1e-8) onChange(next)
  }
  return <label className="flex min-w-0 flex-col gap-1 text-[11px] text-ink-2">
    {label}
    <input aria-label={label} aria-invalid={invalid} inputMode="decimal" type="number" step={step} min={min * factor} max={max * factor}
      value={draft} onChange={event => { setDraft(event.target.value); setInvalid(false) }} onBlur={commit}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }}
      className={cx(inputCls, 'w-full min-w-0 text-xs', invalid && 'border-red-600')} />
    {invalid && <span role="alert" className="text-red-700">Isi {min * factor}–{max * factor}.</span>}
  </label>
}

function EasingSelect({ value, onChange, label = 'Interpolasi' }: { value: CutoutEasing; onChange: (value: CutoutEasing) => void; label?: string }) {
  return <label className="flex min-w-0 flex-col gap-1 text-[11px] text-ink-2">{label}
    <select aria-label={label} value={value} onChange={event => onChange(event.target.value as CutoutEasing)} className={selectCls}>
      {CUTOUT_EASINGS.map(easing => <option key={easing.id} value={easing.id}>{easing.label}</option>)}
    </select>
  </label>
}

function AssetSelect({ value, assets, onChange, label, allowEmpty = true }: {
  value: string | null; assets: Asset[]; onChange: (value: string | null) => void; label: string; allowEmpty?: boolean
}) {
  return <label className="flex min-w-0 flex-col gap-1 text-[11px] text-ink-2">{label}
    <select aria-label={label} className={selectCls} value={value ?? ''} onChange={event => onChange(event.target.value || null)}>
      <option value="" disabled={!allowEmpty}>{allowEmpty ? 'Tanpa gambar · grup / sendi' : 'Pilih gambar'}</option>
      {value && !assets.some(asset => asset.id === value) && <option value={value}>Aset tidak tersedia · pilih ulang</option>}
      {assets.map((asset, index) => <option key={asset.id} value={asset.id}>{asset.prompt?.slice(0, 55) || asset.localPath.split(/[\\/]/).pop() || `Gambar ${index + 1}`}</option>)}
    </select>
  </label>
}

function TransformFields({ value, onChange }: { value: CutoutTransform; onChange: (patch: Partial<CutoutTransform>) => void }) {
  return <div className="grid grid-cols-2 gap-2">
    <NumberField label="Posisi X (%)" value={value.x} min={-10} max={10} factor={100} step={1} onChange={x => onChange({ x })} />
    <NumberField label="Posisi Y (%)" value={value.y} min={-10} max={10} factor={100} step={1} onChange={y => onChange({ y })} />
    <NumberField label="Skala (%)" value={value.scale} min={0.01} max={10} factor={100} step={1} onChange={scale => onChange({ scale })} />
    <NumberField label="Rotasi (°)" value={value.rotation} min={-36000} max={36000} step={1} onChange={rotation => onChange({ rotation })} />
    <NumberField label="Opacity (%)" value={value.opacity} min={0} max={1} factor={100} step={1} onChange={opacity => onChange({ opacity })} />
  </div>
}

function ModeSwitch({ mode, onChange }: { mode: 'base' | 'key'; onChange: (mode: 'base' | 'key') => void }) {
  return <div className="grid grid-cols-2 gap-1 rounded-lg bg-sand p-1">
    {(['base', 'key'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => onChange(value)} className={cx('rounded-md px-2 py-1.5 text-xs', mode === value && 'bg-surface font-semibold shadow-sm')}>
      {value === 'base' ? 'Pose dasar' : 'Keyframe di playhead'}
    </button>)}
  </div>
}

function descendants(scene: CutoutScene, id: string): Set<string> {
  const result = new Set([id])
  for (let index = 0; index < scene.layers.length; index++) {
    for (const layer of scene.layers) if (layer.parentId && result.has(layer.parentId)) result.add(layer.id)
  }
  return result
}

export function CutoutPanel({ clip }: { clip: Clip }) {
  const { project, assets, addAsset, updateClip } = useProject()
  const { items } = useTimeline()
  const { t, playing, seek, pause, play } = usePlayback()
  const selection = useCutoutUi()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'base' | 'key'>('base')
  const [cameraMode, setCameraMode] = useState<'base' | 'key'>('base')
  const [easing, setEasing] = useState<CutoutEasing>('ease-in-out')
  const [cameraEasing, setCameraEasing] = useState<CutoutEasing>('ease-in-out')
  const [addAssetId, setAddAssetId] = useState<string | null>(null)
  const [poseAssetId, setPoseAssetId] = useState<string | null>(null)
  const clipPlayback = useRef(false)
  const item = items.find(candidate => candidate.clip.id === clip.id)
  const start = item?.start ?? 0
  const timeMs = Math.round(Math.max(0, Math.min(clip.durationMs, (t - start) * 1000)))
  const scene = clip.cutout ?? null
  const imageAssets = Object.values(assets).filter(asset => (asset.kind === 'image' || asset.kind === 'overlay') && /\.(png|jpe?g|webp)$/i.test(asset.localPath))
  const selected = scene?.layers.find(layer => selection.clipId === clip.id && layer.id === selection.layerId) ?? null

  useEffect(() => { setError(null); setMode('base'); setCameraMode('base'); clipPlayback.current = false }, [clip.id])
  useEffect(() => {
    if (clipPlayback.current && playing && t >= start + clip.durationMs / 1000) {
      clipPlayback.current = false
      pause()
      seek(Math.max(start, start + clip.durationMs / 1000 - 0.001))
    }
  }, [t, playing, start, clip.durationMs, pause, seek])
  useEffect(() => () => { if (clipPlayback.current) usePlayback.getState().pause() }, [])

  const save = (next: CutoutScene): boolean => {
    try {
      const checked = normalizeCutoutScene(next)
      updateClip(clip.id, { cutout: checked })
      setError(null)
      return true
    } catch (cause) { setError(errorText(cause)); return false }
  }
  const patchLayer = (id: string, patch: Partial<CutoutLayer>): void => {
    if (scene) save({ ...scene, layers: scene.layers.map(layer => layer.id === id ? { ...layer, ...patch } : layer) })
  }
  const jumpTo = (ms: number): void => {
    clipPlayback.current = false
    pause()
    seek(start + Math.max(0, Math.min(clip.durationMs - 0.001, ms)) / 1000)
  }
  const pick = (layer: CutoutLayer): void => {
    selection.select(clip.id, layer.id)
    setPoseAssetId(null)
    if (timeMs < layer.inMs || (layer.outMs !== null && timeMs >= layer.outMs)) jumpTo(layer.inMs)
  }
  const initialize = (): void => {
    const next = createCutoutScene()
    const image = clip.imageAssetId ? assets[clip.imageAssetId] : null
    if (image) {
      const layer = createCutoutLayer(uid(), 'Latar adegan', image.id)
      const ratio = project?.aspectRatio === '9:16' ? 9 / 16 : 16 / 9
      const sourceRatio = image.width && image.height ? image.width / image.height : ratio
      layer.width = Math.min(10, Math.max(1, sourceRatio / ratio))
      layer.depth = 0.25
      next.layers.push(layer)
    }
    if (save(next)) selection.select(clip.id, next.layers[0]?.id ?? null)
    jumpTo(0)
  }
  const addLayer = (assetId: string | null, name?: string): void => {
    if (!scene) return
    const layer = createCutoutLayer(uid(), name ?? (assetId ? `Objek ${scene.layers.length + 1}` : 'Grup / sendi'), assetId)
    if (save({ ...scene, layers: [...scene.layers, layer] })) pick(layer)
  }
  const importImage = async (forPose = false): Promise<void> => {
    if (!project) return
    setBusy(true)
    try {
      const asset = await window.api.assets.pickImage(project.id)
      if (asset) {
        addAsset(asset)
        if (forPose) setPoseAssetId(asset.id)
        else {
          // Picker can stay open while editing; append to the latest saved scene.
          const latest = useProject.getState().clips.find(entry => entry.id === clip.id)?.cutout
          if (latest) {
            const layer = createCutoutLayer(uid(), `Objek ${latest.layers.length + 1}`, asset.id)
            if (save({ ...latest, layers: [...latest.layers, layer] })) selection.select(clip.id, layer.id)
          }
        }
      }
    } catch (cause) { setError(errorText(cause)) }
    finally { setBusy(false) }
  }
  const addRig = (): void => {
    if (!scene) return
    const root = createCutoutLayer(uid(), 'Rig karakter', null)
    const slots: [string, number, number, number, number, number][] = [
      ['Badan', 0, 0, 0.26, 0.5, 0.5], ['Kepala', 0, -0.15, 0.18, 0.5, 0.85],
      ['Lengan kiri', -0.1, -0.05, 0.1, 0.5, 0.1], ['Lengan kanan', 0.1, -0.05, 0.1, 0.5, 0.1],
      ['Kaki kiri', -0.05, 0.16, 0.1, 0.5, 0.1], ['Kaki kanan', 0.05, 0.16, 0.1, 0.5, 0.1]
    ]
    const children = slots.map(([name, x, y, width, pivotX, pivotY]) => ({
      ...createCutoutLayer(uid(), name, null), parentId: root.id, width, pivotX, pivotY,
      transform: { x, y, scale: 1, rotation: 0, opacity: 1 }
    }))
    if (save({ ...scene, layers: [...scene.layers, root, ...children] })) pick(root)
  }
  const writeTransform = (patch: Partial<CutoutTransform>, forceKey = false): void => {
    if (!selected) return
    if (mode === 'base' && !forceKey) { patchLayer(selected.id, { transform: { ...selected.transform, ...patch } }); return }
    const existing = selected.keyframes.find(key => key.timeMs === timeMs)
    const key = { id: existing?.id ?? uid(), timeMs, transform: { ...cutoutTransformAt(selected, timeMs), ...patch }, easing: existing?.easing ?? easing }
    patchLayer(selected.id, { keyframes: [...selected.keyframes.filter(entry => entry.timeMs !== timeMs), key] })
  }
  const writeCamera = (patch: Partial<Pick<CutoutCamera, 'x' | 'y' | 'zoom'>>, forceKey = false): void => {
    if (!scene) return
    if (cameraMode === 'base' && !forceKey) { save({ ...scene, camera: { ...scene.camera, ...patch } }); return }
    const existing = scene.camera.keyframes.find(key => key.timeMs === timeMs)
    const current = cutoutCameraAt(scene.camera, timeMs)
    const key = { id: existing?.id ?? uid(), timeMs, x: current.x, y: current.y, zoom: current.zoom, easing: existing?.easing ?? cameraEasing, ...patch }
    save({ ...scene, camera: { ...scene.camera, keyframes: [...scene.camera.keyframes.filter(entry => entry.timeMs !== timeMs), key] } })
  }
  const addPose = (): void => {
    if (!selected || !poseAssetId) return
    const existing = selected.poses.find(pose => pose.timeMs === timeMs)
    patchLayer(selected.id, { poses: [...selected.poses.filter(pose => pose.timeMs !== timeMs), { id: existing?.id ?? uid(), timeMs, assetId: poseAssetId }] })
  }
  const attachGenerated = (asset: Asset): void => {
    const next = scene ?? createCutoutScene(), meta = asset.meta.cutoutAsset as { role?: string; timeMs?: number } | undefined
    if (next.layers.length >= CUTOUT_LIMITS.layers) { setError(`Maksimal ${CUTOUT_LIMITS.layers} layer per klip.`); return }
    const layer = createCutoutLayer(uid(), asset.prompt?.slice(0,120) || 'Aset Cutout', asset.id)
    if (meta?.role === 'background') {
      const ratio = project?.aspectRatio === '9:16' ? 9/16 : 16/9, sourceRatio = asset.width && asset.height ? asset.width/asset.height : ratio
      layer.width = Math.min(10,Math.max(1,sourceRatio/ratio)); layer.depth=.25
    } else { layer.width = meta?.role === 'prop' ? .22 : .45; layer.inMs = Math.max(0,Math.min(clip.durationMs-1,meta?.timeMs??0)) }
    if (save({ ...next, layers: meta?.role === 'background' ? [layer,...next.layers] : [...next.layers,layer] })) pick(layer)
  }
  const poseGenerated = (asset: Asset): void => {
    if (!selected) { setError('Pilih layer karakter terlebih dahulu untuk menjadwalkan pose.'); return }
    const meta=asset.meta.cutoutAsset as {timeMs?:number}|undefined, at=Math.max(0,Math.min(clip.durationMs-1,meta?.timeMs??timeMs))
    patchLayer(selected.id,{poses:[...selected.poses.filter(p=>p.timeMs!==at),{id:uid(),timeMs:at,assetId:asset.id}]})
  }

  if (!project) return null
  if (!scene) return <>
    <CutoutAssetPanel clip={clip} attach={attachGenerated} pose={poseGenerated}/>
    <Section title="Cutout · Fakta & Komedi">
      <p className="text-xs leading-relaxed text-ink-2">Susun latar, karakter, properti, dan foreground. Setiap objek punya keyframe, pose terjadwal, induk rig, dan kedalaman kamera.</p>
      <button type="button" className={actionCls} onClick={initialize}><Layers className="size-4" />Buat komposisi dari klip</button>
      <p className="text-xs text-muted">Gambar klip menjadi latar. Impor bagian karakter dan pose sebagai PNG atau WebP transparan.</p>
    </Section>
    {error && <p role="alert" className="p-4 text-xs text-red-700">{error}</p>}
  </>

  const forbiddenParents = selected ? descendants(scene, selected.id) : new Set<string>()
  const transformValue = selected ? mode === 'base' ? selected.transform : cutoutTransformAt(selected, timeMs) : null
  const cameraValue = cameraMode === 'base' ? scene.camera : cutoutCameraAt(scene.camera, timeMs)
  const beyond = scene.layers.some(layer => (layer.maskKeyframes??[]).some(key=>key.timeMs>clip.durationMs) || layer.keyframes.some(key => key.timeMs > clip.durationMs) || layer.poses.some(pose => pose.timeMs > clip.durationMs)) || scene.camera.keyframes.some(key => key.timeMs > clip.durationMs)

  if(scene?.specialVideo){
    const special=scene.specialVideo,source=assets[special.assetId]
    const change=(patch:Partial<typeof special>)=>{try{const next={...special,...patch};validateSpecialVideo(next,source,clip.projectId,clip.durationMs);save({...scene,specialVideo:next})}catch(e){setError(errorText(e))}}
    return <div data-special-video-panel={clip.id}><Section title="Klip khusus · aksi kontinu">
      <p className="text-xs leading-relaxed">{special.action}</p>
      <p className="text-[11px] text-muted">Satu video penuh. Narasi dan caption tetap terpisah; suara sumber dibisukan.</p>
      <NumberField label="Awal sumber (detik)" value={special.startMs} factor={.001} min={0} max={Math.max(0,(source?.durationMs??0)-clip.durationMs*special.speed)} step={.01} onChange={startMs=>change({startMs:Math.round(startMs)})}/>
      <NumberField label="Kecepatan klip khusus" value={special.speed} min={.25} max={4} step={.01} onChange={speed=>change({speed})}/>
      <button className={actionCls} onClick={()=>{if(source?.durationMs)change({startMs:0,speed:source.durationMs/clip.durationMs})}}>Sesuaikan seluruh video ke narasi</button>
      <button className={actionCls} onClick={initialize}>Kembali ke layer Cutout</button>
      {error&&<p role="alert" className="text-xs text-bad-ink">{error}</p>}
    </Section></div>
  }
  return <div data-cutout-panel={clip.id} onFocusCapture={event => {
    if (playing && event.target instanceof HTMLElement && event.target.matches('input, select')) { clipPlayback.current = false; pause() }
  }}>
    <CutoutAssetPanel clip={clip} attach={attachGenerated} pose={poseGenerated}/>
    {!!scene.shots?.length&&<Section title="Shot produksi · Dafiology">
      <p className="text-[11px] leading-relaxed text-muted">Klik shot untuk pratinjau pada waktunya. Aset tetap tersimpan sebagai layer/pose; pola gerak disusun dari daftar terbatas.</p>
      <ol className="flex flex-col gap-2" data-cutout-shot-list>{scene.shots.map((shot,index)=><li key={shot.id}>
        <button type="button" className={cx(actionCls,'w-full flex-col items-start text-left')} onClick={()=>{jumpTo(shot.startMs);if(shot.movers[0])selection.select(clip.id,shot.movers[0])}}>
          <span>{index+1}. {shot.beat} · {sec(shot.startMs)}–{sec(shot.endMs)}</span>
          <span className="text-[11px] font-normal">{shot.motionPattern} · {shot.movers.length} mover: {shot.movers.map(id=>scene.layers.find(l=>l.id===id)?.name??id).join(', ')||'statis'}</span>
          <span className="text-[11px] font-normal text-muted">{shot.action}</span>
        </button>
      </li>)}</ol>
    </Section>}
    <Section title="Cutout · Fakta & Komedi">
      <div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{clip.title}</span>
        <label className="flex shrink-0 items-center gap-1.5 text-xs"><input type="checkbox" checked={scene.enabled} onChange={event => save({ ...scene, enabled: event.target.checked })} />Aktif</label>
      </div>
      {!scene.enabled && <p className="text-xs text-ink-2">Komposisi disimpan. Pratinjau dan ekspor menggunakan gambar/video klip selama Cutout nonaktif.</p>}
      <div className="flex items-center gap-2">
        <button type="button" className={actionCls} aria-label={playing ? 'Jeda klip Cutout' : 'Putar klip Cutout'} onClick={() => {
          if (playing) { clipPlayback.current = false; pause(); return }
          clipPlayback.current = true
          if (t < start || t >= start + clip.durationMs / 1000 - 0.05) seek(start)
          play()
        }}>{playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}</button>
        <input aria-label="Playhead lokal Cutout" className="min-w-0 flex-1 accent-amber-600" type="range" min={0} max={clip.durationMs} step={1} value={timeMs} onChange={event => jumpTo(Number(event.target.value))} />
        <span className="shrink-0 font-mono text-[11px]">{sec(timeMs)}</span>
      </div>
      <NumberField label="Waktu lokal (detik)" value={timeMs} factor={0.001} min={0} max={clip.durationMs} step={0.01} onChange={jumpTo} />
      {beyond && <p className="text-xs text-amber-800">Ada keyframe atau pose melewati durasi klip. Datanya tetap tersimpan; geser waktunya atau panjangkan klip.</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}
    </Section>

    <Section title={`Layer · ${scene.layers.length}/${CUTOUT_LIMITS.layers}`}>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={actionCls} disabled={busy || scene.layers.length >= CUTOUT_LIMITS.layers} onClick={() => void importImage()}><ImagePlus className="size-4" />Impor gambar</button>
        <button type="button" className={actionCls} disabled={scene.layers.length >= CUTOUT_LIMITS.layers} onClick={() => addLayer(null)}><Plus className="size-4" />Grup / sendi</button>
        <button type="button" className={cx(actionCls, 'col-span-2')} disabled={scene.layers.length + 7 > CUTOUT_LIMITS.layers} onClick={addRig}><Bone className="size-4" />Buat rig karakter · 6 slot</button>
      </div>
      <div className="flex items-end gap-2"><div className="min-w-0 flex-1"><AssetSelect value={addAssetId} assets={imageAssets} onChange={setAddAssetId} label="Gambar proyek" allowEmpty={false} /></div>
        <button type="button" className={actionCls} disabled={!addAssetId || scene.layers.length >= CUTOUT_LIMITS.layers} onClick={() => addLayer(addAssetId)}>Tambah</button>
      </div>
      <p className="text-[11px] text-muted">Daftar dari belakang ke depan. Rig memakai gambar bagian tubuh terpisah; pilih setiap slot untuk memasang gambar.</p>
      <div className="flex flex-col gap-1.5">
        {scene.layers.map((layer, index) => <div key={layer.id} className={cx('flex items-center gap-1 rounded-lg border p-1.5', selected?.id === layer.id ? 'border-amber-600 bg-sun-soft' : 'border-line')}>
          <button type="button" aria-pressed={selected?.id === layer.id} onClick={() => pick(layer)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            {layer.assetId && assets[layer.assetId] ? <img src={assets[layer.assetId].url} alt="" className="size-8 shrink-0 rounded bg-white/70 object-contain" /> : <Bone className="size-5 shrink-0 text-muted" />}
            <span className="min-w-0"><span className="block truncate text-xs font-semibold">{layer.parentId ? '↳ ' : ''}{layer.name}</span><span className="block text-[10px] text-muted">{layer.keyframes.length} key · {layer.poses.length} pose{!layer.visible ? ' · tersembunyi' : ''}</span></span>
          </button>
          <button type="button" aria-label={`Mundurkan ${layer.name}`} className="rounded p-1 disabled:opacity-25" disabled={index === 0} onClick={() => {
            const layers = [...scene.layers]; [layers[index - 1], layers[index]] = [layers[index], layers[index - 1]]; save({ ...scene, layers })
          }}><ArrowUp className="size-3.5" /></button>
          <button type="button" aria-label={`Majukan ${layer.name}`} className="rounded p-1 disabled:opacity-25" disabled={index === scene.layers.length - 1} onClick={() => {
            const layers = [...scene.layers]; [layers[index + 1], layers[index]] = [layers[index], layers[index + 1]]; save({ ...scene, layers })
          }}><ArrowDown className="size-3.5" /></button>
        </div>)}
      </div>
    </Section>

    {selected && transformValue && <>
      <Section title="Objek terpilih">
        <label className="flex flex-col gap-1 text-[11px] text-ink-2">Nama layer<input key={selected.id} aria-label="Nama layer" defaultValue={selected.name} maxLength={120} className={inputCls} onBlur={event => patchLayer(selected.id, { name: event.target.value })} /></label>
        <AssetSelect value={selected.assetId} assets={imageAssets} onChange={assetId => patchLayer(selected.id, { assetId })} label="Gambar dasar / slot rig" />
        {selected.assetId && !assets[selected.assetId] && <p role="alert" className="text-xs text-red-700">Gambar dasar hilang. Pilih aset yang tersedia.</p>}
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selected.visible} onChange={event => patchLayer(selected.id, { visible: event.target.checked })} />Tampilkan layer dan anaknya</label>
        <label className="flex flex-col gap-1 text-[11px] text-ink-2">Induk rig
          <select aria-label="Induk rig" className={selectCls} value={selected.parentId ?? ''} onChange={event => patchLayer(selected.id, { parentId: event.target.value || null })}>
            <option value="">Tidak ada · koordinat frame</option>
            {scene.layers.filter(layer => !forbiddenParents.has(layer.id)).map(layer => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
          </select>
        </label>
        <p className="text-[11px] text-muted">{selected.parentId ? 'Posisi X/Y dihitung dari pivot induk. Rotasi dan skala induk menggerakkan seluruh anak.' : 'Posisi 50%, 50% berada di tengah frame.'} Mengganti induk mengubah acuan posisi.</p>
        <ModeSwitch mode={mode} onChange={setMode} />
        <TransformFields key={`${selected.id}-${mode}`} value={transformValue} onChange={writeTransform} />
        {mode === 'base' && selected.keyframes.length > 0 && <p className="text-[11px] text-muted">Pose dasar menjadi awal animasi. Keyframe yang sudah ada menentukan gerak sesudahnya.</p>}
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Lebar gambar (%)" value={selected.width} factor={100} min={0.005} max={10} step={1} onChange={width => patchLayer(selected.id, { width })} />
          <NumberField label="Kedalaman kamera" value={selected.depth} min={0} max={2} step={0.1} onChange={depth => patchLayer(selected.id, { depth })} />
          <NumberField label="Pivot X (%)" value={selected.pivotX} factor={100} min={-2} max={3} step={1} onChange={pivotX => patchLayer(selected.id, { pivotX })} />
          <NumberField label="Pivot Y (%)" value={selected.pivotY} factor={100} min={-2} max={3} step={1} onChange={pivotY => patchLayer(selected.id, { pivotY })} />
        </div>
        <p className="text-[11px] text-muted">Kedalaman 0 tetap di layar, 1 normal, 2 paling dekat. Anak mengikuti kedalaman akar rig. Pivot adalah titik putar gambar; untuk grup, posisinya menjadi titik sendi.</p>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Muncul (detik)" value={selected.inMs} factor={0.001} min={0} max={CUTOUT_LIMITS.timeMs} step={0.01} onChange={inMs => patchLayer(selected.id, { inMs: Math.round(inMs) })} />
          {selected.outMs !== null && <NumberField label="Selesai (detik)" value={selected.outMs} factor={0.001} min={0} max={CUTOUT_LIMITS.timeMs} step={0.01} onChange={outMs => patchLayer(selected.id, { outMs: Math.round(outMs) })} />}
        </div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selected.outMs === null} onChange={event => patchLayer(selected.id, { outMs: event.target.checked ? null : Math.min(CUTOUT_LIMITS.timeMs, Math.max(selected.inMs + 1, clip.durationMs)) })} />Sampai akhir klip</label>
        <button type="button" className={cx(actionCls, 'text-red-700')} onClick={() => {
          const ids = descendants(scene, selected.id)
          if (save({ ...scene, layers: scene.layers.filter(layer => !ids.has(layer.id)), ...(scene.ik ? { ik: scene.ik.filter(c=>!ids.has(c.upperId)&&!ids.has(c.lowerId)&&(!c.targetLayerId||!ids.has(c.targetLayerId))) } : {}) })) selection.select(clip.id, null)
        }}><Trash2 className="size-3.5" />Hapus layer{forbiddenParents.size > 1 ? ` dan ${forbiddenParents.size - 1} anak` : ''}</button>
      </Section>

      <CutoutMaskPanel key={selected.id} layer={selected} timeMs={timeMs} durationMs={clip.durationMs} onChange={mask=>patchLayer(selected.id,{mask,...(!mask?{maskKeyframes:[]}:{})})} onKeys={maskKeyframes=>patchLayer(selected.id,{maskKeyframes})}/>
      <Section title={`Keyframe objek · ${selected.keyframes.length}`}>
        <EasingSelect value={easing} onChange={setEasing} label="Interpolasi keyframe baru" />
        <button type="button" className={actionCls} onClick={() => { setMode('key'); writeTransform({}, true) }} disabled={selected.keyframes.length >= CUTOUT_LIMITS.keys && !selected.keyframes.some(key => key.timeMs === timeMs)}><Plus className="size-3.5" />Simpan keyframe · {sec(timeMs)}</button>
        <p className="text-[11px] text-muted">Pilih waktu, lalu ubah transform dalam mode Keyframe. Interpolasi berlaku menuju keyframe tersebut; Tahan memberi perpindahan seketika.</p>
        {selected.keyframes.map(key => <div key={key.id} className="rounded-lg border border-line p-2" data-cutout-key={key.id}>
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <NumberField label="Waktu key (detik)" value={key.timeMs} factor={0.001} min={0} max={CUTOUT_LIMITS.timeMs} step={0.01} onChange={value => patchLayer(selected.id, { keyframes: selected.keyframes.map(entry => entry.id === key.id ? { ...entry, timeMs: Math.round(value) } : entry) })} />
            <EasingSelect value={key.easing} onChange={value => patchLayer(selected.id, { keyframes: selected.keyframes.map(entry => entry.id === key.id ? { ...entry, easing: value } : entry) })} />
            <button type="button" aria-label={`Hapus keyframe ${sec(key.timeMs)}`} className="p-2 text-red-700" onClick={() => patchLayer(selected.id, { keyframes: selected.keyframes.filter(entry => entry.id !== key.id) })}><Trash2 className="size-3.5" /></button>
          </div>
          <button type="button" className="mt-2 text-left font-mono text-[10px] text-ink-2 underline" onClick={() => { setMode('key'); jumpTo(key.timeMs) }}>Edit · X {(key.transform.x * 100).toFixed(0)}% · Y {(key.transform.y * 100).toFixed(0)}% · {key.transform.rotation.toFixed(1)}° · skala {(key.transform.scale * 100).toFixed(0)}%</button>
          {key.timeMs > clip.durationMs && <p className="mt-1 text-[10px] text-amber-800">Di luar durasi klip</p>}
        </div>)}
      </Section>

      <Section title={`Pergantian pose · ${selected.poses.length}`}>
        <AssetSelect value={poseAssetId} assets={imageAssets} onChange={setPoseAssetId} label="Gambar pose berikutnya" allowEmpty={false} />
        <div className="flex gap-2"><button type="button" className={actionCls} disabled={busy} onClick={() => void importImage(true)}><ImagePlus className="size-3.5" />Impor pose</button>
          <button type="button" className={cx(actionCls, 'flex-1')} disabled={!poseAssetId || (selected.poses.length >= CUTOUT_LIMITS.poses && !selected.poses.some(pose => pose.timeMs === timeMs))} onClick={addPose}>Ganti pada {sec(timeMs)}</button>
        </div>
        <p className="text-[11px] text-muted">Gambar diganti tepat pada waktunya; transform dan rig tetap berjalan. Samakan ukuran kanvas dan titik sambungan antarpose agar tidak melompat.</p>
        {selected.poses.map(pose => <div key={pose.id} className="rounded-lg border border-line p-2" data-cutout-pose={pose.id}>
          <AssetSelect value={pose.assetId} assets={imageAssets} label="Aset pose" allowEmpty={false} onChange={assetId => { if (assetId) patchLayer(selected.id, { poses: selected.poses.map(entry => entry.id === pose.id ? { ...entry, assetId } : entry) }) }} />
          <div className="mt-2 flex items-end gap-2"><div className="min-w-0 flex-1"><NumberField label="Waktu pose (detik)" value={pose.timeMs} factor={0.001} min={0} max={CUTOUT_LIMITS.timeMs} step={0.01} onChange={value => patchLayer(selected.id, { poses: selected.poses.map(entry => entry.id === pose.id ? { ...entry, timeMs: Math.round(value) } : entry) })} /></div>
            <button type="button" className={actionCls} onClick={() => jumpTo(pose.timeMs)}>Lihat</button>
            <button type="button" aria-label={`Hapus pose ${sec(pose.timeMs)}`} className="p-2 text-red-700" onClick={() => patchLayer(selected.id, { poses: selected.poses.filter(entry => entry.id !== pose.id) })}><Trash2 className="size-3.5" /></button>
          </div>
          {pose.timeMs > clip.durationMs && <p className="mt-1 text-[10px] text-amber-800">Di luar durasi klip</p>}
        </div>)}
      </Section>
    </>}

    <CutoutIkPanel scene={scene} timeMs={timeMs} durationMs={clip.durationMs} save={save}/>
    <Section title="Kamera & parallax">
      <label className="flex items-center justify-between text-xs">Warna latar<input aria-label="Warna latar Cutout" type="color" value={scene.backgroundColor} onChange={event => save({ ...scene, backgroundColor: event.target.value })} /></label>
      <ModeSwitch mode={cameraMode} onChange={setCameraMode} />
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Kamera X (%)" value={cameraValue.x} factor={100} min={-10} max={10} step={1} onChange={x => writeCamera({ x })} />
        <NumberField label="Kamera Y (%)" value={cameraValue.y} factor={100} min={-10} max={10} step={1} onChange={y => writeCamera({ y })} />
        <NumberField label="Zoom kamera (%)" value={cameraValue.zoom} factor={100} min={0.1} max={10} step={1} onChange={zoom => writeCamera({ zoom })} />
        <EasingSelect value={cameraEasing} onChange={setCameraEasing} label="Interpolasi kamera baru" />
      </div>
      <button type="button" className={actionCls} onClick={() => { setCameraMode('key'); writeCamera({}, true) }} disabled={scene.camera.keyframes.length >= CUTOUT_LIMITS.keys && !scene.camera.keyframes.some(key => key.timeMs === timeMs)}><Camera className="size-3.5" />Key kamera · {sec(timeMs)}</button>
      <p className="text-[11px] text-muted">Animasikan kamera untuk gerak kedalaman. Latar jauh bergerak lebih lambat daripada karakter dan foreground.</p>
      {scene.camera.keyframes.map(key => <div key={key.id} className="rounded-lg border border-line p-2" data-cutout-camera-key={key.id}>
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <NumberField label="Waktu kamera (detik)" value={key.timeMs} factor={0.001} min={0} max={CUTOUT_LIMITS.timeMs} step={0.01} onChange={value => save({ ...scene, camera: { ...scene.camera, keyframes: scene.camera.keyframes.map(entry => entry.id === key.id ? { ...entry, timeMs: Math.round(value) } : entry) } })} />
          <EasingSelect value={key.easing} onChange={value => save({ ...scene, camera: { ...scene.camera, keyframes: scene.camera.keyframes.map(entry => entry.id === key.id ? { ...entry, easing: value } : entry) } })} />
          <button type="button" aria-label={`Hapus key kamera ${sec(key.timeMs)}`} className="p-2 text-red-700" onClick={() => save({ ...scene, camera: { ...scene.camera, keyframes: scene.camera.keyframes.filter(entry => entry.id !== key.id) } })}><Trash2 className="size-3.5" /></button>
        </div>
        <button type="button" className="mt-2 text-left font-mono text-[10px] text-ink-2 underline" onClick={() => { setCameraMode('key'); jumpTo(key.timeMs) }}>Edit · X {(key.x * 100).toFixed(0)}% · Y {(key.y * 100).toFixed(0)}% · zoom {(key.zoom * 100).toFixed(0)}%</button>
        {key.timeMs > clip.durationMs && <p className="mt-1 text-[10px] text-amber-800">Di luar durasi klip</p>}
      </div>)}
    </Section>
  </div>
}
