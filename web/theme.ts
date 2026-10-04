export function readTheme() {
  try {
    return localStorage.getItem('theme') === 'dark';
  } catch {
    return document.documentElement.dataset.theme === 'dark';
  }
}

export function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  } catch {}
}
