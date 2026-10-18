import type { CutoutAssetProvider } from '@shared/cutout-assets'
export interface CutoutGenerationPreferences {provider:CutoutAssetProvider;format:'png'|'webp'}
const KEY='naraflow:cutout-generation'
export function readCutoutGenerationPreferences():CutoutGenerationPreferences {
  try{const v=JSON.parse(localStorage.getItem(KEY)??'{}');return {provider:v.provider==='flow-mcp'?'flow-mcp':'codex',format:v.format==='webp'?'webp':'png'}}catch{return {provider:'codex',format:'png'}}
}
export function saveCutoutGenerationPreferences(patch:Partial<CutoutGenerationPreferences>):void {
  try{localStorage.setItem(KEY,JSON.stringify({...readCutoutGenerationPreferences(),...patch}))}catch{/* Storage may be unavailable; generation still works with the selected values. */}
}
