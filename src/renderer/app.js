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
  setupFindbar();
  setupDownloads();
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
    window.aegisAPI.onThemeChanged(t => applyThemeAttr(t));
    if (typeof window.aegisAPI.onEngineChanged === 'function') {
      window.aegisAPI.onEngineChanged(engine => applyEngineUI(engine));
    }
    if (typeof window.aegisAPI.onCustomChanged === 'function') {
      window.aegisAPI.onCustomChanged(overrides => applyCustomOverrides(overrides));
    }
    if (typeof window.aegisAPI.onLayoutChanged === 'function') {
      window.aegisAPI.onLayoutChanged(layout => applyCustomLayout(layout));
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
  try {
    const layout = await window.aegisAPI.getPref('ui.custom.layout');
    applyCustomLayout(layout);
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

const appliedCustomVars = new Set();

// ---- Layout editor (sizes + hidden parts) ----
function applyCustomLayout(layout) {
  const l = layout && typeof layout === 'object' ? layout : {};
  const hide = l.hide || {};
  const sizes = l.sizes || {};
  const clamp = (v, min, max, def) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
  };
  document.body.style.setProperty('--tabstrip-h', clamp(sizes.tabstrip, 26, 56, 38) + 'px');
  document.body.style.setProperty('--navbar-h', clamp(sizes.navbar, 30, 64, 40) + 'px');
  document.body.style.setProperty('--bookmarks-h', clamp(sizes.bookmarks, 22, 48, 28) + 'px');
  document.body.style.setProperty('--ui-font-size', clamp(sizes.font, 11, 17, 13) + 'px');
  document.body.style.setProperty('--ui-radius', clamp(sizes.radius, 0, 16, 6) + 'px');
  document.body.classList.toggle('hide-navbar', !!hide.navbar);
  document.body.classList.toggle('hide-bookmarks', !!hide.bookmarks);
  document.body.classList.toggle('hide-downloads', !!hide.downloads);
  document.body.classList.toggle('hide-ext', !!hide.ext);
  document.body.classList.toggle('hide-incognito', !!hide.incognito);
  document.body.classList.toggle('hide-shield', !!hide.shield);
}

function applyCustomOverrides(overrides) {
  const next = new Set();
  if (overrides && typeof overrides === 'object') {
    for (const [name, value] of Object.entries(overrides)) {
      if (!name.startsWith('--') || typeof value !== 'string') continue;
      next.add(name);
      // Set on BOTH html and body: themes.css defines vars on body[data-theme],
      // so an html-only override would be shadowed by the body-level definition
      document.documentElement.style.setProperty(name, value);
      document.body.style.setProperty(name, value);
    }
  }
  for (const name of appliedCustomVars) {
    if (!next.has(name)) {
      document.documentElement.style.removeProperty(name);
      document.body.style.removeProperty(name);
    }
  }
  appliedCustomVars.clear();
  next.forEach(n => appliedCustomVars.add(n));
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
      const cachedFav = faviconMem.get(item.url);
      const iconHtml = cachedFav
        ? `<span class="bm-chip bm-fav"><img src="${cachedFav}"></span>`
        : bookmarkChip(item);
      el.innerHTML = `${iconHtml}<span class="bm-title">${escapeHtml(item.title || item.url)}</span>`;
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
      if (!cachedFav) {
        requestFavicon(item.url, activeTabId, dataUrl => {
          el.querySelector('.bm-chip').innerHTML = `<img src="${dataUrl}">`;
          el.querySelector('.bm-chip').classList.add('bm-fav');
        });
      }
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

// Keyed diff renderer: tabs update IN PLACE instead of rebuilding the whole
// list on every navigation (the old innerHTML wipe re-created every node and
// re-ran layout dozens of times per page load)
function renderTabList(container) {
  if (!container) return;
  const els = container._tabEls || (container._tabEls = new Map());
  if (!container._dragWired) {
    container._dragWired = true;
    container.addEventListener('dragover', e => e.preventDefault());
    container.addEventListener('drop', e => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      if (!id || !window.aegisAPI) return;
      const after = [...container.children].find(child => {
        const r = child.getBoundingClientRect();
        return e.clientX < r.left + r.width / 2;
      });
      const beforeId = after ? after.dataset.id : null;
      if (beforeId !== id) window.aegisAPI.reorderTab(id, beforeId);
    });
  }
  const seen = new Set();

  tabs.forEach((tab, index) => {
    seen.add(tab.id);
    let el = els.get(tab.id);
    const isNew = !el;

    if (isNew) {
      el = document.createElement('div');
      els.set(tab.id, el);
      el.draggable = true;
      el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', el.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('click', e => {
        if (e.target.classList.contains('tab-close-btn')) return;
        if (window.aegisAPI) window.aegisAPI.switchTab(el.dataset.id);
      });
      el.addEventListener('auxclick', e => {
        if (e.button === 1 && window.aegisAPI) window.aegisAPI.closeTab(el.dataset.id);
      });
    }

    const active = tab.id === activeTabId;
    const className = `tab-item${active ? ' active' : ''}${tab.incognito ? ' incognito' : ''}${isNew ? ' tab-enter' : ''}`;
    if (el.className !== className) el.className = className;
    if (el.dataset.id !== tab.id) el.dataset.id = tab.id;

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

    const sig = `${title}|${tab.url}|${favColor}|${uiShowFavicons}`;
    if (el.dataset.sig !== sig) {
      el.dataset.sig = sig;
      const cachedFav = faviconMem.get(tab.url);
      const faviconHtml = cachedFav
        ? `<img src="${cachedFav}" class="fav-img">`
        : `<span class="fav-dot" style="background: ${favColor}"></span>`;
      el.innerHTML = `
        ${uiShowFavicons ? `<span class="tab-favicon">${faviconHtml}</span>` : ''}
        <span class="tab-title" title="${escapeHtmlAttr(tab.url)}">${escapeHtmlAttr(title)}</span>
        <button class="tab-close-btn">&times;</button>
      `;
      const closeBtn = el.querySelector('.tab-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', e => {
          e.stopPropagation();
          if (window.aegisAPI) window.aegisAPI.closeTab(el.dataset.id);
        });
      }
    }

    if (uiShowFavicons && !faviconMem.has(tab.url)) {
      requestFavicon(tab.url, tab.id, dataUrl => {
        if (!dataUrl) return;
        document.querySelectorAll(`.tab-item[data-id="${tab.id}"] .tab-favicon`).forEach(sp => {
          sp.innerHTML = `<img src="${dataUrl}" class="fav-img">`;
        });
      });
    }

    // Keep DOM order in sync with the tabs array
    const expected = container.children[index];
    if (expected !== el) container.insertBefore(el, expected || null);
  });

  for (const [id, el] of [...els]) {
    if (!seen.has(id)) {
      el.remove();
      els.delete(id);
    }
  }
}

