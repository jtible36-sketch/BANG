// Run before the app's styles and renderer so a saved dark theme does not flash light.
;(function () {
  var preference = 'light'
  try { preference = localStorage.getItem('bang-story-theme') || 'light' } catch (_) {}
  if (preference !== 'dark' && preference !== 'system') preference = 'light'
  var theme = preference === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' : preference
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.themePreference = preference
  document.documentElement.style.colorScheme = theme
})()
