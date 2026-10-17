import { BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import { cutoutAssetIds, evaluateCutoutScene, normalizeCutoutScene, type CutoutScene } from '@shared/cutout-timeline'
import { cutoutMaskSvg } from '@shared/cutout-mask'
import type { ProjectBundle } from '@shared/types'
import { assetAbsPath, projectsRoot } from './paths'

export interface CutoutImageSource { id: string; path: string }
export interface CutoutRenderOptions {
  scene: CutoutScene
  images: CutoutImageSource[]
  width: number
  height: number
  fps: number
  durationMs: number
  holdMs?: number
  outputPath: string
  ffmpegPath: string
  signal: AbortSignal
  onProgress?: (fraction: number) => void
  /** Private managed paths supplied by main. No encoder runs in sampled-review mode. */
  reviewFrames?: Array<{timeMs:number;path:string}>
}

/** Resolve only images inside this project's managed directory, including pose assets. */
export function cutoutImageSources(bundle: ProjectBundle, scene: CutoutScene): CutoutImageSource[] {
  const root = realpathSync(join(projectsRoot(), bundle.project.id))
  return cutoutAssetIds(scene).map(id => {
    const asset = bundle.assets.find(item => item.id === id && item.projectId === bundle.project.id)
    if (!asset || (asset.kind !== 'image' && asset.kind !== 'overlay')) throw new Error(`Gambar layer/pose Cutout ${id} tidak ditemukan. Pilih ulang gambar pada editor Cutout.`)
    try {
      const path = realpathSync(assetAbsPath(bundle.project.id, asset.localPath))
      const rel = relative(root, path)
      if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel) || !statSync(path).isFile()) throw new Error('invalid path')
      return { id, path }
    } catch {
      throw new Error(`File gambar Cutout ${asset.id} hilang atau berada di luar folder proyek. Impor kembali gambar/pose tersebut.`)
    }
  })
}

/** Read dimensions before decoding so compressed images cannot allocate unbounded canvas memory. */
function imageHeader(bytes: Buffer): { mime: string; width: number; height: number } {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    for (let pos = 8; pos + 12 <= bytes.length;) {
      const size = bytes.readUInt32BE(pos), kind = bytes.toString('ascii', pos + 4, pos + 8)
      if (kind === 'acTL') throw new Error('Gunakan PNG statis untuk pose Cutout. Pecah PNG animasi menjadi pose terpisah.')
      if (size > bytes.length - pos - 12) break
      pos += size + 12
    }
    return { mime: 'image/png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  }
  if (bytes.length >= 30 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    for (let pos = 12; pos + 8 <= bytes.length;) {
      const kind = bytes.toString('ascii', pos, pos + 4), size = bytes.readUInt32LE(pos + 4), data = pos + 8
      if (data + size > bytes.length) break
      if (kind === 'VP8X' && size >= 10) {
        if (bytes[data] & 2) throw new Error('Gunakan WebP statis untuk pose Cutout. Pecah WebP animasi menjadi pose terpisah.')
        return { mime: 'image/webp', width: bytes.readUIntLE(data + 4, 3) + 1, height: bytes.readUIntLE(data + 7, 3) + 1 }
      }
      if (kind === 'VP8 ' && size >= 10 && bytes.readUIntLE(data + 3, 3) === 0x2a019d) return { mime: 'image/webp', width: bytes.readUInt16LE(data + 6) & 0x3fff, height: bytes.readUInt16LE(data + 8) & 0x3fff }
      if (kind === 'VP8L' && size >= 5 && bytes[data] === 0x2f) {
        const bits = bytes.readUInt32LE(data + 1)
        return { mime: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
      }
      pos = data + size + (size & 1)
    }
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let pos = 2; pos + 4 <= bytes.length;) {
      if (bytes[pos++] !== 0xff) break
      while (bytes[pos] === 0xff) pos++
      const marker = bytes[pos++]
      if (marker === 0xda || marker === 0xd9) break
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
      if (pos + 2 > bytes.length) break
      const size = bytes.readUInt16BE(pos)
      if (size < 2 || pos + size > bytes.length) break
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && size >= 7) {
        return { mime: 'image/jpeg', width: bytes.readUInt16BE(pos + 5), height: bytes.readUInt16BE(pos + 3) }
      }
      pos += size
    }
  }
  throw new Error('Cutout hanya dapat merender gambar PNG, WebP, atau JPEG yang valid.')
}

