import { Moon, Sun } from 'lucide-react'
import { errorText } from '../lib/format'
import { saveThemePreference, useThemeState } from '../lib/theme'
import { useApp } from '../store/app'
import { IconButton } from './ui'

/** A quick explicit light/dark choice; system mode remains available in Settings. */
export function ThemeToggle() {
  const { resolved, saving } = useThemeState()
  const toast = useApp((state) => state.toast)
  const dark = resolved === 'dark'
  const label = dark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'
  return <IconButton
    label={label}
    data-theme-toggle
    disabled={saving}
    aria-busy={saving}
    onClick={() => { void saveThemePreference(dark ? 'light' : 'dark').catch((error: unknown) => toast('error', errorText(error))) }}
  >
    {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
  </IconButton>
}
