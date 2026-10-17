import type { AppSettings } from '@shared/types'

export type ThemePreference = AppSettings['theme']
const CACHE_KEY = 'bang-story-theme'
const CHANGE_EVENT = 'bang-story:theme-change'

function validPreference(value: unknown): ThemePreference {
  return value === 'dark' || value === 'system' ? value : 'light'
}

function cachedPreference(): ThemePreference {
  try { return validPreference(localStorage.getItem(CACHE_KEY)) }
  catch { return 'light' }
}

/** Only the app shell changes appearance. Artwork, generated media, and export colors stay intact. */
export function applyTheme(preference: ThemePreference): void {
  const value = validPreference(preference)
  const resolved = value === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' : value
  document.documentElement.dataset.theme = resolved
  document.documentElement.dataset.themePreference = value
  document.documentElement.style.colorScheme = resolved
  try { localStorage.setItem(CACHE_KEY, value) } catch { /* The saved app setting remains authoritative if local storage is unavailable. */ }
}

/** Keep Settings and the app's system-theme subscription in sync without restarting. */
export function previewTheme(preference: ThemePreference): void {
  applyTheme(preference)
  window.dispatchEvent(new CustomEvent<ThemePreference>(CHANGE_EVENT, { detail: preference }))
}

export function subscribeToTheme(): () => void {
  let preference = cachedPreference()
  let edited = false
  let alive = true
  const system = window.matchMedia('(prefers-color-scheme: dark)')
  applyTheme(preference)
  const change = (event: Event): void => {
    edited = true
    preference = validPreference((event as CustomEvent).detail)
    applyTheme(preference)
  }
  const systemChange = (): void => { if (preference === 'system') applyTheme(preference) }
  window.addEventListener(CHANGE_EVENT, change)
  system.addEventListener('change', systemChange)
  void window.api.settings.get().then((settings) => {
    if (!alive || edited) return
    preference = validPreference(settings.theme)
    applyTheme(preference)
  }).catch(() => { /* Keep the cached appearance when settings cannot be read. */ })
  return () => {
    alive = false
    window.removeEventListener(CHANGE_EVENT, change)
    system.removeEventListener('change', systemChange)
  }
}