function escapeHtmlAttr(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- Favicons (fetched through the tab's own session, cached in main) ----
const faviconMem = new Map(); // url -> dataURL | '' (failed) | absent = pending

function requestFavicon(url, tabId, cb) {
  if (!url || url.startsWith('about:') || url.startsWith('file:')) return;
  if (faviconMem.has(url)) {
    const v = faviconMem.get(url);
    if (v) cb(v);
    return;
  }
  faviconMem.set(url, '');
  window.aegisAPI.getFavicon(url, tabId || null).then(d => {
    faviconMem.set(url, d || '');
    if (d) cb(d);
  }).catch(() => {});
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

function applyThemeAttr(theme) {
  // Brief crossfade window so theme switches blend instead of snapping
  document.body.classList.add('theme-fade');
  document.body.setAttribute('data-theme', theme);
  clearTimeout(applyThemeAttr._t);
  applyThemeAttr._t = setTimeout(() => document.body.classList.remove('theme-fade'), 380);
}

function setTheme(theme) {
  applyThemeAttr(theme);
  if (window.aegisAPI) window.aegisAPI.setPref('ui.theme', theme);
}

function setupShortcuts() {
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggleCommandPalette(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); urlInput.focus(); urlInput.select(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); window.aegisAPI && window.aegisAPI.zoomIn(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); window.aegisAPI && window.aegisAPI.zoomOut(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); window.aegisAPI && window.aegisAPI.zoomReset(); }
    else if (e.key === 'F3') { e.preventDefault(); openFindbar(); }
  });
}

// ---- Find in page ----
function openFindbar() {
  const fb = $('findbar');
  const input = $('find-input');
  if (!fb || !input) return;
  fb.classList.add('visible');
  input.focus();
  input.select();
  if (input.value.trim()) doFind(true, true);
}

function closeFindbar() {
  const fb = $('findbar');
  if (fb) fb.classList.remove('visible');
  if (window.aegisAPI) window.aegisAPI.findStop();
}

function doFind(forward, findNext) {
  const input = $('find-input');
  const count = $('find-count');
  if (!input) return;
  const text = input.value.trim();
  if (!text) { if (count) count.textContent = ''; return; }
  if (window.aegisAPI) window.aegisAPI.findStart(text, forward, findNext);
}

function setupFindbar() {
  const input = $('find-input');
  if (!input) return;
  input.addEventListener('input', () => doFind(true, false));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doFind(!e.shiftKey, true); }
    else if (e.key === 'Escape') { e.preventDefault(); closeFindbar(); }
  });
  $('find-next').onclick = () => doFind(true, true);
  $('find-prev').onclick = () => doFind(false, true);
  $('find-close').onclick = closeFindbar;
  if (typeof window.aegisAPI.onFindResults === 'function') {
    window.aegisAPI.onFindResults(r => {
      const count = $('find-count');
      if (count) count.textContent = r && r.matches ? `${r.active}/${r.matches}` : '0/0';
    });
  }
  if (typeof window.aegisAPI.onFindRequest === 'function') {
    window.aegisAPI.onFindRequest(() => openFindbar());
  }
}

// ---- Downloads indicator ----
function setupDownloads() {
  const btn = $('btn-downloads');
  if (!btn) return;
  btn.onclick = (e) => {
    e.stopPropagation();
    if (!window.aegisAPI || typeof window.aegisAPI.openPopup !== 'function') return;
    const r = btn.getBoundingClientRect();
    window.aegisAPI.openPopup('downloads', { left: r.left, right: r.right, top: r.top, bottom: r.bottom });
  };
  if (typeof window.aegisAPI.onDownloadsUpdated === 'function') {
    window.aegisAPI.onDownloadsUpdated(list => {
      const active = (list || []).filter(d => d.state === 'progressing' || d.state === 'paused').length;
      btn.style.display = (list && list.length) ? '' : 'none';
      const badge = $('dl-badge');
      if (badge) {
        badge.textContent = active || '';
        badge.classList.toggle('active', active > 0);
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', init);
