// Runs before paint so the correct theme is on <html> for the first frame.
// Kept as a separate file (not inline) so the production CSP needs no script hash.
(function () {
  var root = document.documentElement
  try {
    var stored = localStorage.getItem('folio-theme')
    // A stored choice wins; otherwise follow the system preference.
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', dark)
    root.style.colorScheme = dark ? 'dark' : 'light'
  } catch (e) {
    /* leave the light default in place */
  }
})()
