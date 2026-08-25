let tabs = [];
let activeTabId = null;
let currentProfile = null;
let isVerticalTabs = false;

const $ = id => document.getElementById(id);

const urlInput = $('url-input');
const navBack = $('nav-back');
const navForward = $('nav-forward');
const navReload = $('nav-reload');
const tabListTop = $('tab-list-top');
const tabListVertical = $('tab-list-vertical');
const browserBody = $('browser-body');
const bookmarksBar = $('bookmarks-bar');
const userChromeStyle = $('zenith-userchrome-css');

// Popups (child windows)
const btnShield = $('btn-shield');
const btnMainMenu = $('btn-main-menu');

// Search engines (ui.search.default_engine)
const SEARCH_ENGINES = {
  duckduckgo: { url: 'https://duckduckgo.com/?q=', name: 'DuckDuckGo' },
  searx:      { url: 'https://searx.be/search?q=',          name: 'SearXNG' },
  brave:      { url: 'https://search.brave.com/search?q=',  name: 'Brave' },
  google:     { url: 'https://www.google.com/search?q=',    name: 'Google' }
};
let searchEngine = SEARCH_ENGINES.duckduckgo;

let uiShowFavicons = true;

async function init() {
  setupWindowControls();
  setupNavButtons();
  setupOmnibox();
  setupPopups();
  setupShortcuts();
  await loadUserChromeCSS();
  await loadActiveProfile();
  await loadShieldStats();
  await loadBookmarks();
  await loadSearchEngine();
  await applyUiPrefs();

  if (window.aegisAPI) {
    window.aegisAPI.onTabsUpdated(data => { tabs = data; renderTabs(); });
    window.aegisAPI.onActiveTabChanged(data => {
      activeTabId = data.id;
      if (document.activeElement !== urlInput) {
        urlInput.value = data.url === 'about:newtab' ? '' : data.url;
      }
      navBack.disabled = !data.canGoBack;
      navForward.disabled = !data.canGoForward;
      renderExtStrip(data.extIcons || []);
      renderTabs();
    });
    window.aegisAPI.onShieldUpdated(() => {});
    window.aegisAPI.onCommandPaletteToggle(() => toggleCommandPalette());
    window.aegisAPI.onFocusOmnibox(() => { urlInput.focus(); urlInput.select(); });
    window.aegisAPI.onThemeChanged(t => document.body.setAttribute('data-theme', t));
    if (typeof window.aegisAPI.onEngineChanged === 'function') {
      window.aegisAPI.onEngineChanged(engine => applyEngineUI(engine));
    }
    if (typeof window.aegisAPI.onCustomChanged === 'function') {
      window.aegisAPI.onCustomChanged(overrides => applyCustomOverrides(overrides));
    }
    if (typeof window.aegisAPI.onBookmarksChanged === 'function') {
      window.aegisAPI.onBookmarksChanged(() => loadBookmarks());
    }
  }
}

async function loadSearchEngine() {
  if (!window.aegisAPI) return;
  let engineKey = 'duckduckgo';
  try {
    engineKey = (await window.aegisAPI.getPref('ui.search.default_engine')) || engineKey;
  } catch (e) {}
  applyEngineUI(engineKey);
}

async function applyUiPrefs() {
  if (!window.aegisAPI) return;
  try {
    const favicons = await window.aegisAPI.getPref('ui.tabs.show_favicon');
    if (favicons === false) {
      uiShowFavicons = false;
      renderTabs();
    }
  } catch (e) {}
  try {
    const animations = await window.aegisAPI.getPref('ui.animations.enabled');
    document.body.classList.toggle('no-animations', animations === false);
  } catch (e) {}
  try {
    const engine = await window.aegisAPI.getPref('ui.search.default_engine');
    applyEngineUI(engine);
  } catch (e) {}
  try {
    const overrides = await window.aegisAPI.getPref('ui.custom.overrides');
    applyCustomOverrides(overrides);
  } catch (e) {}
}

