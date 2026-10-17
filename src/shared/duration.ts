/** Generating more than one day in one project is deliberately an operational limit. */
export const MAX_DURATION_SEC = 86400

export function validateDurationSec(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > MAX_DURATION_SEC) {
    throw new Error('Isi durasi antara 1 detik dan 24 jam untuk satu proyek.')
  }
  return Math.round(value * 1000) / 1000
}

/** Accept decimals or mm:ss; the selected unit applies only to plain numeric values. */
export function parseDurationDraft(text: string, unit: 'seconds' | 'minutes'): number | null {
  const value = text.trim().replace(',', '.')
  if (!value) return null
  let seconds: number
  if (value.includes(':')) {
    const match = /^(\d+):([0-5]?\d(?:\.\d+)?)$/.exec(value)
    if (!match) return null
    seconds = Number(match[1]) * 60 + Number(match[2])
  } else {
    if (!/^\d+(?:\.\d+)?$/.test(value)) return null
    seconds = Number(value) * (unit === 'minutes' ? 60 : 1)
  }
  try { return validateDurationSec(seconds) } catch { return null }
}
