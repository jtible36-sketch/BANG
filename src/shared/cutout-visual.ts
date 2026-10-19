import {scheduledItem} from './cutout-plan-diagnostics'
import type { Asset } from './types'
import type { CutoutAssetState } from './cutout-assets'
import { generatedForItem } from './cutout-production'

/** Readiness means a current saved package and real images, not visual approval. */
export function cutoutVisualReadiness(state: CutoutAssetState | undefined, assets: Asset[]) {
  const plan = state?.plan
  const required=plan?.items.filter(scheduledItem)??[]
  const total = required.length
  const available = plan ? required.filter(item => generatedForItem(assets, plan, item.id)).length : 0
  return { total, available, missing: total - available, ready: !!plan?.director && !state?.stale && total > 1 && available === total }
}

export interface CutoutVisualBatchInput {
  projectId: string
  clipIds: string[]
  provider: 'codex' | 'flow-mcp'
  format: 'png' | 'webp'
  maxNewAssets: number
}