function setupWindowControls() {
  $('win-min').onclick = () => window.aegisAPI && window.aegisAPI.minimizeWindow();
  $('win-max').onclick = () => window.aegisAPI && window.aegisAPI.maximizeWindow();
  $('win-close').onclick = () => window.aegisAPI && window.aegisAPI.closeWindow();
}

function setupNavButtons() {
  navBack.onclick = () => activeTabId && window.aegisAPI && window.aegisAPI.goBack(activeTabId);
  navForward.onclick = () => activeTabId && window.aegisAPI && window.aegisAPI.goForward(activeTabId);
  navReload.onclick = () => activeTabId && window.aegisAPI && window.aegisAPI.reloadTab(activeTabId);

  $('btn-new-tab-top').onclick = () => createTab('about:newtab');
  $('btn-new-tab-vertical').onclick = () => createTab('about:newtab');
  $('btn-incognito').onclick = () => createIncognitoTab('about:newtab');
  $('logo-btn').onclick = toggleCommandPalette;
}

function setupOmnibox() {
  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const val = urlInput.value.trim();
      if (!val) return;

      let url = val;
      if (/^(https?:\/\/|about:|file:\/\/)/i.test(val)) {
        url = val;
      } else if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/.test(val) && !val.includes(' ')) {
        url = 'https://' + val;
      } else {
        url = searchEngine.url + encodeURIComponent(val);
      }

      if (activeTabId && window.aegisAPI) {
        window.aegisAPI.navigateTab(activeTabId, url);
      }
      urlInput.blur();
    }
  });

  urlInput.addEventListener('focus', () => urlInput.select());

  const engineBtn = $('engine-btn');
  if (engineBtn) {
    engineBtn.onclick = (e) => {
      e.stopPropagation();
      if (!window.aegisAPI || typeof window.aegisAPI.openPopup !== 'function') return;
      const r = engineBtn.getBoundingClientRect();
      window.aegisAPI.openPopup('engine', { left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    };
  }
}

const ENGINE_META = {
  duckduckgo: { name: 'DuckDuckGo' },
  searx:      { name: 'SearXNG' },
  brave:      { name: 'Brave' },
  google:     { name: 'Google' }
};

function engineIconSvg(key, size = 15) {
  const icon = (window.ENGINE_ICONS && window.ENGINE_ICONS[key]) || window.ENGINE_ICONS.google;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${icon.color}" aria-hidden="true"><path d="${icon.path}"/></svg>`;
}

function applyEngineUI(engineKey) {
  const key = ENGINE_META[engineKey] ? engineKey : 'duckduckgo';
  if (SEARCH_ENGINES[key]) searchEngine = SEARCH_ENGINES[key];
  const meta = ENGINE_META[key];
  const btn = $('engine-btn');
  if (btn) {
    btn.innerHTML = engineIconSvg(key, 15);
    btn.style.removeProperty('--engine-color');
    btn.title = 'Поисковик: ' + meta.name;
  }
  urlInput.placeholder = `Поиск (${meta.name}) или ввод адреса...`;
}

function applyCustomOverrides(overrides) {
  if (!overrides || typeof overrides !== 'object') return;
  for (const [name, value] of Object.entries(overrides)) {
    if (!name.startsWith('--') || typeof value !== 'string') continue;
    document.documentElement.style.setProperty(name, value);
  }
}

function renderExtStrip(icons) {
  const strip = $('ext-strip');
  if (!strip) return;
  const count = (icons || []).length;
  strip.innerHTML = `
    <button class="ext-puzzle-btn" id="ext-puzzle" title="Расширения${count ? ' (' + count + ')' : ''}">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/>
      </svg>
      ${count ? `<span class="ext-badge">${count}</span>` : ''}
    </button>`;
  const btn = $('ext-puzzle');
  if (btn) {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (!window.aegisAPI || typeof window.aegisAPI.openPopup !== 'function') return;
      const r = btn.getBoundingClientRect();
      window.aegisAPI.openPopup('extlist', { left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    };
  }
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function createTab(url = 'about:newtab') {
  if (window.aegisAPI) window.aegisAPI.createNewTab(url);
}

function createIncognitoTab(url = 'about:newtab') {
  if (window.aegisAPI) window.aegisAPI.createIncognitoTab(url);
}

// ---- Popups Management (separate child windows above the page) ----
function closeAllPopups() {
  if (window.aegisAPI && typeof window.aegisAPI.closePopup === 'function') {
    window.aegisAPI.closePopup();
  }
}

function setupPopups() {
  const openFor = (type) => (e) => {
    e.stopPropagation();
    if (!window.aegisAPI || typeof window.aegisAPI.openPopup !== 'function') return;
    const r = e.currentTarget.getBoundingClientRect();
    window.aegisAPI.openPopup(type, { left: r.left, right: r.right, top: r.top, bottom: r.bottom });
  };
  if (btnShield) btnShield.onclick = openFor('shield');
  if (btnMainMenu) btnMainMenu.onclick = openFor('menu');

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeAllPopups();
    }
  });
}

