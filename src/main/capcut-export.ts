import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { copyFileSync, mkdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import ffmpegStatic from 'ffmpeg-static'
import { buildMapAudioPlan, buildMapPostOverlaySheet, buildMapPublishPack } from '@shared/external-prompts'
import { flowOverlaySheet } from '@shared/flow'
import type { Asset, Job } from '@shared/types'
import { runJob } from './jobs'
import { assetAbsPath, binPath, projectsRoot } from './paths'
import { getBundle, insertJob } from './repo'
import { assertCurrentVoiceover, syncVoiceover } from './voiceover-sync'
import { cutoutImageSources, renderCutoutSegment } from './cutout-renderer'
import { projectSoundEffects, soundEffectFilter } from './sfx'

function managedAsset(asset: Asset): string {
  const root = realpathSync(join(projectsRoot(), asset.projectId)), file = realpathSync(assetAbsPath(asset.projectId, asset.localPath))
  const rel = relative(root, file)
  if (!rel || rel.startsWith('..' + sep) || rel === '..' || isAbsolute(rel) || !statSync(file).isFile()) throw new Error('Lokasi media proyek tidak valid.')
  return file
}
const time = (ms: number): string => {
  const value = Math.round(ms), hours = Math.floor(value / 3600000), minutes = Math.floor(value / 60000) % 60, seconds = Math.floor(value / 1000) % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(value % 1000).padStart(3, '0')}`
}
const csv = (value: unknown): string => '"' + String(value ?? '').replaceAll('"', '""') + '"'
function encode(args: string[], signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  return new Promise((yes, no) => {
    execFile(binPath(ffmpegStatic!), ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', ...args],
      { windowsHide: true, signal, timeout: 180000, maxBuffer: 1024 * 1024 }, (error, _out, stderr) => error ? no(new Error('Shot untuk CapCut belum bisa disiapkan. ' + String(stderr).slice(-500))) : yes())
  })
}

/** Portable editable media kit, not an unsupported CapCut draft format. */
export function startCapcutExport(projectId: string, folder: string): Job {
  if (!isAbsolute(folder)) throw new Error('Pilih folder ekspor absolut melalui dialog folder.')
  let bundle = getBundle(projectId), clips = [...bundle.clips].sort((a, b) => a.sort - b.sort)
  if (!clips.length) throw new Error('Belum ada adegan untuk diekspor.')
  const media = (id: string | null): Asset | undefined => bundle.assets.find(asset => asset.id === id)
  if (clips.some(clip => !clip.cutout?.enabled && !media(clip.motionType === 'video' ? clip.videoAssetId : clip.imageAssetId))) throw new Error('Lengkapi media aktif setiap adegan sebelum mengekspor ke CapCut.')
  for (const clip of clips) if (clip.cutout?.enabled) cutoutImageSources(bundle, clip.cutout)
  const job = insertJob({ projectId, kind: 'export', provider: 'capcut', payload: { folder } })
  return runJob(job, 'export', async ctx => {
    bundle = await syncVoiceover(projectId); clips = [...bundle.clips].sort((a, b) => a.sort - b.sort)
    assertCurrentVoiceover(bundle)
    const effects = projectSoundEffects(bundle, clips.reduce((total, clip) => total + clip.durationMs, 0))
    const slug = bundle.project.title.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 50) || 'Naraflow'
    const output = resolve(folder, `${slug}-CapCut-${randomUUID().slice(0, 8)}`)
    if (dirname(output) !== resolve(folder)) throw new Error('Lokasi ekspor tidak valid.')
    mkdirSync(output, { recursive: true })
    for (const child of ['shots', 'originals', 'audio', 'characters', 'editing', 'overlays', 'cutout', 'sfx']) mkdirSync(join(output, child))
    writeFileSync(join(output, 'BELUM-SELESAI.txt'), 'Ekspor belum selesai; gunakan paket setelah pekerjaan selesai di Naraflow.\n')
    const rows: Record<string, unknown>[] = [], captions: string[] = [], audioFiles: string[] = []
    const [width, height] = bundle.project.aspectRatio === '9:16' ? [720, 1280] : [1280, 720]
    let elapsed = 0
    for (const [index, clip] of clips.entries()) {
      ctx.signal.throwIfAborted()
      if (!Number.isFinite(clip.durationMs) || clip.durationMs <= 0) throw new Error('Durasi adegan tidak valid.')
      const id = String(index + 1).padStart(4, '0'), active = media(clip.motionType === 'video' ? clip.videoAssetId : clip.imageAssetId)
      const shot = `shots/${id}.mp4`
      let original: string | null = null, composition: string | null = null
      if (clip.cutout?.enabled) {
        const sources = cutoutImageSources(bundle, clip.cutout)
        const copied: { assetId: string; file: string }[] = []
        mkdirSync(join(output, 'cutout', id))
        for (const [assetIndex, source] of sources.entries()) {
          const file = `cutout/${id}/${String(assetIndex + 1).padStart(3, '0')}${extname(source.path)}`
          copyFileSync(source.path, join(output, file)); copied.push({ assetId: source.id, file })
        }
        composition = `cutout/${id}/composition.json`
        writeFileSync(join(output, composition), JSON.stringify({ format: 'Naraflow Cutout v1', durationMs: clip.durationMs, width, height, fps: 30, scene: clip.cutout, assets: copied }, null, 2))
        await renderCutoutSegment({ scene: clip.cutout, images: sources, width, height, fps: 30, durationMs: clip.durationMs,
          outputPath: join(output, shot), ffmpegPath: binPath(ffmpegStatic!), signal: ctx.signal,
          onProgress: fraction => ctx.progress((index + fraction) / clips.length * 0.85, `Merender layer Cutout ${index + 1}/${clips.length}`) })
      } else {
        if (!active) throw new Error(`Media adegan ${index + 1} hilang. Pilih ulang sebelum ekspor.`)
        original = `originals/${id}${extname(active.localPath)}`
        const source = managedAsset(active)
        copyFileSync(source, join(output, original))
        const image = active.kind === 'image'
        const input = image ? ['-loop', '1', '-framerate', '30', '-i', source] : ['-i', source]
        const filters = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1${image ? '' : ',tpad=stop_mode=clone:stop_duration=' + clip.durationMs / 1000}`
        await encode([...input, '-vf', filters, '-t', String(clip.durationMs / 1000), '-frames:v', String(Math.max(1, Math.round(clip.durationMs * 30 / 1000))), '-r', '30', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(output, shot)], ctx.signal)
      }
      const voice = media(clip.audioAssetId), audio = `audio/${id}.wav`
      if (voice) copyFileSync(managedAsset(voice), join(output, `originals/${id}-voice${extname(voice.localPath)}`))
      await encode(voice ? ['-i', managedAsset(voice), '-af', `apad,atrim=duration=${clip.durationMs / 1000}`, '-ar', '48000', '-ac', '2', join(output, audio)]
        : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', String(clip.durationMs / 1000), join(output, audio)], ctx.signal)
      audioFiles.push(audio)
      const narration = clip.narration.replace(/<[^<>]+>/g, '').trim()
      if (narration) captions.push(`${captions.length + 1}\n${time(elapsed)} --> ${time(elapsed + clip.durationMs)}\n${narration}\n`)
      rows.push({ shot: id, title: clip.title, startMs: elapsed, endMs: elapsed + clip.durationMs, durationMs: clip.durationMs, media: shot, original,
        voice: voice ? audio : null, narration, transition: clip.transition, camera: clip.cameraPreset, characterIds: clip.characterIds,
        cutout: composition ? { baked: true, composition } : null })
      const overlays = buildMapPostOverlaySheet(bundle.project, clip)
      writeFileSync(join(output, `editing/${id}-prompts.txt`), `IMAGE\n${clip.visualPrompt}\n\nVIDEO\n${active?.provider === 'flow-mcp' ? active.prompt : clip.videoPrompt}\n\nOVERLAYS\n${active?.meta.flowShot ? flowOverlaySheet(bundle.project, overlays) : overlays}\n\nAUDIO\n${buildMapAudioPlan(bundle.project, clip)}`)
      elapsed += clip.durationMs
      ctx.progress((index + 1) / clips.length * 0.85, `Menyiapkan shot ${index + 1}/${clips.length}`)
    }
    writeFileSync(join(output, 'audio/concat.txt'), audioFiles.map(file => `file '${basename(file)}'`).join('\n'))
    await encode(['-f', 'concat', '-safe', '1', '-i', join(output, 'audio/concat.txt'), '-c:a', 'pcm_s16le', join(output, 'narasi.wav')], ctx.signal)
    for (const character of bundle.characters) {
      const sheet = media(character.sheetAssetId)
      if (sheet) copyFileSync(managedAsset(sheet), join(output, 'characters', character.id + extname(sheet.localPath)))
    }
    const music = media(bundle.project.editor.musicAssetId)
    if (music) copyFileSync(managedAsset(music), join(output, 'musik' + extname(music.localPath)))
    const sfxRows: Record<string, unknown>[] = []
    for (const [index, effect] of effects.entries()) {
      ctx.signal.throwIfAborted()
      const id = String(index + 1).padStart(3, '0'), original = `sfx/${id}-original${extname(effect.path)}`, processed = `sfx/${id}.wav`
      copyFileSync(effect.path, join(output, original))
      await encode(['-i', effect.path, '-af', soundEffectFilter(effect.cue, effect.durationMs, false), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', join(output, processed)], ctx.signal)
      sfxRows.push({ ...effect.cue, effectiveDurationMs: effect.durationMs, original, processed, processedOffsetMs: 0, processedVolumeDb: 0, processedFadesBaked: true })
    }
    writeFileSync(join(output, 'sfx/timeline.json'), JSON.stringify({ format: 'Naraflow SFX v1', timeline: 'absolute project milliseconds', cues: sfxRows }, null, 2))
    const overlays = bundle.project.editor.overlays.map(overlay => {
      if (overlay.kind !== 'image') return overlay
      const image = media(overlay.assetId)
      if (!image) throw new Error('Gambar overlay tidak ditemukan. Periksa logo/layer sebelum ekspor.')
      const file = `overlays/${randomUUID()}${extname(image.localPath)}`
      copyFileSync(managedAsset(image), join(output, file))
      return { ...overlay, file }
    })
    writeFileSync(join(output, 'subtitle.srt'), captions.join('\n'), 'utf8')
    writeFileSync(join(output, 'timeline.csv'), ['shot,title,startMs,endMs,durationMs,media,voice,transition', ...rows.map(row => ['shot', 'title', 'startMs', 'endMs', 'durationMs', 'media', 'voice', 'transition'].map(key => csv(row[key])).join(','))].join('\n'), 'utf8')
    writeFileSync(join(output, 'timeline.json'), JSON.stringify({ format: 'Naraflow CapCut editing kit v1', title: bundle.project.title, aspectRatio: bundle.project.aspectRatio, width, height, fps: 30,
      totalMs: elapsed, shots: rows, editor: { ...bundle.project.editor, overlays, sfx: sfxRows }, characters: bundle.characters.map(c => ({ id: c.id, name: c.name, description: c.description })), publishPack: buildMapPublishPack(bundle.project, clips) }, null, 2))
    writeFileSync(join(output, 'PETUNJUK.txt'), `PAKET EDITING CAPCUT — ${bundle.project.title}\n\n1. Buat proyek baru di CapCut Desktop.\n2. Impor semua MP4 di folder shots, urutkan nama 0001, 0002, dst, lalu letakkan berurutan pada timeline. Durasi shot sudah disiapkan; video sumber asli tersedia di originals.\n3. Impor narasi.wav, letakkan pada 0:00. Suara video Flow dimatikan pada shot agar narator terpisah. Audio asli tetap tersedia di originals.\n4. Buka Teks/Caption > Import file/Local captions, pilih subtitle.srt. Subtitle dapat diedit. Jika belum ada audio, timing SRT mengikuti durasi adegan dan perlu ditinjau.\n5. Tambahkan musik, transisi, gerak gambar biasa, logo, dan overlay sesuai timeline.csv, timeline.json, serta folder editing.\n6. Folder sfx memuat WAV yang sudah dipotong, diatur volume, dan diberi fade. Letakkan setiap WAV pada startMs dalam sfx/timeline.json. Jangan menerapkan offset, volume, atau fade dua kali. File original disertakan untuk revisi. Cue di luar panjang video tidak diekspor.\n\nANIMASI CUTOUT\nKeyframe objek, pergantian pose, rig, dan kamera berkedalaman sudah dirender ke MP4 shot Cutout. Folder cutout menyimpan gambar layer/pose asli dan composition.json dengan seluruh pengaturan animasinya. JSON tersebut adalah metadata Naraflow, bukan keyframe atau rig native CapCut. Untuk mengubah rig, edit di Naraflow lalu ekspor ulang shot.\n\nPaket ini berisi media terpisah dan panduan editing; bukan draft CapCut otomatis. Efek/transisi/gerak kamera pada gambar biasa dan overlay global dicatat untuk dibuat ulang di CapCut, tidak dibakar ke shots. Narasi memakai panjang timeline yang tersimpan.\nPanduan resmi: https://www.capcut.com/id-id/help/how-to-import-subtitles\n`)
    ctx.signal.throwIfAborted()
    require('node:fs').unlinkSync(join(output, 'BELUM-SELESAI.txt'))
    return { message: output }
  })
}
