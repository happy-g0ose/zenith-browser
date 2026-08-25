const $ = (id) => document.getElementById(id);

const ENGINES = {
  duckduckgo: { name: 'DuckDuckGo' },
  brave: { name: 'Brave' },
  google: { name: 'Google' },
  searx: { name: 'SearXNG' }
};

const WALLPAPER_PRESETS = [
  ['aurora', 'linear-gradient(135deg, #0f2027 0%, #203a43 30%, #2c5364 60%, #1a2980 100%)'],
  ['sunset', 'linear-gradient(135deg, #355c7d 0%, #6c5b7b 45%, #c06c84 100%)'],
  ['ocean', 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)'],
  ['forest', 'linear-gradient(135deg, #134e5e 0%, #3a7bd5 55%, #71b280 100%)'],
  ['mono', 'linear-gradient(160deg, #16191f 0%, #0b0d11 100%)']
];

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function go(url) {
  if (window.aegisAPI && typeof window.aegisAPI.navigateCurrent === 'function') {
    window.aegisAPI.navigateCurrent(url);
  }
}

// ---- Clock, date, greeting ----
function tickClock() {
  const now = new Date();
  $('clock').textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
}
function renderGreeting() {
  const h = new Date().getHours();
  const greet = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  $('date-line').textContent = greet + ' · ' + date;
}

// ---- Search ----
async function setupSearch() {
  const input = $('nt-search');
  let engine = 'duckduckgo';
  try { engine = (await window.aegisAPI.getPref('ui.search.default_engine')) || engine; } catch (e) {}

  const icon = window.ENGINE_ICONS && window.ENGINE_ICONS[engine];
  const engEl = $('nt-engine');
  if (icon) {
    engEl.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="${icon.color}"><path d="${icon.path}"/></svg>`;
    engEl.title = 'Поиск: ' + (ENGINES[engine] || {}).name;
  }

  const searchUrl = {
    duckduckgo: 'https://duckduckgo.com/?q=',
    brave: 'https://search.brave.com/search?q=',
    google: 'https://www.google.com/search?q=',
    searx: 'https://searx.be/search?q='
  }[engine] || 'https://duckduckgo.com/?q=';

  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const val = input.value.trim();
    if (!val) return;
    let url = val;
    if (!/^(https?:\/\/|about:|file:\/\/)/i.test(val)) {
      url = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/.test(val) && !val.includes(' ')
        ? 'https://' + val
        : searchUrl + encodeURIComponent(val);
    }
    go(url);
  });
}

// ---- Wallpaper ----
async function applyWallpaper() {
  let pref = '';
  try { pref = (await window.aegisAPI.getPref('ui.newtab.wallpaper')) || ''; } catch (e) {}
  const wp = $('wallpaper');
  wp.className = 'wallpaper';
  document.body.classList.toggle('wallpapered', !!pref);

  if (!pref) {
    document.body.style.background = '#0b0d11';
    markActiveSwatch('');
    return;
  }
  if (pref.startsWith('preset:')) {
    const name = pref.slice(7);
    wp.classList.add('preset-' + name, 'on');
    document.body.style.background = 'transparent';
    markActiveSwatch(name);
  } else if (pref.startsWith('file://')) {
    wp.style.backgroundImage = `url("${pref}")`;
    wp.classList.add('on');
    document.body.style.background = 'transparent';
    markActiveSwatch('custom');
  }
}

function markActiveSwatch(key) {
  document.querySelectorAll('.wp-swatch').forEach(s => s.classList.toggle('active', s.dataset.wp === key));
}

function setupWallpaperUI() {
  const grid = $('wp-grid');
  grid.innerHTML = WALLPAPER_PRESETS.map(([name, grad]) =>
    `<div class="wp-swatch" data-wp="${name}" title="${name}" style="background:${grad}"></div>`
  ).join('');

  grid.querySelectorAll('.wp-swatch').forEach(sw => {
    sw.onclick = async () => {
      if (!window.aegisAPI) return;
      await window.aegisAPI.setWallpaperPreset('preset:' + sw.dataset.wp);
    };
  });

  $('wp-custom').onclick = async () => { if (window.aegisAPI) await window.aegisAPI.setWallpaperImage(); };
  $('wp-none').onclick = async () => { if (window.aegisAPI) await window.aegisAPI.setWallpaperPreset(''); };
  $('wp-close').onclick = () => {
    $('wp-settings').classList.remove('open');
    document.body.classList.remove('wp-open');
  };
  $('gear').onclick = () => {
    $('wp-settings').classList.add('open');
    document.body.classList.add('wp-open');
  };

  if (typeof window.aegisAPI.onWallpaperChanged === 'function') {
    window.aegisAPI.onWallpaperChanged(() => applyWallpaper());
  }
}

window.addEventListener('DOMContentLoaded', () => {
  tickClock();
  setInterval(tickClock, 5000);
  renderGreeting();
  setupSearch();
  applyWallpaper();
  setupWallpaperUI();
});
