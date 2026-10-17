import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  Download,
  ExternalLink,
  Film,
  Image as ImageIcon,
  MoreHorizontal,
  Move,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Volume2
} from 'lucide-react'
import { effectiveResolution, fitDuration, getImageModel, getVideoModel } from '@shared/higgsfield'
import { buildCodexImagePrompt, buildFlowImagePrompt, buildFlowVideoPrompt, buildMapAudioPlan, buildMapPostOverlaySheet, buildMapPublishPack, mapClipImageEligible, mapClipUsesPreviousFrame } from '@shared/external-prompts'
import { isLegacyMapMaster, isMapMaster, isVoxMaster, mapFillMode, mapTargetColor, resolveMasterPrompt } from '@shared/master-prompts'
import { CAMERA_PRESETS, MOTION_STRENGTHS, cameraAt, cameraCss } from '@shared/motion'
import { needsVisual } from '@shared/script'
import type { Asset, Clip, CodexStatus } from '@shared/types'
import { AutoTextarea } from '../../components/AutoTextarea'
import { CharacterAvatar } from '../../components/CharacterAvatar'
import { NarrationVoicePicker } from '../../components/NarrationVoicePicker'
import { VoxWorkflowGuide } from '../../components/VoxWorkflowGuide'
import { ClipVisual } from '../../components/ClipVisual'
import { Badge, Button, Chip, IconButton, Menu, Progress, Segmented, confirmDialog, cx, inputCls } from '../../components/ui'
import { clipNumber, errorText, mmss, secLabel } from '../../lib/format'
import { useNarration } from '../../lib/useNarration'
import { useCodexStatus, useVisualWorkflow } from '../../lib/useVisualWorkflow'
import { useApp } from '../../store/app'
import { isRunning, jobFor, useProject } from '../../store/project'
import { CharacterModal } from './CharacterModal'
import { useFlowWorkflow } from '../../lib/useFlowWorkflow'
import { FlowShotControls } from '../../components/FlowShotControls'
import { buildFlowShotImagePrompt, buildFlowShotVideoPrompt, flowOverlaySheet } from '@shared/flow'

function mapFrameIsCurrent(image: Asset | null | undefined, previous: Clip | undefined, clip: Clip): boolean {
  return !!image && !!previous?.videoAssetId && image.meta?.mapFrameSourceClipId === previous.id
    && image.meta?.mapFrameSourceVideoAssetId === previous.videoAssetId && image.meta?.mapFrameTargetClipId === clip.id
    && image.meta?.mapFrameSourcePlan === previous.videoPrompt && image.meta?.mapFrameTargetPlan === clip.videoPrompt
}

function MapEditingSheet({ title, text, hint, onCopy }: { title: string; text: string; hint: string; onCopy: () => void }) {
  return <details className="rounded-xl border border-line-2 bg-paper p-3">
    <summary className="cursor-pointer text-sm font-semibold">{title}</summary>
    <p className="mb-2 mt-2 text-xs leading-relaxed text-muted">{hint}</p>
    <textarea aria-label={title} readOnly rows={6} value={text} placeholder="Belum tersedia. Susun ulang visual untuk menyiapkan panduan ini." className={cx(inputCls, 'scroll-thin resize-y py-2 font-mono text-xs leading-relaxed')} />
    <Button size="sm" disabled={!text.trim()} icon={<Copy className="size-3.5" />} className="mt-2" onClick={onCopy}>Salin {title}</Button>
  </details>
}

function useAudio(): { play: (url: string) => void; stop: () => void; playing: string | null } {
  const ref = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  useEffect(() => () => ref.current?.pause(), [])
  return {
    playing,
    play: (url) => {
      ref.current?.pause()
      const a = new Audio(url)
      a.onended = () => setPlaying(null)
      ref.current = a
      void a.play()
      setPlaying(url)
    },
    stop: () => {
      ref.current?.pause()
      setPlaying(null)
    }
  }
}

