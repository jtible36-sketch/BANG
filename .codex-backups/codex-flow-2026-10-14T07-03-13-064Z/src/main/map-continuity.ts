import { isMapMaster } from '@shared/master-prompts'
import { mapClipImageEligible } from '@shared/external-prompts'
import type { Clip, Project } from '@shared/types'
import { buildFlowVideoPrompt } from '@shared/external-prompts'
import { clipsOf, getAsset, getClip, getProject } from './repo'

export function assertMapOpeningImage(project: Project, clip: Clip): void {
  if (!isMapMaster(project)) return
  const first = clipsOf(project.id)[0]
  if (first?.id !== clip.id || !mapClipImageEligible(project, clip)) {
    throw new Error('Hanya adegan pertama Map Animation memakai gambar baru. Impor video sebelumnya lalu ambil frame akhirnya untuk adegan lanjutan.')
  }
}

export function previousMapVideo(clipId: string) {
  const clip = getClip(clipId)
  const project = getProject(clip.projectId)
  if (!isMapMaster(project)) throw new Error('Frame akhir berantai tersedia untuk Map Animation.')
  const clips = clipsOf(project.id)
  const index = clips.findIndex(item => item.id === clip.id)
  if (index <= 0) throw new Error('Adegan pertama memakai gambar awal. Pilih adegan kedua atau berikutnya untuk mengambil frame akhir.')
  const previous = clips[index - 1]
  const video = getAsset(previous.videoAssetId)
  if (!video || video.kind !== 'video' || video.projectId !== project.id || video.clipId !== previous.id) {
    throw new Error('Impor video Flow pada klip sebelumnya terlebih dahulu, lalu ambil frame akhirnya.')
  }
  if (video.prompt !== buildFlowVideoPrompt(project, previous, clips) || (video.meta.mapVideoPlan !== undefined && video.meta.mapVideoPlan !== previous.videoPrompt)) {
    throw new Error('Rencana video sebelumnya berubah. Tinjau dan impor video yang sesuai rencana terbaru sebelum mengambil frame akhirnya.')
  }
  return { clip, project, previous, video }
}

export function assertMapVideoFrame(project: Project, clip: Clip): void {
  if (!isMapMaster(project) || clipsOf(project.id)[0]?.id === clip.id) return
  const { previous, video } = previousMapVideo(clip.id)
  const image = getAsset(clip.imageAssetId)
  if (!image || image.meta.mapFrameSourceClipId !== previous.id || image.meta.mapFrameSourceVideoAssetId !== video.id || image.meta.mapFrameTargetClipId !== clip.id
    || image.meta.mapFrameSourcePlan !== previous.videoPrompt || image.meta.mapFrameTargetPlan !== clip.videoPrompt) {
    throw new Error('Ambil frame akhir video sebelumnya lagi agar gambar awal sesuai video dan urutan klip terbaru.')
  }
}