// ---- Bookmarks Bar ----
async function loadBookmarks() {
  if (!bookmarksBar) return;
  let bm = [];
  if (window.aegisAPI) {
    try { bm = await window.aegisAPI.getBookmarks(); } catch (e) {}
  }
  renderBookmarks(Array.isArray(bm) ? bm : []);
}

function chipColor(url) {
  const colors = ['#de5833', '#5b8def', '#3ecf8e', '#d29922', '#8b5cf6', '#06b6d4', '#ec4899', '#f85149'];
  let hash = 0;
  const s = String(url || '');
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

function bookmarkChip(item) {
  const letter = (item.title || item.url || '?').replace(/^https?:\/\/(www\.)?/, '')[0].toUpperCase();
  return `<span class="bm-chip" style="background:${chipColor(item.url)}">${escapeHtml(letter)}</span>`;
}

function renderBookmarks(bm) {
  if (!bookmarksBar) return;
  bookmarksBar.innerHTML = '';

  bm.forEach(item => {
    if (item.children) {
      const folder = document.createElement('button');
      folder.className = 'bookmark-item bm-folder';
      folder.innerHTML = `
        <span class="bm-chip bm-folder-chip" style="background:#3a4356">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>
        </span>
        ${escapeHtml(item.name)}`;
      folder.title = 'Папка: ' + (item.children.length ? item.children.length + ' ссылок' : 'пусто');
      folder.onclick = (e) => {
        e.stopPropagation();
        if (!window.aegisAPI || typeof window.aegisAPI.openPopup !== 'function') return;
        const r = folder.getBoundingClientRect();
        window.aegisAPI.openPopup('folder', { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, { id: item.id, count: item.children.length });
      };
      bookmarksBar.appendChild(folder);
    } else {
      const el = document.createElement('button');
      el.className = 'bookmark-item';
      el.innerHTML = `${bookmarkChip(item)}<span class="bm-title">${escapeHtml(item.title || item.url)}</span>`;
      el.title = item.url;
      el.onclick = () => {
        if (activeTabId && window.aegisAPI) window.aegisAPI.navigateTab(activeTabId, item.url);
        else createTab(item.url);
      };
      el.oncontextmenu = (e) => {
        e.preventDefault();
        if (window.aegisAPI && confirm('Удалить закладку «' + (item.title || item.url) + '»?')) {
          window.aegisAPI.removeBookmark(item.url);
        }
      };
      bookmarksBar.appendChild(el);
    }
  });

  const add = document.createElement('button');
  add.className = 'bookmark-item bm-add';
  add.title = 'Добавить папку или ссылку';
  add.innerHTML = `<span class="bm-plus">＋</span>`;
  add.onclick = (e) => {
    e.stopPropagation();
    if (!window.aegisAPI || typeof window.aegisAPI.openPopup !== 'function') return;
    const r = add.getBoundingClientRect();
    window.aegisAPI.openPopup('bmadd', { left: r.left, right: r.right, top: r.top, bottom: r.bottom });
  };
  bookmarksBar.appendChild(add);
}

// ---- Tabs ----
function renderTabs() {
  renderTabList(tabListTop);
  renderTabList(tabListVertical);
}

function renderTabList(container) {
  if (!container) return;
  container.innerHTML = '';

  tabs.forEach(tab => {
    const active = tab.id === activeTabId;
    const el = document.createElement('div');
    el.className = `tab-item${active ? ' active' : ''}${tab.incognito ? ' incognito' : ''}`;

    let title = tab.title || tab.url;
    if (tab.url === 'about:newtab' || (tab.incognito && !tab.title)) title = 'Инкогнито';
    if (title.length > 24) title = title.substring(0, 24) + '...';

    let favColor = '#6e7681';
    if (tab.incognito) favColor = '#8b5cf6';
    else if (tab.url.startsWith('about:fingerprint')) favColor = '#d29922';
    else if (tab.url.startsWith('about:config')) favColor = '#8b949e';
    else if (tab.url.startsWith('about:customizer')) favColor = '#5b8def';
    else if (tab.url.startsWith('about:profiles')) favColor = '#3ecf8e';
    else if (tab.url.startsWith('about:newtab')) favColor = '#5b8def';

    el.innerHTML = `
      ${uiShowFavicons ? `<span class="tab-favicon"><span class="fav-dot" style="background: ${favColor}"></span></span>` : ''}
      <span class="tab-title" title="${tab.url}">${title}</span>
      <button class="tab-close-btn">&times;</button>
    `;

    el.onclick = e => {
      if (e.target.classList.contains('tab-close-btn')) return;
      if (window.aegisAPI) window.aegisAPI.switchTab(tab.id);
    };

    el.onauxclick = e => {
      if (e.button === 1 && window.aegisAPI) window.aegisAPI.closeTab(tab.id);
    };

    el.querySelector('.tab-close-btn').onclick = e => {
      e.stopPropagation();
      if (window.aegisAPI) window.aegisAPI.closeTab(tab.id);
    };

    container.appendChild(el);
  });
}

function toggleVerticalTabs() {
  isVerticalTabs = !isVerticalTabs;
  browserBody.classList.toggle('vertical-mode', isVerticalTabs);
  if (window.aegisAPI) {
    window.aegisAPI.setPref('ui.tabs.position', isVerticalTabs ? 'left' : 'top');
    window.aegisAPI.reloadUIStyles();
  }
}

async function loadUserChromeCSS() {
  if (!window.aegisAPI) return;
  try {
    const css = await window.aegisAPI.getUserChromeCSS();
    if (userChromeStyle) userChromeStyle.textContent = css || '';
  } catch (e) {}
}

async function loadActiveProfile() {
  if (!window.aegisAPI) return;
  try {
    currentProfile = await window.aegisAPI.getActiveProfile();
  } catch (e) {}
}

async function loadShieldStats() {
  // Shield stats now render inside the shield popup window
}

// Command palette lives in its own child window (pages/popup.html?panel=palette)
function toggleCommandPalette(force = null) {
  if (force === false) { closeAllPopups(); return; }
  if (!window.aegisAPI || typeof window.aegisAPI.openPopup !== 'function') return;
  window.aegisAPI.openPopup('palette');
}

function setTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  if (window.aegisAPI) window.aegisAPI.setPref('ui.theme', theme);
}

function setupShortcuts() {
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggleCommandPalette(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); urlInput.focus(); urlInput.select(); }
  });
}

window.addEventListener('DOMContentLoaded', init);