function bounded<T>(operation: Promise<T>, signal: AbortSignal, label: string, timeout = 30000): Promise<T> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const done = (error?: unknown, value?: T): void => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      if (error) reject(error); else resolve(value as T)
    }
    const abort = (): void => done(new Error('Ekspor Cutout dibatalkan.'))
    const timer = setTimeout(() => done(new Error(`${label} melewati batas waktu. Coba kurangi ukuran gambar Cutout.`)), timeout)
    signal.addEventListener('abort', abort, { once: true })
    operation.then(value => done(undefined, value), error => done(error))
  })
}

/** Every frame uses the same evaluator as the editor. The isolated page only decodes local bytes and draws a canvas. */
export async function renderCutoutSegment(options: CutoutRenderOptions): Promise<void> {
  const { width, height, fps, durationMs, outputPath, signal } = options
  const scene = normalizeCutoutScene(options.scene)
  if (!scene?.enabled) throw new Error('Komposisi Cutout belum aktif.')
  const holdMs = options.holdMs ?? 0
  if (![width, height, fps, durationMs, holdMs].every(Number.isFinite) || width < 2 || height < 2 || width > 4096 || height > 4096 || width % 2 || height % 2 || fps < 1 || fps > 60 || durationMs <= 0 || holdMs < 0 || durationMs + holdMs > 1800000) throw new Error('Ukuran, FPS, atau durasi ekspor Cutout tidak valid (maksimum 4K, 60 FPS, dan 30 menit per klip).')
  signal.throwIfAborted()
  const ids = cutoutAssetIds(scene)
  if (ids.length > 256) throw new Error('Satu klip Cutout mendukung maksimum 256 gambar unik. Pisahkan klip untuk melanjutkan.')
  const images = new Map(options.images.map(image => [image.id, image.path]))
  for (const id of ids) if (!images.has(id)) throw new Error(`Gambar layer/pose Cutout ${id} belum tersedia.`)
  const window = new BrowserWindow({
    show: false, width: 16, height: 16, skipTaskbar: true,
    webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, webSecurity: true, backgroundThrottling: false, partition: `cutout-render-${randomUUID()}` }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'file://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }))
  const abortWindow = (): void => { if (!window.isDestroyed()) window.destroy() }
  signal.addEventListener('abort', abortWindow, { once: true })
  try {
    await bounded(window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; script-src \'none\'; connect-src \'none\'"><canvas id="frame"></canvas>')), signal, 'Memuat kanvas Cutout')
    await bounded(window.webContents.executeJavaScript(`(() => {
      const canvas = document.getElementById('frame'); canvas.width = ${width}; canvas.height = ${height};
      const ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) throw new Error('Canvas 2D tidak tersedia');
      const images = new Map();
      window.cutoutLoad = async (id, data, width, height) => {
        const image = new Image(); image.src = data; await image.decode();
        // JPEG EXIF orientation can legitimately transpose dimensions after decoding.
        if (!((image.naturalWidth === width && image.naturalHeight === height) || (image.naturalWidth === height && image.naturalHeight === width))) throw new Error('Dimensi gambar tidak cocok');
        const bitmap = await createImageBitmap(image); images.set(id, bitmap);
        return { width: bitmap.width, height: bitmap.height };
      };
      const masked = new Map();
      window.cutoutDrop = (id) => { images.get(id)?.close(); images.delete(id); for (const [key,value] of masked) if (key.startsWith(id+'|')) {value.close();masked.delete(key)} };
      window.cutoutDraw = async (draw, color) => {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        for (const item of draw) {
          let image = images.get(item.assetId); if (!image) throw new Error('Gambar Cutout hilang: ' + item.assetId);
          if (item.maskSvg) {
            const key = item.assetId + '|' + item.maskSvg;
            if (!masked.has(key)) {
              const mask = new Image(); mask.src = 'data:image/svg+xml,' + encodeURIComponent(item.maskSvg); await mask.decode();
              const surface = new OffscreenCanvas(image.width, image.height), mc = surface.getContext('2d');
              mc.drawImage(image,0,0); mc.globalCompositeOperation = 'destination-in'; mc.drawImage(mask,0,0,image.width,image.height);
              masked.set(key, surface.transferToImageBitmap());
              if(masked.size>64){const oldest=masked.keys().next().value;masked.get(oldest).close();masked.delete(oldest)}
            }
            image = masked.get(key);
          }
          ctx.setTransform(...item.matrix); ctx.globalAlpha = item.opacity; ctx.drawImage(image, 0, 0, item.width, item.height);
        }
        return canvas.toDataURL('image/png').slice(22);
      };
    })()`), signal, 'Menyiapkan kanvas Cutout')
    const metrics: Record<string, { width: number; height: number }> = {}
    let totalBytes = 0
    const headers = new Map<string,ReturnType<typeof imageHeader>>(), loaded = new Map<string,number>()
    for (const id of ids) {
      signal.throwIfAborted()
      const path=images.get(id)!,info=await stat(path)
      totalBytes+=info.size
      if(!info.isFile()||info.size>32*1024*1024||totalBytes>1024*1024*1024)throw new Error('Gambar Cutout terlalu besar: maksimum 32 MB per gambar dan 1 GB terkompresi per klip.')
      const header=imageHeader(await readFile(path)),pixels=header.width*header.height
      if(!header.width||!header.height||header.width>16384||header.height>16384||pixels>32*1024*1024)throw new Error('Resolusi satu gambar Cutout terlalu besar. Perkecil aset sebelum ekspor.')
      headers.set(id,header);metrics[id]={width:header.width,height:header.height}
    }
    const ensureImages=async(active:Set<string>):Promise<void>=>{
      let pixels=[...loaded.values()].reduce((n,p)=>n+p,0)
      const needed=[...active].filter(id=>!loaded.has(id)),newPixels=needed.reduce((n,id)=>n+headers.get(id)!.width*headers.get(id)!.height,0)
      for(const [id,count] of loaded){
        if(pixels+newPixels<=96*1024*1024&&loaded.size+needed.length<=64)break
        if(active.has(id))continue
        await window.webContents.executeJavaScript(`window.cutoutDrop(${JSON.stringify(id)})`);loaded.delete(id);pixels-=count
      }
      if(pixels+newPixels>96*1024*1024)throw new Error('Layer yang terlihat bersamaan terlalu besar. Perkecil resolusi aset atau kurangi layer aktif.')
      for(const id of needed){
        signal.throwIfAborted();const bytes=await readFile(images.get(id)!),header=headers.get(id)!
        metrics[id]=await bounded(window.webContents.executeJavaScript(`window.cutoutLoad(${JSON.stringify(id)},${JSON.stringify(`data:${header.mime};base64,${bytes.toString('base64')}`)},${header.width},${header.height})`) as Promise<{width:number;height:number}>,signal,`Membuka gambar Cutout ${id}`)
        loaded.set(id,metrics[id].width*metrics[id].height)
      }
      // Refresh LRU order for active images.
      for(const id of active){const count=loaded.get(id);if(count!==undefined){loaded.delete(id);loaded.set(id,count)}}
    }
    if (options.reviewFrames) {
      if (!options.reviewFrames.length || options.reviewFrames.length > 12 || options.reviewFrames.some(f => !Number.isFinite(f.timeMs) || f.timeMs < 0 || f.timeMs >= durationMs)) throw new Error('Maksimum 12 sampel frame di dalam durasi klip.')
      for (const frame of options.reviewFrames) {
        signal.throwIfAborted()
        const visible = evaluateCutoutScene(scene, frame.timeMs, width, height, metrics)
        await ensureImages(new Set(visible.map(item => item.assetId)))
        const draw = evaluateCutoutScene(scene, frame.timeMs, width, height, metrics).map(item => ({...item, ...(item.mask ? {maskSvg:cutoutMaskSvg(item.mask,item.width/item.height)} : {})}))
        const base64 = await bounded(window.webContents.executeJavaScript(`window.cutoutDraw(${JSON.stringify(draw)},${JSON.stringify(scene.backgroundColor)})`) as Promise<string>,signal,'Merender sampel komposisi')
        await writeFile(frame.path, Buffer.from(base64,'base64'),{flag:'wx'})
      }
      return
    }
    const frames = Math.max(1, Math.round((durationMs + holdMs) * fps / 1000))
    signal.throwIfAborted()
    const encoder = spawn(options.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'png', '-i', 'pipe:0', '-frames:v', String(frames), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', outputPath], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] })
    let tail = '', encoderFailure: Error | null = null
    const abortEncoder = (): void => { encoder.kill('SIGKILL') }
    signal.addEventListener('abort', abortEncoder, { once: true })
    encoder.stderr.on('data', chunk => { tail = (tail + String(chunk)).slice(-3000) })
    encoder.stdin.on('error', error => { encoderFailure = error })
    const completed = new Promise<void>((resolve, reject) => {
      encoder.once('error', error => { encoderFailure = error; reject(error) })
      encoder.once('close', code => code === 0 ? resolve() : reject(encoderFailure ?? new Error(signal.aborted ? 'Ekspor Cutout dibatalkan.' : `FFmpeg Cutout gagal (${code}): ${tail.trim()}`)))
    })
    // Register rejection immediately; a process may exit while a canvas frame is still being produced.
    void completed.catch(() => {})
    try {
      const lastOwnFrameMs = Math.max(0, (Math.max(1, Math.round(durationMs * fps / 1000)) - 1) * 1000 / fps)
      for (let frame = 0; frame < frames; frame++) {
        signal.throwIfAborted()
        if (encoderFailure) throw encoderFailure
        const timeMs = Math.min(frame * 1000 / fps, lastOwnFrameMs)
        const visible=evaluateCutoutScene(scene,timeMs,width,height,metrics)
        await ensureImages(new Set(visible.map(item=>item.assetId)))
        const draw = evaluateCutoutScene(scene, timeMs, width, height, metrics).map(item => ({ ...item, ...(item.mask ? { maskSvg: cutoutMaskSvg(item.mask, item.width/item.height) } : {}) }))
        const base64 = await bounded(window.webContents.executeJavaScript(`window.cutoutDraw(${JSON.stringify(draw)},${JSON.stringify(scene.backgroundColor)})`) as Promise<string>, signal, 'Merender frame Cutout')
        const bytes = Buffer.from(base64, 'base64')
        await bounded(new Promise<void>((resolve, reject) => { encoder.stdin.write(bytes, error => error ? reject(error) : resolve()) }), signal, 'Mengirim frame Cutout ke FFmpeg')
        if (frame % fps === 0 || frame === frames - 1) options.onProgress?.((frame + 1) / frames)
      }
      encoder.stdin.end()
      await bounded(completed, signal, 'Menyelesaikan video Cutout', 60000)
    } finally {
      signal.removeEventListener('abort', abortEncoder)
      if (encoder.exitCode === null) encoder.kill('SIGKILL')
      await completed.catch(() => {})
    }
  } finally {
    signal.removeEventListener('abort', abortWindow)
    if (!window.isDestroyed()) window.destroy()
  }
}
