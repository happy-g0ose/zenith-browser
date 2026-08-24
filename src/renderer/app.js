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

// Command Palette
const commandPalette = $('command-palette');
const paletteInput = $('palette-input');
const paletteResults = $('palette-results');

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
  setupCommandPalette();
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
      renderTabs();
    });
    window.aegisAPI.onShieldUpdated(() => {});
    window.aegisAPI.onCommandPaletteToggle(() => toggleCommandPalette());
    window.aegisAPI.onFocusOmnibox(() => { urlInput.focus(); urlInput.select(); });
    window.aegisAPI.onThemeChanged(t => document.body.setAttribute('data-theme', t));
  }
}

async function loadSearchEngine() {
  if (!window.aegisAPI) return;
  try {
    const engineKey = await window.aegisAPI.getPref('ui.search.default_engine');
    if (engineKey && SEARCH_ENGINES[engineKey]) {
      searchEngine = SEARCH_ENGINES[engineKey];
    }
  } catch (e) {}
  urlInput.placeholder = `Поиск (${searchEngine.name}) или ввод адреса...`;
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
  if (!bm || !bm.length) {
    bm = [
      { title: 'DuckDuckGo', url: 'https://duckduckgo.com' },
      { title: 'Fingerprint Lab', url: 'about:fingerprint' },
      { title: 'Settings', url: 'about:config' },
      { title: 'Customizer', url: 'about:customizer' },
      { title: 'Cover Your Tracks', url: 'https://coveryourtracks.eff.org' },
      { title: 'IP Leak Test', url: 'https://ipleak.net' }
    ];
  }
  renderBookmarks(bm);
}

function renderBookmarks(bm) {
  if (!bookmarksBar) return;
  bookmarksBar.innerHTML = '';
  bm.forEach(item => {
    const el = document.createElement('div');
    el.className = 'bookmark-item';

    let dotColor = '#6e7681';
    if (item.url.includes('duckduckgo')) dotColor = '#de5833';
    else if (item.url.startsWith('about:fingerprint')) dotColor = '#d29922';
    else if (item.url.startsWith('about:config')) dotColor = '#6e7681';
    else if (item.url.startsWith('about:customizer')) dotColor = '#5b8def';
    else if (item.url.startsWith('about:profiles')) dotColor = '#3ecf8e';
    else if (item.url.includes('ipleak')) dotColor = '#e06c75';
    else if (item.url.includes('coveryourtracks') || item.url.includes('eff.org')) dotColor = '#98c379';

    el.innerHTML = `<span class="bm-dot" style="background: ${dotColor}"></span>${item.title}`;
    el.onclick = () => {
      if (activeTabId && window.aegisAPI) window.aegisAPI.navigateTab(activeTabId, item.url);
      else createTab(item.url);
    };
    bookmarksBar.appendChild(el);
  });
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

// Command Palette
const paletteCommands = [
  { title: 'New Tab',                    key: 'Ctrl+T',   action: () => createTab('about:newtab') },
  { title: 'New Incognito Tab',          key: 'Ctrl+Shift+N', action: () => createIncognitoTab('about:newtab') },
  { title: 'Fingerprint Audit Lab',      key: 'Internal', action: () => createTab('about:fingerprint') },
  { title: 'userChrome.css Studio',      key: 'Internal', action: () => createTab('about:customizer') },
  { title: 'Advanced Preferences',       key: 'Internal', action: () => createTab('about:config') },
  { title: 'Identity Profiles',          key: 'Internal', action: () => createTab('about:profiles') },
{ title: 'Extensions Store',           key: 'Internal', action: () => createTab('about:extensions') },
  { title: 'Generate Random Identity',   key: 'Stealth',  action: async () => {
    if (!window.aegisAPI) return;
    const p = await window.aegisAPI.generateRandomFingerprint();
    await window.aegisAPI.saveProfile(p);
    await window.aegisAPI.setActiveProfile(p.id);
    await loadActiveProfile();
  }},
  { title: 'Toggle Vertical Tabs',       key: 'Layout',   action: toggleVerticalTabs },
  { title: 'Theme: Stealth Dark',        key: 'Theme',    action: () => setTheme('stealth-dark') },
  { title: 'Theme: OLED Black',          key: 'Theme',    action: () => setTheme('oled-black') },
  { title: 'Theme: Nord',                key: 'Theme',    action: () => setTheme('nord') },
  { title: 'Theme: Tokyo Night',         key: 'Theme',    action: () => setTheme('tokyo-night') },
  { title: 'Theme: Gruvbox',             key: 'Theme',    action: () => setTheme('gruvbox') },
  { title: 'Theme: Paper Light',         key: 'Theme',    action: () => setTheme('paper-light') },
  { title: 'Reset Blocked Counter',      key: 'Privacy',  action: () => window.aegisAPI && window.aegisAPI.resetShieldStats() }
];

function setupCommandPalette() {
  commandPalette.onclick = e => { if (e.target === commandPalette) toggleCommandPalette(false); };
  paletteInput.addEventListener('input', () => renderPaletteResults(paletteInput.value));
  paletteInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') toggleCommandPalette(false);
    else if (e.key === 'Enter') {
      const first = paletteResults.querySelector('.palette-item');
      if (first) first.click();
    }
  });
}

function toggleCommandPalette(force = null) {
  const show = force !== null ? force : !commandPalette.classList.contains('visible');
  commandPalette.classList.toggle('visible', show);
  if (show) {
    paletteInput.value = '';
    renderPaletteResults('');
    setTimeout(() => paletteInput.focus(), 30);
  }
}

function renderPaletteResults(query = '') {
  paletteResults.innerHTML = '';
  const q = query.toLowerCase().trim();
  const filtered = paletteCommands.filter(c => c.title.toLowerCase().includes(q) || c.key.toLowerCase().includes(q));

  filtered.forEach((cmd, i) => {
    const el = document.createElement('div');
    el.className = `palette-item${i === 0 ? ' selected' : ''}`;
    el.innerHTML = `<span>${cmd.title}</span><span class="palette-item-shortcut">${cmd.key}</span>`;
    el.onclick = () => { toggleCommandPalette(false); cmd.action(); };
    paletteResults.appendChild(el);
  });
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