/** Loops the camera move over the clip image, so a picked move is visible right away without rendering. */
function MotionPreview({ image, clip }: { image: Asset; clip: Clip }) {
  const img = useRef<HTMLImageElement>(null)
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const mounted = useRef(false)

  // Picking another move or strength starts the preview again, even after a pause.
  useEffect(() => {
    if (mounted.current) setPlaying(true)
    mounted.current = true
  }, [clip.cameraPreset, clip.motionStrength])

  useEffect(() => {
    const el = img.current
    if (!el) return
    if (!playing) {
      el.style.transform = ''
      return
    }
    const dur = Math.max(1, clip.durationMs / 1000)
    const t0 = performance.now()
    let raf = 0
    const tick = (): void => {
      // One pass of the move, a short hold on its last frame, then again.
      const t = Math.min(((performance.now() - t0) / 1000) % (dur + 0.6), dur)
      el.style.transform = cameraCss(cameraAt(clip.cameraPreset, clip.motionStrength, t / dur, t))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, clip.cameraPreset, clip.motionStrength, clip.durationMs, image.id])

  return (
    <>
      <img ref={img} src={image.url} alt="" draggable={false} className="absolute inset-0 size-full object-cover will-change-transform" />
      <button
        type="button"
        aria-pressed={playing}
        onClick={() => setPlaying(!playing)}
        className="absolute right-2.5 top-2.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-ink/80 px-3 text-xs font-medium text-paper hover:bg-ink"
      >
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        {playing ? 'Jeda pratinjau' : 'Putar pratinjau'}
      </button>
    </>
  )
}

function ClipPanel({ clip, index, total, higgsfield, codexStatus, checkingCodex }: { clip: Clip; index: number; total: number; higgsfield: boolean; codexStatus: CodexStatus | null; checkingCodex: boolean }) {
  const { project, clips, characters, assets, jobs, updateClip, updateProject, removeClip, moveClip, addClip, select, flush, upsertJob } = useProject()
  const { toast } = useApp()
  const audio = useAudio()
  const [editPrompt, setEditPrompt] = useState(false)
  const [importing, setImporting] = useState(false)
  const [startingImage, setStartingImage] = useState(false)
  const [cancelingImage, setCancelingImage] = useState(false)
  const [promptBusy, setPromptBusy] = useState(false)
  const [promptError, setPromptError] = useState('')
  const [takingFrame, setTakingFrame] = useState(false)
  const narration = useNarration()
  const flow = useFlowWorkflow()
  if (!project) return null

  const profile = resolveMasterPrompt(project)
  const map = isMapMaster(project)
  const mapV2 = map && !isLegacyMapMaster(project)
  const continuation = map && (index > 0 || mapClipUsesPreviousFrame(project, clip))
  const previous = index > 0 ? clips[index - 1] : undefined
  const locked = profile?.lockedCamera ?? false
  const universal = profile?.videoMode === 'universal'
  const sourceVideoSeconds = profile?.timing.sourceVideoSeconds

  const image = clip.imageAssetId ? assets[clip.imageAssetId] : null
  const frameCurrent = !!image && (!continuation || mapFrameIsCurrent(image, previous, clip))
  const video = clip.videoAssetId ? assets[clip.videoAssetId] : null
  const voice = clip.audioAssetId ? assets[clip.audioAssetId] : null
  const imageJob = jobFor(jobs, 'image', { clipId: clip.id })
  const imageRunning = isRunning(imageJob)
  const codexReady = !!codexStatus?.available && codexStatus.authenticated && codexStatus.imageGeneration && codexStatus.connections?.image !== false && !checkingCodex
  const videoConnected = !!codexStatus?.available && codexStatus.authenticated && codexStatus.connections?.video === true
  const videoJob = jobFor(jobs, 'video', { clipId: clip.id })
  const versions = Object.values(assets)
    .filter((a) => a.clipId === clip.id && a.kind === 'image')
    .sort((a, b) => a.createdAt - b.createdAt)
  const start = clips.slice(0, index).reduce((n, c) => n + c.durationMs, 0)
  const narrationChanged = !!voice && narration.isStale(clip)

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await flush()
      await fn()
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  const generateImage = async (): Promise<void> => {
    if (continuation) return
    setStartingImage(true)
    try {
      await run(async () => {
        const job = flow ? await window.api.flow.clipImage(clip.id) : higgsfield ? await window.api.generate.clipImage(clip.id) : await window.api.codex.generateClipImage(clip.id)
        upsertJob(job)
      })
    } finally {
      setStartingImage(false)
    }
  }

  const cancelImage = async (): Promise<void> => {
    if (!imageJob || !imageRunning) return
    setCancelingImage(true)
    try { await window.api.generate.cancel(imageJob.id) }
    catch (e) { toast('error', errorText(e)) }
    finally { setCancelingImage(false) }
  }

  const copy = async (text: string, message: string): Promise<void> => {
    await window.api.app.copyText(text)
    toast('success', message)
  }

  const importMedia = async (kind: 'image' | 'video'): Promise<void> => {
    setImporting(true)
    try {
      await run(async () => {
        const asset = kind === 'image'
          ? await window.api.assets.pickClipImage(clip.id)
          : await window.api.assets.pickClipVideo(clip.id)
        if (asset) toast('success', kind === 'image' ? 'Gambar dipasang ke adegan ini.' : 'Video Flow dipasang ke adegan ini.')
      })
    } finally {
      setImporting(false)
    }
  }

  const saveImage = async (): Promise<void> => {
    if (!image || (continuation && !frameCurrent)) return
    await run(async () => {
      const path = await window.api.assets.exportImage(image.id)
      if (path) toast('success', 'Gambar disimpan. Unggah gambar ini di Flow sebagai referensi.')
    })
  }

  const takePreviousFrame = async (): Promise<void> => {
    setTakingFrame(true)
    try {
      await run(async () => {
        const saved = useProject.getState()
        if (saved.saveState !== 'saved') throw new Error(saved.saveError || 'Simpan proyek sebelum mengambil frame sambungan.')
        const bundle = await window.api.media.previousVideoFrame(clip.id)
        const current = useProject.getState()
        if (current.project?.id !== bundle.project.id || !current.clips.some(item => item.id === clip.id)) return
        const savedClip = bundle.clips.find(item => item.id === clip.id)
        const frame = bundle.assets.find(asset => asset.id === savedClip?.imageAssetId)
        if (!frame) throw new Error('Frame sambungan belum tersimpan. Coba ambil ulang frame sebelumnya.')
        current.addAsset(frame)
        current.applyClip(clip.id, { imageAssetId: frame.id })
        toast('success', 'Frame akhir video sebelumnya siap. Simpan gambar ini dan unggah sebagai start frame di Flow.')
      })
    } finally { setTakingFrame(false) }
  }

  const openFlow = async (): Promise<void> => {
    await run(async () => {
      const latest = useProject.getState()
      const freshClip = latest.clips.find((scene) => scene.id === clip.id)
      if (!latest.project || !freshClip) throw new Error('Adegan ini sudah tidak tersedia.')
      await window.api.app.copyText(flow ? buildFlowShotVideoPrompt(latest.project, freshClip, latest.clips, latest.characters) : buildFlowVideoPrompt(latest.project, freshClip, latest.clips))
      await window.api.app.openExternal('https://flow.google.com/')
      toast('success', continuation ? 'Prompt video disalin. Unggah frame akhir video sebelumnya sebagai start frame di Flow.' : 'Prompt video disalin. Unggah gambar dan tempel prompt di Flow.')
    })
  }

  const remove = async (): Promise<void> => {
    const ok = await confirmDialog({
      title: `Hapus klip ${clipNumber(index)}?`,
      body: 'Klip beserta tautan gambar, video, dan suaranya akan dilepas dari storyboard.',
      confirm: 'Hapus klip',
      danger: true
    })
    if (ok) removeClip(clip.id)
  }

  // Capped by window height, so the settings under the fixed preview keep enough room.
  const aspect = project.aspectRatio === '9:16' ? 'aspect-[9/16] h-[min(300px,40vh)] mx-auto' : 'aspect-video h-[min(282px,36vh)] max-w-full mx-auto'

  return (
    <aside className="flex min-h-0 flex-col border-l border-line bg-surface">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line pl-5 pr-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-mono text-xs text-muted">
            Klip {clipNumber(index)} · {mmss(start)} – {mmss(start + clip.durationMs)}
          </span>
          <input
            value={clip.title}
            onChange={(e) => updateClip(clip.id, { title: e.target.value })}
            aria-label="Judul klip"
            className="-ml-1 rounded-md bg-transparent px-1 font-display text-[19px] font-bold outline-none hover:bg-sand focus:bg-sand"
          />
        </div>
        <IconButton label="Klip sebelumnya" size={38} disabled={index === 0} onClick={() => select(clips[index - 1].id)}>
          <ChevronLeft className="size-4" />
        </IconButton>
        <IconButton label="Klip berikutnya" size={38} disabled={index === total - 1} onClick={() => select(clips[index + 1].id)}>
          <ChevronRight className="size-4" />
        </IconButton>
        <Menu
          trigger={(open) => (
            <IconButton label="Opsi klip" size={38} onClick={open}>
              <MoreHorizontal className="size-4" />
            </IconButton>
          )}
          items={[
            { label: 'Geser ke kiri', icon: <ArrowLeft className="size-4" />, run: () => moveClip(clip.id, -1) },
            { label: 'Geser ke kanan', icon: <ArrowRight className="size-4" />, run: () => moveClip(clip.id, 1) },
            { label: 'Tambah klip setelah ini', icon: <Plus className="size-4" />, run: () => addClip(clip.id) },
            { label: 'Hapus klip', icon: <Trash2 className="size-4" />, danger: true, run: () => void remove() }
          ]}
        />
      </div>

      {/* The preview stays put while the settings below it scroll. */}
      <div className="shrink-0 border-b border-line px-5 pb-3.5 pt-4">
        <div className={cx('relative overflow-hidden rounded-xl border-[1.5px] border-ink bg-paper', aspect)}>
          {continuation && !image && !video ? <div className="flex size-full flex-col items-center justify-center gap-3 p-5 text-center"><Film className="size-8 text-muted" /><p className="text-xs leading-relaxed text-ink-2">{previous ? `Frame akhir klip ${clipNumber(index - 1)} menjadi gambar awal klip ini.` : 'Susun ulang visual untuk menetapkan gambar awal pada urutan baru.'}</p></div> : image && !isRunning(imageJob) && clip.motionType === 'camera' ? (
            <MotionPreview image={image} clip={clip} />
          ) : (
            <ClipVisual clip={clip} image={image} video={video} job={imageJob} large playVideo />
          )}
          {!image && !isRunning(imageJob) && !continuation && (
            <div className="absolute inset-x-0 bottom-6 flex justify-center">
              <Button
                size="sm"
                variant="accent"
                icon={flow || higgsfield || codexReady ? <Sparkles className="size-4" /> : <Upload className="size-4" />}
                loading={importing || startingImage}
                onClick={() => void (flow || higgsfield || codexReady ? generateImage() : importMedia('image'))}
              >
                {flow ? 'Generate Flow' : higgsfield || codexReady ? 'Generate' : 'Impor'}
              </Button>
            </div>
          )}
          {versions.length > 1 && (
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-[10px] border border-ink bg-surface/95 p-1.5">
              {versions.slice(-5).map((v, i, arr) => (
                <button
                  key={v.id}
                  type="button"
                  aria-label={`Pakai versi ${versions.length - arr.length + i + 1}`}
                  onClick={() => void window.api.assets.setActive(clip.id, v.id)}
                  className={cx(
                    'h-[26px] w-[44px] overflow-hidden rounded-[5px]',
                    v.id === clip.imageAssetId ? 'border-2 border-accent' : 'border border-line-2 opacity-80 hover:opacity-100'
                  )}
                >
                  <img src={v.url} alt="" className="size-full object-cover" />
                </button>
              ))}
              <span className="px-1 text-xs font-semibold">
                Versi {versions.findIndex((v) => v.id === clip.imageAssetId) + 1}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        {flow && <FlowShotControls clip={clip} />}
        <div className="flex flex-wrap gap-2">
          {continuation && <div className="w-full rounded-xl border border-line-2 bg-paper p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone={frameCurrent ? 'ok' : 'warn'}>{frameCurrent ? 'Frame sambungan siap' : image ? 'Frame perlu diperbarui' : 'Menunggu frame sebelumnya'}</Badge><span className="text-xs text-muted">{previous ? `Mulai dari akhir klip ${clipNumber(index - 1)}` : 'Urutan perlu disusun ulang'}</span></div>
            <p className="mb-3 text-xs leading-relaxed text-ink-2">{flow ? 'Frame akhir video klip sebelumnya akan diambil otomatis saat generate.' : 'Impor video Flow klip sebelumnya, lalu ambil frame akhirnya.'} Gunakan frame ini persis sebagai gambar awal; pertahankan cahaya, warna wilayah, ikon, dan posisi kamera.</p>
            <Button size="sm" icon={<Film className="size-4" />} loading={takingFrame} disabled={!previous?.videoAssetId || takingFrame} onClick={() => void takePreviousFrame()}>Ambil frame akhir klip sebelumnya</Button>
            {!previous?.videoAssetId && <p className="mt-2 text-xs text-muted">Video klip sebelumnya belum diimpor.</p>}
          </div>}
          {higgsfield && image && !continuation && (
            <Button
              size="sm"
              icon={<RefreshCw className="size-4" />}
              loading={imageRunning || startingImage}
              onClick={() => void generateImage()}
            >
              Generate ulang
            </Button>
          )}
          {!higgsfield && !flow && !continuation && (
            <Button
              size="sm"
              variant="accent"
              icon={<Sparkles className="size-4" />}
              loading={startingImage || imageRunning}
              disabled={!codexReady || importing || imageRunning}
              title={codexReady ? 'Buat gambar lewat Codex lokal memakai login dan kuota Codex.' : codexStatus?.message ?? 'Memeriksa koneksi Codex lokal.'}
              onClick={() => void generateImage()}
            >
              {image ? 'Generate ulang Codex' : 'Generate gambar Codex'}
            </Button>
          )}
          {!higgsfield && !flow && !continuation && (
            <Button
              size="sm"
              icon={<Copy className="size-4" />}
              onClick={() => void run(() => copy(buildCodexImagePrompt(project, clip, characters), 'Prompt gambar disalin. Tempel di chat Codex untuk membuat gambar.'))}
            >
              Salin prompt Codex
            </Button>
          )}
          {!continuation && <Button size="sm" icon={<Upload className="size-4" />} loading={importing} disabled={imageRunning || startingImage} onClick={() => void importMedia('image')}>
            {image ? 'Ganti gambar' : 'Impor gambar'}
          </Button>}
          <Button size="sm" icon={<Pencil className="size-4" />} onClick={() => setEditPrompt(!editPrompt)}>
            {editPrompt ? 'Tutup prompt' : 'Edit prompt visual'}
          </Button>
          {imageRunning && (
            <Button size="sm" loading={cancelingImage} onClick={() => void cancelImage()}>Batalkan gambar</Button>
          )}
        </div>

        {imageJob?.status === 'failed' && (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad-ink">{imageJob.error ?? 'Gambar gagal dibuat. Coba lagi atau impor gambar.'}</p>
        )}

        {!higgsfield && !flow && !continuation && (
          <p className="rounded-xl bg-paper px-3 py-2.5 text-xs leading-relaxed text-ink-2">
            Generate gambar Codex memakai login dan kuota Codex lokal, tanpa API key. Gambar hasilnya langsung dipasang ke adegan ini.
            Kamu juga bisa menyalin prompt ke chat Codex, lalu menyimpan dan mengimpor hasilnya. Sertakan lembar karakter yang dipakai.
          </p>
        )}

        <div className="flex flex-col gap-2 rounded-xl border border-line-2 bg-paper p-3">
          <label htmlFor={`flow-prompt-${clip.id}`} className="text-sm font-semibold">Prompt video untuk Flow</label>
          {!higgsfield && <div className="flex flex-wrap items-center gap-2">
            <Badge tone={videoConnected ? 'ok' : 'draft'}>{videoConnected ? 'Prompt video · Codex terhubung' : 'Prompt video · Codex diputus'}</Badge>
            {!universal && <Button size="sm" icon={<Sparkles className="size-3.5" />} loading={promptBusy} disabled={!videoConnected || promptBusy}
              onClick={async () => {
                setPromptBusy(true); setPromptError('')
                try {
                  await flush()
                  const saved = useProject.getState()
                  if (saved.saveState === 'error') throw new Error(saved.saveError || 'Simpan adegan sebelum menyusun prompt video.')
                  const result = await window.api.codex.videoPrompt(clip.id)
                  updateClip(clip.id, { videoPrompt: result.videoPrompt })
                  toast('success', 'Prompt video disusun oleh Codex. Periksa lalu gunakan di Flow.')
                } catch (error) { setPromptError(errorText(error)) }
                finally { setPromptBusy(false) }
              }}>Susun prompt video Codex</Button>}
            {universal && <span className="text-xs text-muted">Prompt universal master dipakai persis.</span>}
          </div>}
          {promptError && <p role="alert" className="text-xs text-bad-ink">{promptError}</p>}
          {universal ? <textarea
            id={`flow-prompt-${clip.id}`}
            readOnly
            rows={4}
            value={profile.stages.video}
            className={cx(inputCls, 'scroll-thin resize-y py-2 text-[13px] leading-relaxed')}
          /> : <AutoTextarea
            id={`flow-prompt-${clip.id}`}
            minRows={3}
            value={clip.videoPrompt}
            disabled={promptBusy}
            onChange={(e) => updateClip(clip.id, { videoPrompt: e.target.value })}
            placeholder="Arahan gerak, misalnya: Gajah Mada mengangkat kepalan tangan, kamera mendekat pelan"
            className={cx(inputCls, 'py-2 text-[13px] leading-relaxed')}
          />}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="accent" icon={<Copy className="size-4" />} onClick={() => void run(() => copy(flow ? buildFlowShotVideoPrompt(project, clip, clips, characters) : buildFlowVideoPrompt(project, clip, clips), continuation ? 'Prompt video disalin. Tempel di Flow bersama frame akhir video sebelumnya.' : 'Prompt video disalin. Tempel di Flow bersama gambar adegan ini.'))}>
              Salin prompt Flow
            </Button>
            <Button size="sm" icon={<ExternalLink className="size-4" />} onClick={() => void openFlow()}>
              Buka Flow + salin prompt
            </Button>
            <Button size="sm" icon={<Download className="size-4" />} disabled={!image || (continuation && !frameCurrent)} onClick={() => void saveImage()}>
              {continuation ? 'Simpan frame sambungan' : 'Simpan gambar'}
            </Button>
            <Button size="sm" icon={<Upload className="size-4" />} loading={importing} onClick={() => void importMedia('video')}>
              {video ? 'Ganti video Flow' : 'Impor video Flow'}
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-ink-2">
            {continuation ? 'Ambil frame akhir klip sebelumnya → simpan frame → unggah ke Flow → tempel prompt → buat video → impor kembali.' : 'Simpan gambar ini → unggah ke Flow → tempel prompt → buat dan unduh video → impor kembali.'}
            {map ? ` Setiap video sumber ${sourceVideoSeconds ?? 8} detik. ${mapV2 ? 'Label, angka, SFX, dan musik memakai panduan editing di bawah; semuanya ditambahkan saat editing.' : 'SFX dan musik di prompt menjadi panduan untuk produksi/editing.'} Suara Flow dimatikan saat ekspor.` : <>{universal ? ` Prompt ini mengikuti master ${profile.name}${sourceVideoSeconds ? `, dengan sumber ${sourceVideoSeconds} detik` : ''}. Pilih bagian yang diperlukan untuk beat di editor.${locked ? ' Kamera terkunci.' : ''}` : ' Pilih durasi yang tersedia di Flow; sesuaikan panjang klip di editor.'} Suara dari Flow dimatikan saat ekspor agar narasi tetap jelas.</>}
          </p>
        </div>

        {mapV2 && <div data-map-editing-sheets className="space-y-2">
          <MapEditingSheet title="Post Overlay Sheet" text={flow ? flowOverlaySheet(project, buildMapPostOverlaySheet(project, clip)) : buildMapPostOverlaySheet(project, clip)} hint="Panduan label, angka, ikon, dan layer untuk editor. Label tidak ikut prompt yang disalin ke Flow. Waktu overlay mode Flow MCP disesuaikan ke sumber 4 detik. Ubah isi bagian POST OVERLAY SHEET pada kolom prompt video untuk menyesuaikannya." onCopy={() => void run(() => copy(flow ? flowOverlaySheet(project, buildMapPostOverlaySheet(project, clip)) : buildMapPostOverlaySheet(project, clip), 'Post Overlay Sheet disalin. Terapkan layer dan waktunya saat editing.'))} />
          <MapEditingSheet title="Audio & SFX" text={buildMapAudioPlan(project, clip)} hint="Narasi, penempatan efek suara, dan musik. Panduan ini tidak otomatis menambahkan SFX atau musik; atur dan selaraskan saat editing." onCopy={() => void run(() => copy(buildMapAudioPlan(project, clip), 'Panduan audio disalin. Selaraskan efek dan musik dengan narasi saat editing.'))} />
        </div>}

        {editPrompt && (
          <AutoTextarea
            minRows={5}
            autoFocus
            value={clip.visualPrompt}
            onChange={(e) => updateClip(clip.id, { visualPrompt: e.target.value })}
            aria-label="Prompt visual"
            placeholder={[
              'Setting: tempat, dunia/planet, era, detail latar',
              'Action: siapa melakukan apa',
              'Wardrobe: Leo - default outfit as on the reference sheet; the teenager - custom for this scene: grey tunic',
              'Framing: medium shot, eye level',
              'Avoid: Earth landscape, aliens'
            ].join('\n')}
            className={cx(inputCls, 'py-2.5 text-[13px] leading-relaxed')}
          />
        )}

        {!map && characters.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Pemeran di klip ini</span>
            <div className="flex flex-wrap gap-1.5">
              {characters.map((c) => {
                const on = clip.characterIds.includes(c.id)
                const sheet = c.sheetAssetId ? assets[c.sheetAssetId] : null
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    title={sheet ? undefined : 'Belum ada lembar karakter'}
                    onClick={() =>
                      updateClip(clip.id, {
                        characterIds: on ? clip.characterIds.filter((x) => x !== c.id) : [...clip.characterIds, c.id]
                      })
                    }
                    className={cx(
                      'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border py-0 pl-1 pr-3 text-[13px] font-medium transition-colors',
                      on ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-surface text-ink hover:border-ink-2'
                    )}
                  >
                    <CharacterAvatar name={c.name} sheetUrl={sheet?.url} size={28} className={on ? 'border-paper/70' : undefined} />
                    {c.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label htmlFor="naskah" className="text-sm font-semibold">
              Naskah narasi
            </label>
            <span className="text-xs text-muted">untuk TTS</span>
            <span className="flex-1" />
            <span className="rounded-md bg-sand px-1.5 py-0.5 font-mono text-xs text-ink-2">
              {voice?.durationMs ? secLabel(voice.durationMs) : 'Belum ada suara'}
            </span>
          </div>
          <NarrationVoicePicker narration={narration} />
          <AutoTextarea
            id="naskah"
            minRows={3}
            value={clip.narration}
            onChange={(e) => updateClip(clip.id, { narration: e.target.value })}
            className={cx(inputCls, 'py-2.5 text-sm leading-relaxed')}
          />
          <div className="flex items-center gap-2">
            {voice && (
              <Button
                size="sm"
                icon={audio.playing === voice.url ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                onClick={() => (audio.playing === voice.url ? audio.stop() : audio.play(voice.url))}
              >
                {audio.playing === voice.url ? 'Hentikan' : 'Putar suara'}
              </Button>
            )}
            {/* Voices come from one take of the whole script (toolbar button), never per scene. */}
            {narration.running ? (
              <span className="text-xs text-sun-ink">Suara narasi sedang dibuat…</span>
            ) : narrationChanged ? (
              <span className="text-xs text-accent-dark">
                Narasi perlu diperbarui.{' '}
                <button type="button" disabled={narration.running || narration.checking} onClick={() => void narration.start()} className="font-semibold underline disabled:opacity-60">
                  Rekam ulang suara narasi
                </button>
              </span>
            ) : (
              !voice && <span className="text-xs text-muted">Suara semua adegan dibuat sekaligus lewat tombol Buat suara narasi di atas.</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 pb-2">
          <span className="text-sm font-semibold">Gerak</span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'camera', title: locked ? 'Gambar diam' : 'Gerak kamera', sub: locked ? 'Kamera terkunci' : 'Gratis · dirender di komputer', icon: <Move className="size-[22px]" />, subCls: 'text-ok-ink' },
                { id: 'video', title: 'Video AI', sub: higgsfield ? 'Higgsfield · pakai kredit' : 'Impor hasil dari Flow', icon: <Film className="size-[22px]" />, subCls: 'text-ink-2' }
              ] as const
            ).map((o) => {
              const on = clip.motionType === o.id
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => updateClip(clip.id, { motionType: o.id, ...(locked ? { cameraPreset: 'static' as const } : {}) })}
                  className={cx(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-left',
                    on ? 'border-2 border-accent bg-accent-soft' : 'border border-line-2 bg-surface hover:border-ink-2'
                  )}
                >
                  {o.icon}
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{o.title}</span>
                    <span className={cx('text-xs', o.subCls)}>{o.sub}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {clip.motionType === 'camera' ? (
            <>
              {locked ? <p className="text-xs leading-relaxed text-ink-2">Master {profile?.name} memakai kamera terkunci. Impor video Flow untuk gerak di dalam adegan.</p> : <>{map && <p className="text-xs leading-relaxed text-ink-2">Pratinjau ini menggerakkan gambar datar. Gerak medan 3D, tilt, dan tracking sesuai master dibuat di Flow.</p>}<div className="flex flex-wrap gap-1.5">
                {CAMERA_PRESETS.map((p) => (
                  <Chip key={p.id} on={clip.cameraPreset === p.id} className="h-8 px-3 text-[13px]" onClick={() => updateClip(clip.id, { cameraPreset: p.id })}>
                    {p.label}
                  </Chip>
                ))}
              </div>
              <Segmented
                size="sm"
                value={clip.motionStrength}
                onChange={(v) => updateClip(clip.id, { motionStrength: v })}
                options={MOTION_STRENGTHS.map((m) => ({ id: m.id, label: m.label }))}
                className="self-start"
              />
              </>}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {higgsfield && !voice && (
                <p className="rounded-lg bg-sun-soft px-2.5 py-1.5 text-xs text-sun-ink">
                  Buat suara narasinya dulu. Panjang klip mengikuti suara, jadi durasi video AI ikut pas.
                </p>
              )}
              {video?.durationMs != null && video.durationMs + 300 < clip.durationMs && (
                <p className="rounded-lg bg-sun-soft px-2.5 py-1.5 text-xs text-sun-ink">
                  Video {secLabel(video.durationMs)}, klip {secLabel(clip.durationMs)}. Sisa {secLabel(clip.durationMs - video.durationMs)} memakai frame
                  terakhir yang diam. Sesuaikan durasi klip di editor atau impor video yang lebih panjang.
                </p>
              )}
              {higgsfield && (
                <div className="flex items-center gap-1.5 text-xs text-ink-2">
                  <Film className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {getVideoModel(project.videoModel).name} · video {fitDuration(getVideoModel(project.videoModel), sourceVideoSeconds ?? clip.durationMs / 1000)} detik
                    {effectiveResolution(getVideoModel(project.videoModel), project.videoResolution) &&
                      ` · ${effectiveResolution(getVideoModel(project.videoModel), project.videoResolution)}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateProject({ step: 1 })}
                    className="shrink-0 font-semibold text-accent-dark hover:underline"
                  >
                    Ganti model
                  </button>
                </div>
              )}
              {higgsfield && !map && <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={video ? 'secondary' : 'accent'}
                  icon={<Clapperboard className="size-4" />}
                  loading={isRunning(videoJob)}
                  disabled={!image}
                  onClick={() => void run(() => window.api.generate.clipVideo(clip.id))}
                >
                  {video ? 'Buat ulang video' : 'Buat video'}
                </Button>
                {!image && <span className="text-xs text-muted">Buat gambar dulu, lalu jadikan video.</span>}
                {isRunning(videoJob) && (
                  <span className="text-xs text-sun-ink">
                    {videoJob!.message ?? 'Memproses'} {Math.round(videoJob!.progress * 100)}%
                  </span>
                )}
                {videoJob?.status === 'failed' && <span className="truncate text-xs text-bad-ink">{videoJob.error}</span>}
              </div>}
            </div>
          )}
        </div>

      </div>
    </aside>
  )
}

export function StoryboardStep() {
  const { project, clips, characters, assets, jobs, selectedClipId, select, addClip, updateProject, flush, load, upsertJob } = useProject()
  const { toast, go } = useApp()
  const higgsfield = useVisualWorkflow()
  const flow = useFlowWorkflow()
  const { status: codexStatus, checking: checkingCodex, refresh: refreshCodex } = useCodexStatus(!higgsfield)
  const codexReady = !!codexStatus?.available && codexStatus.authenticated && codexStatus.imageGeneration && codexStatus.connections?.image !== false
  const narration = useNarration()
  /** A character id, "new" for an unsaved one, or null. */
  const [openChar, setOpenChar] = useState<string | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [videoCredits, setVideoCredits] = useState<number | null>(null)
  const [planning, setPlanning] = useState(false)
  const [startingImages, setStartingImages] = useState(false)
  const [cancelingImages, setCancelingImages] = useState(false)
  const imagesPending = useRef(false)

  useEffect(() => {
    if (!higgsfield || !project) return setCredits(null)
    let active = true
    void window.api.generate.estimate('image', getImageModel(project.imageModel).id, project.aspectRatio)
      .then((e) => { if (active) setCredits(e?.credits ?? null) })
      .catch(() => { if (active) setCredits(null) })
    return () => { active = false }
  }, [higgsfield, project?.id, project?.imageModel, project?.aspectRatio])

  const stats = useMemo(() => {
    const images = project ? clips.filter((c, index) => (!isMapMaster(project) || index === 0) && mapClipImageEligible(project, c)) : clips
    const imgs = images.filter((c) => c.imageAssetId).length
    const voices = clips.filter((c) => c.audioAssetId).length
    const needImg = images.filter((c) => !c.imageAssetId && !isRunning(jobFor(jobs, 'image', { clipId: c.id }))).length
    const imageRunning = clips.filter((c) => isRunning(jobFor(jobs, 'image', { clipId: c.id }))).length
    const videoRunning = clips.filter((c) => isRunning(jobFor(jobs, 'video', { clipId: c.id }))).length
    const needVideo = clips.filter((c) => !c.videoAssetId && !isRunning(jobFor(jobs, 'video', { clipId: c.id })))
    return { imgs, imageTotal: images.length, voices, needImg, imageRunning, videoRunning, needVideo, total: clips.reduce((n, c) => n + c.durationMs, 0) }
  }, [clips, jobs, project])

  // Video length follows each clip's voice, so the cost is estimated per video length and summed.
  const videoLengths = useMemo(() => {
    if (!higgsfield || !project) return ''
    const model = getVideoModel(project.videoModel)
    const seconds = resolveMasterPrompt(project)?.timing.sourceVideoSeconds
    return stats.needVideo.map((c) => fitDuration(model, seconds ?? c.durationMs / 1000) ?? 5).join(',')
  }, [stats.needVideo, project?.videoModel, project?.styleId, project?.skillId, project?.masterPrompt, higgsfield])
  useEffect(() => {
    if (!higgsfield || !project || !videoLengths) return setVideoCredits(null)
    const lengths = videoLengths.split(',').map(Number)
    const unique = [...new Set(lengths)]
    const model = getVideoModel(project.videoModel).id
    let live = true
    void Promise.all(unique.map((s) => window.api.generate.estimate('video', model, project.aspectRatio, s, project.videoResolution))).then((list) => {
      if (!live) return
      if (list.some((e) => e?.credits == null)) return setVideoCredits(null)
      const bySec = new Map(unique.map((s, i) => [s, list[i]!.credits]))
      setVideoCredits(lengths.reduce((n, s) => n + (bySec.get(s) ?? 0), 0))
    }).catch(() => { if (live) setVideoCredits(null) })
    return () => {
      live = false
    }
  }, [higgsfield, videoLengths, project?.videoModel, project?.aspectRatio, project?.videoResolution])

  if (!project) return null
  const vox = isVoxMaster(project)
  const map = isMapMaster(project)
  const mapV2 = map && !isLegacyMapMaster(project)
  const profile = resolveMasterPrompt(project)
  const universal = profile?.videoMode === 'universal'
  const selIndex = Math.max(0, clips.findIndex((c) => c.id === selectedClipId))
  const sel = clips[selIndex]

  const bulk = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await flush()
      const saved = useProject.getState()
      if (saved.saveState !== 'saved') throw new Error(saved.saveError || 'Proyek belum tersimpan. Coba simpan lagi sebelum melanjutkan.')
      await fn()
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  const copyAllFlowImages = async (): Promise<void> => {
    await bulk(async () => {
      const current = useProject.getState()
      if (!current.project || current.project.id !== project.id) return
      const scenes = current.clips.filter((c, index) => (!isMapMaster(current.project!) || index === 0) && mapClipImageEligible(current.project!, c))
      if (!scenes.length) throw new Error('Susun ulang visual untuk menetapkan gambar awal pada urutan klip terbaru.')
      const text = scenes.map((c) => flow ? buildFlowShotImagePrompt(current.project!, c, current.characters) : buildFlowImagePrompt(current.project!, c, current.characters)).join('\n\n\n')
      await window.api.app.copyText(text)
      toast('success', isMapMaster(current.project) ? 'Prompt gambar awal disalin. Klip berikutnya memakai frame akhir video sebelumnya.' : `${scenes.length} prompt gambar disalin sesuai urutan adegan. Gunakan di Flow bersama lembar karakter yang sesuai.`)
    })
  }
  const copyPublishPack = async (): Promise<void> => {
    await bulk(async () => {
      const current = useProject.getState()
      if (!current.project || current.project.id !== project.id) return
      const text = buildMapPublishPack(current.project, current.clips)
      if (!text.trim()) throw new Error('Publish Pack belum tersedia. Susun ulang visual untuk menyiapkan judul, caption, dan hashtag.')
      await window.api.app.copyText(text)
      toast('success', 'Publish Pack disalin. Tinjau judul, caption, dan hashtag sebelum digunakan.')
    })
  }
  const makeAllCodexImages = async (): Promise<void> => {
    if (imagesPending.current) return
    imagesPending.current = true
    setStartingImages(true)
    try {
      await bulk(async () => {
        const queued = await window.api.codex.missingImages(project.id)
        queued.forEach(upsertJob)
        toast('success', queued.length ? `${queued.length} gambar masuk antrean. Gambar yang sudah siap tetap dipakai.` : 'Semua gambar sudah siap atau sedang dalam antrean.')
      })
    } finally {
      imagesPending.current = false
      setStartingImages(false)
    }
  }
  const cancelImageQueue = async (): Promise<void> => {
    setCancelingImages(true)
    try {
      const active = Object.values(useProject.getState().jobs).filter((j) => j.projectId === project.id && j.provider === 'codex' && j.kind === 'image' && isRunning(j))
      await Promise.all(active.map((j) => window.api.generate.cancel(j.id)))
      toast('success', 'Antrean gambar dihentikan. Gambar yang sudah selesai tetap tersimpan.')
    } catch (e) {
      toast('error', errorText(e))
    } finally {
      setCancelingImages(false)
    }
  }
  const copyFlowPrompts = async (scene?: Clip): Promise<void> => {
    await bulk(async () => {
      const current = useProject.getState()
      if (!current.project || current.project.id !== project.id) return
      const mapNow = isMapMaster(current.project)
      const pending = scene ? current.clips.filter((c) => c.id === scene.id) : current.clips.filter((c) => (mapNow || c.imageAssetId) && !c.videoAssetId)
      const universalNow = resolveMasterPrompt(current.project)?.videoMode === 'universal'
      const universalClip = pending[0] ?? current.clips[0]
      if (scene && !pending.length) throw new Error('Klip ini sudah dihapus.')
      const text = universalNow && universalClip ? flow ? buildFlowShotVideoPrompt(current.project, universalClip, current.clips, current.characters) : buildFlowVideoPrompt(current.project, universalClip, current.clips)
        : pending.map((c) => `ADEGAN ${clipNumber(current.clips.indexOf(c))} — ${c.title || 'Tanpa judul'}\n${flow ? buildFlowShotVideoPrompt(current.project!, c, current.clips, current.characters) : buildFlowVideoPrompt(current.project!, c, current.clips)}`).join('\n\n---\n\n')
      await window.api.app.copyText(text)
      toast('success', mapNow ? `${pending.length} prompt video peta disalin. Buat berurutan; mulai klip berikutnya dengan frame akhir klip sebelumnya.` : universalNow ? 'Prompt universal master disalin. Gunakan bersama setiap gambar di Flow.' : scene ? 'Prompt video disalin untuk Flow.' : `${pending.length} prompt Flow disalin. Gunakan satu prompt dengan gambar adegan yang sesuai.`)
    })
  }
  const copyCardPrompt = async (clipId: string, kind: 'image' | 'video'): Promise<void> => {
    await bulk(async () => {
      const current = useProject.getState()
      if (!current.project || current.project.id !== project.id) return
      const clip = current.clips.find((c) => c.id === clipId)
      if (!clip) throw new Error('Klip ini sudah dihapus.')
      if (kind === 'image' && (!mapClipImageEligible(current.project, clip) || (isMapMaster(current.project) && current.clips.indexOf(clip) !== 0))) throw new Error('Klip lanjutan memakai frame akhir video sebelumnya, bukan prompt gambar baru.')
      const text = kind === 'image' ? flow ? buildFlowShotImagePrompt(current.project, clip, current.characters) : buildFlowImagePrompt(current.project, clip, current.characters)
        : flow ? buildFlowShotVideoPrompt(current.project, clip, current.clips, current.characters) : buildFlowVideoPrompt(current.project, clip, current.clips)
      await window.api.app.copyText(text)
      toast('success', kind === 'image' ? 'Prompt gambar disalin. Tempel di Flow bersama referensi yang sesuai.' : mapClipUsesPreviousFrame(current.project, clip) ? 'Prompt video disalin. Gunakan frame akhir video sebelumnya sebagai start frame di Flow.' : 'Prompt video disalin. Tempel di Flow bersama gambar klip ini.')
    })
  }
  const deleteCard = async (clipId: string): Promise<void> => {
    const current = useProject.getState()
    const clip = current.clips.find((c) => c.id === clipId)
    if (!clip || current.project?.id !== project.id) return
    const confirmed = await confirmDialog({
      title: 'Hapus klip ini?',
      body: `“${clip.title || 'Tanpa judul'}” beserta naskah dan media di adegan ini akan dihapus dari proyek.`,
      confirm: 'Hapus klip', danger: true
    })
    if (!confirmed) return
    await bulk(async () => {
      const saved = useProject.getState()
      if (saved.project?.id !== project.id || !saved.clips.some((c) => c.id === clipId)) return
      saved.removeClip(clipId)
      await saved.flush()
      const result = useProject.getState()
      if (result.saveState !== 'saved') throw new Error(result.saveError || 'Penghapusan klip belum tersimpan. Coba simpan lagi.')
      toast('success', map ? 'Klip dihapus. Susun ulang visual untuk memperbarui sambungan peta.' : 'Klip dihapus dari proyek.')
    })
  }
  const flowPending = clips.filter((c) => (map || c.imageAssetId) && !c.videoAssetId).length
  // Videos are made last: every clip has its picture, and the voice is final so each video matches its clip length.
  const readyForVideo =
    clips.length > 0 &&
    clips.every((c) => c.imageAssetId) &&
    narration.voiced > 0 &&
    narration.stale === 0 &&
    !narration.running
  const makeVideos = async (): Promise<void> => {
    const n = stats.needVideo.length
    const ok = await confirmDialog({
      title: `Jadikan ${n} klip video AI?`,
      body:
        `Setiap gambar klip dianimasikan dengan ${getVideoModel(project!.videoModel).name}, ${profile?.timing.sourceVideoSeconds ? `sebagai sumber ${profile.timing.sourceVideoSeconds} detik sesuai master.` : 'panjangnya mengikuti suara narasi klip itu.'}` +
        (videoCredits != null ? ` Perkiraan biaya ${Math.round(videoCredits * 10) / 10} kredit Higgsfield.` : '') +
        ' Klip yang sudah punya video tidak dibuat ulang.',
      confirm: `Buat ${n} video`
    })
    if (ok) await bulk(() => window.api.generate.missingVideos(project!.id))
  }

  // Scenes added or rewritten in the script since the last visual plan.
  const stale = clips.filter(needsVisual).length
  const planVisuals = async (): Promise<void> => {
    setPlanning(true)
    try {
      await flush()
      load(await window.api.story.visuals(project.id, 'missing'))
      toast('success', 'Visual adegan sudah disusun.')
    } catch (e) {
      toast('error', errorText(e))
    } finally {
      setPlanning(false)
    }
  }

  if (!clips.length)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <h2 className="font-display text-3xl font-bold">Storyboard masih kosong</h2>
        <p className="max-w-md text-ink-2">Tulis naskahnya dulu di langkah Naskah, lalu buat visual tiap adegan. Kamu juga bisa menambah klip sendiri.</p>
        <div className="flex gap-2.5">
          <Button onClick={() => updateProject({ step: 2 })}>Ke Naskah</Button>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => addClip(null)}>
            Tambah klip
          </Button>
        </div>
      </div>
    )

  return (
    <div className="grid h-full grid-rows-[64px_minmax(0,1fr)_80px]">
      <div className="scroll-thin flex items-center gap-2 overflow-x-auto border-b border-line bg-paper px-6">
        <span className="mr-1 text-[13px] font-semibold text-ink-2">{map ? 'Peta berantai' : 'Pemeran'}</span>
        {!map && <div className="scroll-thin flex min-w-[150px] max-w-[38%] gap-2 overflow-x-auto py-1">
          {characters.map((c) => {
            const sheet = c.sheetAssetId ? assets[c.sheetAssetId] : null
            const running = isRunning(jobFor(jobs, 'sheet', { characterId: c.id }))
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenChar(c.id)}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line-2 bg-surface py-0 pl-1 pr-3 text-[13px] font-medium hover:border-ink-2"
              >
                <CharacterAvatar name={c.name} sheetUrl={sheet?.url} size={32} busy={running} />
                {c.name}
                {!sheet && !running && <span className="size-1.5 rounded-full bg-accent" title="Belum ada lembar karakter" />}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setOpenChar('new')}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line-3 px-3.5 text-[13px] font-medium text-ink-2 hover:border-ink-2"
          >
            <Plus className="size-[15px]" />
            Tambah pemeran
          </button>
        </div>}
        <div className="flex-1" />
        <Button
          icon={<Volume2 className="size-[17px]" />}
          loading={narration.running}
          disabled={narration.running || narration.checking || !clips.some((c) => c.narration.trim())}
          title="Narasi semua adegan direkam dalam satu kali jalan lalu dipotong per adegan, supaya suara dan intonasinya konsisten."
          onClick={() => void narration.start()}
        >
          {narration.running
            ? `${narration.message ?? 'Membuat suara'} ${Math.round(narration.progress * 100)}%`
            : narration.voiced === 0
              ? 'Buat suara narasi'
              : narration.stale
                ? `Perbarui suara narasi (${narration.stale})`
                : 'Rekam ulang suara narasi'}
        </Button>
        <Button
          icon={<Copy className="size-[17px]" />}
          disabled={!clips.length}
          title={map ? 'Hanya klip pertama memiliki prompt gambar. Klip berikutnya memakai frame akhir video sebelumnya.' : 'Salin prompt gambar seluruh adegan, termasuk gambar yang sudah siap, untuk dibuat di Google Flow.'}
          onClick={() => void copyAllFlowImages()}
        >
          {map ? 'Salin prompt gambar awal Flow' : 'Salin semua prompt gambar Flow'}
        </Button>
        {!higgsfield && !flow && codexReady && <Button
          variant="accent"
          icon={<Sparkles className="size-[17px]" />}
          loading={startingImages}
          disabled={!stats.needImg}
          title={map ? 'Buat gambar awal klip pertama. Klip berikutnya memakai frame akhir video sebelumnya.' : 'Buat semua gambar yang belum siap menggunakan koneksi gambar Codex. Antrean berjalan satu per satu.'}
          onClick={() => void makeAllCodexImages()}
        >
          {map ? 'Generate gambar awal' : 'Generate semua gambar'}{stats.needImg > 0 ? ` (${stats.needImg})` : ''}
        </Button>}
        {!higgsfield && stats.imageRunning > 0 && <Button
          size="sm"
          loading={cancelingImages}
          onClick={() => void cancelImageQueue()}
        >
          Batalkan antrean ({stats.imageRunning})
        </Button>}
        {higgsfield && <Button
          className="border-[1.5px] border-ink font-semibold"
          icon={<ImageIcon className="size-[17px]" />}
          disabled={!stats.needImg}
          onClick={() => void bulk(() => window.api.generate.missingImages(project.id))}
        >
          {map ? 'Generate gambar awal' : `Generate ${stats.needImg} gambar`}
          {credits != null && stats.needImg > 0 && (
            <span className="font-normal text-ink-2">≈ {Math.round(credits * stats.needImg * 10) / 10} kr</span>
          )}
        </Button>}
        {(!higgsfield || map) && <Menu
          trigger={(open) => <IconButton label="Opsi visual" onClick={open}><MoreHorizontal className="size-[18px]" /></IconButton>}
          items={[
            { label: 'Atur koneksi gambar', icon: <ImageIcon className="size-4" />, run: () => void bulk(async () => go({ name: 'settings', back: { name: 'project', id: project.id } })) },
            { label: checkingCodex ? 'Memeriksa koneksi…' : 'Cek koneksi gambar', icon: <RefreshCw className="size-4" />, run: refreshCodex },
            ...(universal || flowPending > 0 ? [{ label: universal ? 'Salin prompt video universal' : 'Salin prompt video Flow', icon: <Copy className="size-4" />, run: () => void copyFlowPrompts() }] : [])
          ]}
        />}
        {higgsfield && !map && readyForVideo && (
          <Button
            variant="primary"
            icon={<Clapperboard className="size-[17px]" />}
            loading={stats.videoRunning > 0}
            disabled={stats.videoRunning > 0 || stats.needVideo.length === 0}
            title="Semua gambar dan suara narasi sudah siap. Setiap klip dijadikan video AI sepanjang suaranya."
            onClick={() => void makeVideos()}
          >
            {stats.videoRunning > 0
              ? `Membuat ${stats.videoRunning} video`
              : stats.needVideo.length === 0
                ? 'Semua klip sudah video'
                : `Jadikan ${stats.needVideo.length} video`}
            {stats.videoRunning === 0 && videoCredits != null && stats.needVideo.length > 0 && (
              <span className="font-normal text-white/80">≈ {Math.round(videoCredits * 10) / 10} kr</span>
            )}
          </Button>
        )}
      </div>

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_540px]">
        <section className="scroll-thin @container flex min-h-0 flex-col gap-3.5 overflow-y-auto px-6 pb-6 pt-[18px]">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold">Storyboard</h1>
            <span className="text-sm text-muted">
              {clips.length} klip · {mmss(stats.total)}
            </span>
            <div className="flex-1" />
            <Button variant="ghost" icon={<Plus className="size-[17px]" />} onClick={() => addClip(sel?.id ?? null)}>
              Tambah klip
            </Button>
          </div>
          {(vox || universal) && <VoxWorkflowGuide
            project={project}
            exportDisabled={stale > 0}
            onExport={() => void bulk(async () => {
              const path = await window.api.story.exportImagePrompts(project.id)
              if (path) toast('success', 'File prompt gambar berhasil disimpan.')
            })}
          />}
          {flow && <FlowShotControls />}
          {map && <div data-map-workflow className="rounded-2xl border border-line-2 bg-surface p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone="ok">Map Animation{mapV2 ? ' · Territory Highlight' : ' · v1'}</Badge><span className="text-xs font-semibold text-ink-2">{profile?.timing.sceneCount ?? 4} adegan · video sumber {profile?.timing.sourceVideoSeconds ?? 8} detik</span></div>
            <p className="text-sm font-semibold">Satu peta, sambungan frame yang utuh.</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-2">Buat gambar awal klip 01 → generate video di Flow → impor video → pilih klip berikutnya → ambil frame akhir → unggah frame tersebut ke Flow. Ulangi sampai payoff. Hanya klip pertama memiliki prompt gambar.</p>
            {mapV2 ? <>
              <p className="mt-2 text-xs leading-relaxed text-ink-2">Basemap natural redup dalam siang terang tanpa haze. Bidang target semi-transparan {mapTargetColor(project) === 'rose' ? 'rose red' : 'orange'} dengan garis putih tegas; tanpa neon atau glow. Warna wilayah dan desain ikon sticker konsisten. Recipe A untuk skala/ukuran, Recipe B untuk wilayah/sub-region.</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">{mapFillMode(project) === 'post' ? 'Mode POST: peta hasil generator tidak berisi fill atau garis wilayah. Tambahkan keduanya dari data vektor saat editing sesuai Post Overlay Sheet.' : 'Mode GENERATED: fill dan garis wilayah dibuat bersama peta. Jika batas terdistorsi, buat salinan master dan pilih mode POST.'} Semua label dan angka ditambahkan saat editing, dengan area aman x 10–90% dan y 10–80%.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2"><Button size="sm" icon={<Copy className="size-3.5" />} disabled={stale > 0 || !buildMapPublishPack(project, clips).trim()} onClick={() => void copyPublishPack()}>Salin Publish Pack</Button><span className="text-xs text-muted">Judul, caption, 5 hashtag, dan 3 caption layar. Tinjau sebelum digunakan.</span></div>
            </> : <p className="mt-2 text-xs leading-relaxed text-muted">Master v1: siang terang, warna neon dan ikon konsisten. Teks/caption ditambahkan saat editing.</p>}
            <p className="mt-2 text-xs leading-relaxed text-muted">Gerak dibagi 0–2, 2–5, dan 5–8 detik. Setelah menghapus atau mengurutkan klip, susun ulang visual dan ambil kembali frame sambungannya. SFX, musik, dan overlay adalah panduan untuk editor, belum diterapkan otomatis.</p>
          </div>}
          {stale > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-sun bg-sun-soft px-4 py-3 text-sm text-sun-ink">
              <Sparkles className="size-[18px] shrink-0" />
              <span className="flex-1">
                {stale} adegan belum punya visual dari naskah terbaru. Buat visualnya dulu supaya gambar sesuai dengan alur cerita.
              </span>
              <Button size="sm" variant="secondary" loading={planning} onClick={() => void planVisuals()}>
                Buat visual
              </Button>
            </div>
          )}
          <div data-storyboard-grid className="grid grid-cols-1 gap-3.5 @[420px]:grid-cols-2 @[660px]:grid-cols-3 @[900px]:grid-cols-4 @[1160px]:grid-cols-5">
            {clips.map((c, i) => {
              const on = c.id === sel?.id
              const imageJob = jobFor(jobs, 'image', { clipId: c.id })
              const ttsRunning = isRunning(jobFor(jobs, 'tts', { clipId: c.id }))
              const continuation = map && (i > 0 || mapClipUsesPreviousFrame(project, c))
              const frameCurrent = continuation && mapFrameIsCurrent(c.imageAssetId ? assets[c.imageAssetId] : null, clips[i - 1], c)
              const status = continuation ? frameCurrent ? { label: 'Frame siap', tone: 'ok' as const } : { label: c.imageAssetId ? 'Frame usang' : 'Frame sebelumnya', tone: 'warn' as const }
                : c.imageAssetId ? { label: 'Siap', tone: 'ok' as const } : isRunning(imageJob) ? { label: 'Proses', tone: 'warn' as const } : imageJob?.status === 'failed' ? { label: 'Gagal', tone: 'bad' as const } : { label: 'Draf', tone: 'draft' as const }
              return (
                <div
                  key={c.id}
                  data-storyboard-card={c.id}
                  className={cx(
                    'flex min-w-0 flex-col overflow-hidden rounded-[14px] bg-surface text-left',
                    on ? 'border-2 border-accent shadow-ink-md' : 'border border-line hover:border-line-3'
                  )}
                >
                  <button type="button" aria-pressed={on} onClick={() => select(c.id)} className="flex w-full flex-col text-left">
                  <div data-storyboard-thumbnail className="relative h-[220px] w-full shrink-0 overflow-hidden border-b border-line bg-paper [&_img]:object-contain [&_video]:object-contain">
                    {continuation && !c.imageAssetId && !c.videoAssetId ? <div className="flex size-full flex-col items-center justify-center gap-2 p-5 text-center"><Film className="size-6 text-muted" /><p className="text-xs leading-relaxed text-ink-2">{i > 0 ? `Gunakan frame akhir klip ${clipNumber(i - 1)}` : 'Susun ulang visual'}</p></div> : <ClipVisual
                      clip={c}
                      image={c.imageAssetId ? assets[c.imageAssetId] : null}
                      video={c.videoAssetId ? assets[c.videoAssetId] : null}
                      job={imageJob}
                    />}
                    <span className="absolute left-2 top-2 rounded-md bg-ink px-[7px] py-0.5 font-mono text-xs text-paper">{clipNumber(i)}</span>
                    {c.motionType === 'video' && (
                      <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-md bg-ink text-paper" title="Video AI">
                        <Film className="size-3.5" />
                      </span>
                    )}
                    <span className="absolute bottom-2 right-2 rounded-md border border-ink bg-surface px-[7px] py-px font-mono text-xs">
                      {mmss(c.durationMs)}
                    </span>
                  </div>
                  <div className="flex w-full flex-col gap-2 px-3 pb-3 pt-2.5">
                    <span className="truncate text-sm font-semibold">{c.title || 'Tanpa judul'}</span>
                    <div className="flex items-center gap-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span className={cx('inline-flex items-center gap-1 text-xs', c.audioAssetId ? 'text-ok-ink' : 'text-muted')}>
                        <Volume2 className="size-3.5" />
                        {ttsRunning ? 'Membuat suara…' : c.audioAssetId ? 'Suara siap' : 'Belum ada suara'}
                      </span>
                    </div>
                  </div>
                  </button>
                  <div className="grid gap-1 border-t border-line p-2">
                    {!continuation && <button type="button" aria-label={`Salin prompt gambar klip ${clipNumber(i)}`} onClick={() => void copyCardPrompt(c.id, 'image')}
                      className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-ink-2 hover:bg-accent-soft hover:text-accent-dark">
                      <Copy className="size-3.5 shrink-0" /> Salin prompt gambar
                    </button>}
                    <button type="button" aria-label={`Salin prompt video klip ${clipNumber(i)}`} onClick={() => void copyCardPrompt(c.id, 'video')}
                      className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-ink-2 hover:bg-accent-soft hover:text-accent-dark">
                      <Copy className="size-3.5 shrink-0" /> Salin prompt video
                    </button>
                    <button type="button" aria-label={`Hapus klip ${clipNumber(i)}`} onClick={() => void deleteCard(c.id)}
                      className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-bad-ink hover:bg-bad-soft">
                      <Trash2 className="size-3.5 shrink-0" /> Hapus klip
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
        {sel && <ClipPanel key={sel.id} clip={sel} index={selIndex} total={clips.length} higgsfield={higgsfield} codexStatus={codexStatus} checkingCodex={checkingCodex} />}
      </div>

      <footer className="flex items-center gap-4 border-t border-line bg-surface px-6">
        <div className="flex w-[320px] flex-col gap-1.5">
          <div className="flex justify-between text-[13px]">
            <span className="font-semibold">
              {stats.imgs} dari {stats.imageTotal} {map ? 'gambar awal' : 'gambar'} siap
            </span>
            <span className="text-muted">
              {stats.voices} dari {clips.length} suara siap
            </span>
          </div>
          <Progress value={clips.length ? (stats.imgs + stats.voices) / (stats.imageTotal + clips.length) : 0} />
        </div>
        <span className="text-[13px] text-muted">Klip yang belum siap tetap bisa dibuka di editor.</span>
        <div className="flex-1" />
        <Button size="lg" onClick={() => updateProject({ step: 2 })}>
          Kembali ke naskah
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="h-[50px]"
          onClick={() => updateProject({ step: 4, status: project.status === 'exported' ? 'exported' : 'editing' })}
        >
          Lanjut ke editor
          <ArrowRight className="size-[18px]" />
        </Button>
      </footer>
      <CharacterModal characterId={openChar} onClose={() => setOpenChar(null)} onCreated={(id) => setOpenChar(id)} />
    </div>
  )
}
