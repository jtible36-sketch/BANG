import type { Job } from './types'
import type { CutoutAssetProvider } from './cutout-assets'

export interface MissingAssetRecoveryStatus {
  jobId: string; clipId: string; clipTitle: string; missingAssets: string[]; remaining: number
}
export interface RecoverMissingAssetsInput {
  projectId: string; jobId: string; provider: CutoutAssetProvider; format: 'png'|'webp'; maxNewAssets: number
  confirmationToken?: string; confirmedCount?: number
}
export type RecoverMissingAssetsResult = {kind:'started'; job:Job} | {kind:'confirmation-required';count:number;limit:number;token:string}
