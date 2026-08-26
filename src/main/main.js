const { app, BrowserWindow, WebContentsView, ipcMain, Menu, MenuItem, protocol, net, dialog, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Register custom schemes as privileged before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'zenith',
    privileges: { standard: true, secure: true, allowServiceWorkers: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true }
  },
  {
    scheme: 'aegis',
    privileges: { standard: true, secure: true, allowServiceWorkers: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true }
  }
]);

// App User Model ID for Windows Taskbar Icon grouping
if (process.platform === 'win32') {
  app.setAppUserModelId('com.zenith.browser');
}

// Chromium stealth & privacy command line switches
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

// Single instance lock: two browsers must never race on profile data & the Tor port
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

const configStore = require('./config-store');

// Chromium Force Dark: auto-darkens sites that have no dark mode (Google, etc.)
// Must be set before app is ready - requires restart to take effect
if (configStore.getPref('ui.force_dark', false)) {
  app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');
}

// prefers-color-scheme for sites: 'system' | 'dark' | 'light' (live)
nativeTheme.themeSource = configStore.getPref('ui.sites_theme', 'system');
const AdblockShield = require('./adblock-shield');
const TorManager = require('./tor-manager');
const ExtensionsManager = require('./extensions-manager');
const SessionManager = require('./session-manager');

// Initialize Shield, Tor daemon, Extensions & Session Manager
const adblockShield = new AdblockShield(configStore);
const torManager = new TorManager();
const extensionsManager = new ExtensionsManager(configStore);
const sessionManager = new SessionManager(configStore, adblockShield, torManager, extensionsManager);
sessionManager.onDownload = trackDownload;

let mainWindow = null;
let tabs = [];
let activeTabId = null;
let tabCounter = 0;
const closedTabs = [];

// ---- Favicons: fetched through the requesting tab's session (honors its
// proxy/Tor identity), cached on disk, served as data URLs ----
const crypto = require('crypto');
const faviconInflight = new Map();

function faviconCacheFile(url) {
  let host = url;
  try { host = new URL(url).origin; } catch (e) {}
  const hash = crypto.createHash('sha1').update(host).digest('hex').slice(0, 20);
  return path.join(app.getPath('userData'), 'favicons', hash + '.img');
}

function toDataURL(buf) {
  return 'data:image/png;base64,' + buf.toString('base64');
}

async function fetchFavicon(url, wc) {
  let origin;
  try { origin = new URL(url).origin; } catch (e) { return null; }
  if (!origin || origin === 'null') return null;

  const cacheFile = faviconCacheFile(origin);
  if (fs.existsSync(cacheFile)) {
    try { return toDataURL(fs.readFileSync(cacheFile)); } catch (e) {}
  }

  if (faviconInflight.has(origin)) return faviconInflight.get(origin);
  const promise = (async () => {
    try {
      const ses = wc && wc.session ? wc.session : undefined;
      const candidates = [
        origin + '/favicon.ico',
        'https://www.google.com/s2/favicons?domain=' + origin.replace(/^https?:\/\//, '') + '&sz=64'
      ];
      for (const candidate of candidates) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 6000);
          const res = await (ses ? ses.fetch(candidate, { signal: ctrl.signal }) : net.fetch(candidate, { signal: ctrl.signal }));
          clearTimeout(timer);
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 120 && buf.length < 500000) {
            fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
            fs.writeFileSync(cacheFile, buf);
            return toDataURL(buf);
          }
        } catch (e) {}
      }
    } finally {
      faviconInflight.delete(origin);
    }
    return null;
  })();
  faviconInflight.set(origin, promise);
  return promise;
}

// ---- Downloads registry ----
const downloads = new Map();
let downloadSeq = 0;

function broadcastDownloads() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('downloads:updated', [...downloads.values()]);
}

function trackDownload(item) {
  const id = 'dl_' + (++downloadSeq);
  const entry = {
    id,
    name: item.getFilename(),
    path: item.getSavePath(),
    received: item.getReceivedBytes(),
    total: item.getTotalBytes(),
    state: 'progressing'
  };
  downloads.set(id, entry);
  broadcastDownloads();
  item.on('updated', (_e, state) => {
    entry.received = item.getReceivedBytes();
    entry.total = item.getTotalBytes();
    entry.state = state === 'interrupted' ? 'paused' : 'progressing';
    broadcastDownloads();
  });
  item.once('done', (_e, state) => {
    entry.state = state === 'completed' ? 'done' : (state === 'interrupted' ? 'paused' : 'cancelled');
    entry.received = item.getReceivedBytes();
    broadcastDownloads();
  });
}

function activeView() {
  const t = tabs.find(x => x.id === activeTabId);
  return t && t.view ? t.view.webContents : null;
}

function zoomActive(delta) {
  const wc = activeView();
  if (!wc) return;
  wc.setZoomLevel(Math.max(-6, Math.min(7, wc.getZoomLevel() + delta)));
}

function buildContextMenu(wc, params) {
  const menu = new Menu();
  const add = (opts) => menu.append(new MenuItem(opts));

  if (params.linkURL) {
    add({ label: 'Открыть ссылку в новой вкладке', click: () => createTab(params.linkURL) });
    add({ label: 'Копировать адрес ссылки', click: () => require('electron').clipboard.writeText(params.linkURL) });
    add({ type: 'separator' });
  }
  if (params.hasImageContents && params.srcURL) {
    add({ label: 'Открыть изображение в новой вкладке', click: () => createTab(params.srcURL) });
    add({ label: 'Сохранить изображение', click: () => wc.downloadURL(params.srcURL) });
    add({ type: 'separator' });
  }
  if (params.isEditable) {
    add({ role: 'cut', label: 'Вырезать' });
    add({ role: 'copy', label: 'Копировать' });
    add({ role: 'paste', label: 'Вставить' });
    add({ type: 'separator' });
  } else if (params.selectionText.trim()) {
    add({ label: 'Копировать', role: 'copy' });
    add({ type: 'separator' });
  }
  add({ label: 'Назад', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() });
  add({ label: 'Вперёд', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() });
  add({ label: 'Перезагрузить', click: () => wc.reload() });
  add({ type: 'separator' });
  add({ label: 'Проверить элемент', click: () => { wc.inspectElement(params.x, params.y); } });

  menu.popup({ window: mainWindow });
}

// Internal pages registry: the ONLY local files reachable via zenith://, aegis:// or about:*
const PAGES_DIR = path.join(__dirname, '../renderer/pages');
const INTERNAL_PAGE_ROUTES = {
  newtab: 'newtab.html',
  config: 'config.html',
  settings: 'config.html',
  preferences: 'config.html',
  fingerprint: 'fingerprint.html',
  'fingerprint-lab': 'fingerprint.html',
  customizer: 'customizer.html',
  custom: 'customizer.html',
  userchrome: 'customizer.html',
  profiles: 'profiles.html',
  identities: 'profiles.html',
  extensions: 'extensions.html',
  addons: 'extensions.html'
};

function internalPageUrl(routeKey) {
  const fileName = INTERNAL_PAGE_ROUTES[routeKey] || 'newtab.html';
  return pathToFileURL(path.join(PAGES_DIR, fileName)).toString();
}

// Resolve Internal Pages
function resolvePageUrl(rawUrl) {
  if (!rawUrl) return internalPageUrl('newtab');

  const clean = rawUrl.trim().toLowerCase();
  if (clean === 'about:blank') {
    return 'about:blank';
  }

  if (clean.startsWith('about:')) {
    return internalPageUrl(clean.slice('about:'.length));
  }

  const schemeMatch = clean.match(/^(?:aegis|zenith):\/\/([a-z0-9-]+)/);
  if (schemeMatch) {
    return internalPageUrl(schemeMatch[1]);
  }

  return rawUrl;
}

function getDisplayUrl(resolvedUrl) {
  if (!resolvedUrl) return 'about:newtab';
  if (resolvedUrl.includes('newtab.html')) return 'about:newtab';
  if (resolvedUrl.includes('config.html')) return 'about:config';
  if (resolvedUrl.includes('fingerprint.html')) return 'about:fingerprint';
  if (resolvedUrl.includes('customizer.html')) return 'about:customizer';
  if (resolvedUrl.includes('profiles.html')) return 'about:profiles';
  if (resolvedUrl.includes('error.html')) return 'about:error';
  return resolvedUrl;
}

function getErrorPageUrl(failedUrl, description, errorCode) {
  const fileUrl = pathToFileURL(path.join(__dirname, '../renderer/pages/error.html'));
  fileUrl.searchParams.set('url', failedUrl || '');
  fileUrl.searchParams.set('desc', description || 'Неизвестная ошибка сети');
  fileUrl.searchParams.set('code', String(errorCode || 0));
  return fileUrl.toString();
}

function createMainWindow() {
  const iconIco = path.join(__dirname, '../../assets/icon.ico');
  const iconPng = path.join(__dirname, '../../assets/icon.png');
  const iconPath = process.platform === 'win32' ? iconIco : iconPng;

  mainWindow = new BrowserWindow({
    title: 'Zenith',
    width: 1300,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Frameless modern minimalist window
    backgroundColor: '#090a0f',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../stealth/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('resize', updateViewBounds);
  mainWindow.on('maximize', () => setTimeout(updateViewBounds, 50));
  mainWindow.on('unmaximize', () => setTimeout(updateViewBounds, 50));

  mainWindow.webContents.on('did-finish-load', () => {
    // Restore previous session or create initial tab
    if (tabs.length === 0) {
      restoreSession();
    }
  });
}

// Tab Management
async function createTab(initialUrl = 'about:newtab', profileId = null, isIncognito = false) {
  tabCounter++;
  const tabId = 'tab_' + tabCounter;
  const validProfile = profileId && configStore.getProfiles().some(p => p.id === profileId) ? profileId : null;
  const activeProfile = validProfile || configStore.getPref('browser.active_profile', 'profile_default');

  // Incognito: fresh random identity + in-memory session (no disk writes)
  let identityProfile = null;
  let ses;
  if (isIncognito) {
    identityProfile = configStore.generateIncognitoIdentity();
    ses = await sessionManager.createIncognitoSession(identityProfile);
  } else {
    ses = sessionManager.getOrCreateSession(activeProfile);
  }

  const tabProfile = isIncognito
    ? identityProfile
    : (configStore.getProfiles().find(p => p.id === activeProfile) || configStore.getActiveProfile());

  // contextIsolation is OFF here on purpose: the generated preload must run
  // in the page's main world at document_start to beat inline fingerprinting
  // scripts. The preload never exposes ipcRenderer, sandbox stays ON, and the
  // privileged bridge inside it only activates for built-in internal pages.
  const view = new WebContentsView({
    webPreferences: {
      session: ses,
      preload: sessionManager.getContentPreloadPath(tabProfile),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: true
    }
  });
  // Dark base color: prevents the white flash before the page paints
  view.setBackgroundColor('#0b0d11');

  sessionManager.attachUserContentCSS(view.webContents);

  const targetUrl = resolvePageUrl(initialUrl);
  view.webContents.loadURL(targetUrl);

  const tabData = {
    id: tabId,
    title: 'New Tab',
    url: initialUrl,
    profileId: activeProfile,
    incognito: isIncognito,
    view: view
  };

  tabs.push(tabData);

  // Setup WebContents listeners
  view.webContents.on('will-navigate', (e, url) => {
    const resolved = resolvePageUrl(url);
    if (resolved !== url) {
      e.preventDefault();
      view.webContents.loadURL(resolved);
    }
  });

  view.webContents.setWindowOpenHandler(({ url }) => {
    createTab(url, tabData.profileId, tabData.incognito);
    return { action: 'deny' };
  });

  view.webContents.on('did-start-navigation', (_e, url) => {
    tabData.url = getDisplayUrl(url);
    notifyTabsUpdatedSoon();
    if (tabId === activeTabId) {
      notifyActiveTabChanged();
    }
  });

  view.webContents.on('found-in-page', (_e, result) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('find:results', {
        matches: result.matches,
        active: result.activeMatchOrdinal
      });
    }
  });

  view.webContents.on('zoom-changed', (_e, dir) => {
    zoomActive(dir === 'in' ? 0.5 : -0.5);
  });

  view.webContents.on('context-menu', (_e, params) => {
    buildContextMenu(view.webContents, params);
  });

  view.webContents.on('page-title-updated', (_e, title) => {
    tabData.title = title;
    notifyTabsUpdatedSoon();
  });

  view.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    tabData.failedUrl = validatedURL || '';
    tabData.lastFailedUrl = validatedURL || '';
    tabData.title = 'Страница не загрузилась';
    view.webContents.loadURL(getErrorPageUrl(validatedURL, errorDescription, errorCode));
    notifyTabsUpdatedSoon();
  });

  view.webContents.on('did-finish-load', () => {
    tabData.title = view.webContents.getTitle() || 'Page';
    const currentUrl = view.webContents.getURL();
    if (tabData.failedUrl && currentUrl.includes('error.html')) {
      tabData.url = tabData.failedUrl;
      tabData.failedUrl = null;
    } else {
      tabData.lastFailedUrl = null;
      tabData.url = getDisplayUrl(currentUrl);
      if (!tabData.incognito) {
        configStore.addHistory({ title: tabData.title, url: tabData.url });
      }
    }
    notifyTabsUpdatedSoon();
    if (tabId === activeTabId) {
      notifyActiveTabChanged();
    }
  });

  // Switch to new tab
  switchTab(tabId);
  notifyTabsUpdated();

  return tabData;
}

function switchTab(tabId) {
  const targetTab = tabs.find(t => t.id === tabId);
  if (!targetTab) return;

  // Remove previous active view if any
  if (activeTabId && mainWindow) {
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab && currentTab.view) {
      try {
        mainWindow.contentView.removeChildView(currentTab.view);
      } catch (e) {}
    }
  }

  activeTabId = tabId;

  // Add target view
  if (mainWindow && targetTab.view) {
    mainWindow.contentView.addChildView(targetTab.view);
    updateViewBounds();
  }

  notifyActiveTabChanged();
}

function closeTab(tabId) {
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  const closingTab = tabs[index];
  // Keep for Ctrl+Shift+T restore (cap the stack)
  if (closingTab.url && !closingTab.url.startsWith('about:')) {
    closedTabs.push({ url: closingTab.url, profileId: closingTab.profileId, incognito: closingTab.incognito });
    if (closedTabs.length > 20) closedTabs.shift();
  }
  if (closingTab.view && mainWindow) {
    try {
      mainWindow.contentView.removeChildView(closingTab.view);
    } catch (e) {}
  }

  tabs.splice(index, 1);

  if (tabs.length === 0) {
    // If no tabs left, open new tab
    createTab('about:newtab');
  } else if (activeTabId === tabId) {
    // Switch to adjacent tab
    const nextTab = tabs[Math.max(0, index - 1)];
    switchTab(nextTab.id);
  }

  notifyTabsUpdated();
}

function restoreClosedTab() {
  const snap = closedTabs.pop();
  if (!snap) return;
  createTab(snap.url, snap.profileId, snap.incognito);
}

function updateViewBounds() {
  if (!mainWindow || !activeTabId) return;

  const currentTab = tabs.find(t => t.id === activeTabId);
  if (!currentTab || !currentTab.view) return;

  const [winWidth, winHeight] = mainWindow.getSize();
  // Layout metrics follow the customizer (ui.custom.layout), clamped
  const layout = configStore.getPref('ui.custom.layout', null) || {};
  const hide = layout.hide || {};
  const sizes = layout.sizes || {};
  const clamp = (v, min, max, def) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
  };
  const tabstripHeight = clamp(sizes.tabstrip, 26, 56, 38);
  const navHeight = clamp(sizes.navbar, 30, 64, 40);
  const bookmarksHeight = clamp(sizes.bookmarks, 22, 48, 28);
  const topOffset = tabstripHeight
    + (hide.navbar ? 0 : navHeight)
    + (hide.bookmarks ? 0 : bookmarksHeight);

  const isVertical = configStore.getPref('ui.tabs.position', 'top') === 'left';
  const sidebarWidth = isVertical ? 220 : 0;

  const viewX = sidebarWidth;
  const viewY = topOffset;
  const viewWidth = Math.max(0, winWidth - sidebarWidth);
  const viewHeight = Math.max(0, winHeight - topOffset);

  currentTab.view.setBounds({
    x: viewX,
    y: viewY,
    width: viewWidth,
    height: viewHeight
  });
}

function notifyTabsUpdated() {
  if (!mainWindow) return;
  const serializedTabs = tabs.map(t => ({
    id: t.id,
    title: t.title,
    url: t.url,
    profileId: t.profileId,
    incognito: t.incognito
  }));
  mainWindow.webContents.send('tabs:updated', serializedTabs);
  scheduleSessionSave();
}

// did-start-navigation fires on every frame navigation: batch the renderer
// updates (and the disk write) so the shell is not flooded with IPC churn
let tabsNotifyTimer = null;
function notifyTabsUpdatedSoon() {
  clearTimeout(tabsNotifyTimer);
  tabsNotifyTimer = setTimeout(notifyTabsUpdated, 120);
}

// Session persistence (restore tabs after restart)
let sessionSaveTimer = null;
function saveSessionState() {
  // Async write: the session list changes on every navigation, so never block
  // the main process on disk I/O here
  configStore.prefs['browser.last_session'] = tabs.filter(t => !t.incognito).map(t => ({ url: t.url, profileId: t.profileId }));
  configStore.writeJSONAsync(configStore.configFile, configStore.prefs);
}

function scheduleSessionSave() {
  if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(saveSessionState, 600);
}

function restoreSession() {
  const lastSession = configStore.getPref('browser.last_session');
  if (Array.isArray(lastSession) && lastSession.length > 0 && lastSession[0]) {
    lastSession.forEach(item => createTab(item && item.url ? item.url : 'about:newtab', item ? item.profileId : null));
  } else {
    createTab('about:newtab');
  }
}

function notifyActiveTabChanged() {
  if (!mainWindow || !activeTabId) return;
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (!currentTab || !currentTab.view) return;

  const wc = currentTab.view.webContents;
  const canBack = wc.navigationHistory ? wc.navigationHistory.canGoBack() : (wc.canGoBack ? wc.canGoBack() : false);
  const canFwd = wc.navigationHistory ? wc.navigationHistory.canGoForward() : (wc.canGoForward ? wc.canGoForward() : false);

  // Icons of extensions loaded into this tab's session
  let extIcons = [];
  try {
    extIcons = extensionsManager.getLoadedMeta(wc.session);
  } catch (e) {}

  mainWindow.webContents.send('tabs:active-changed', {
    id: currentTab.id,
    title: currentTab.title,
    url: currentTab.url,
    canGoBack: canBack,
    canGoForward: canFwd,
    extIcons
  });

  // Also send shield stats
  mainWindow.webContents.send('shield:updated', adblockShield.getStats(currentTab.profileId));
}

// Register IPC Handlers
function setupIPCHandlers() {
  // Defense-in-depth: only our own renderer documents may talk over IPC,
  // regardless of what any preload exposes.
  const rawHandle = ipcMain.handle.bind(ipcMain);
  const rawOn = ipcMain.on.bind(ipcMain);
  const isTrustedSender = (event) => {
    try {
      const senderUrl = (event.senderFrame && event.senderFrame.url) || '';
      return senderUrl.startsWith('file:') && senderUrl.includes('/renderer/');
    } catch (e) {
      return false;
    }
  };
  ipcMain.handle = (channel, listener) => rawHandle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error(`Unauthorized IPC call to ${channel}`);
    return listener(event, ...args);
  });
  ipcMain.on = (channel, listener) => rawOn(channel, (event, ...args) => {
    if (!isTrustedSender(event)) return;
    listener(event, ...args);
  });

  // Preferences
  ipcMain.handle('prefs:get-all', () => configStore.getAllPrefs());
  ipcMain.handle('prefs:get', (_e, key) => configStore.getPref(key));
  ipcMain.handle('prefs:set', (_e, key, val) => {
    configStore.setPref(key, val);
    if (key === 'ui.theme') {
      mainWindow.webContents.send('theme:changed', val);
    }
    if (key === 'ui.search.default_engine') {
      mainWindow.webContents.send('engine:changed', val);
    }
    if (key === 'ui.custom.overrides') {
      mainWindow.webContents.send('custom:changed', val);
    }
    if (key === 'ui.sites_theme') {
      const mode = ['system', 'dark', 'light'].includes(val) ? val : 'system';
      nativeTheme.themeSource = mode;
    }
    if (key === 'ui.custom.layout') {
      mainWindow.webContents.send('custom:layout', val);
      updateViewBounds();
    }
  });
  ipcMain.handle('prefs:reset', (_e, key) => configStore.resetPref(key));

  // Profiles
  ipcMain.handle('profiles:get-all', () => configStore.getProfiles());
  ipcMain.handle('profiles:get-active', () => configStore.getActiveProfile());
  ipcMain.handle('profiles:set-active', (_e, id) => {
    configStore.setPref('browser.active_profile', id);
    return true;
  });
  ipcMain.handle('profiles:save', (_e, profile) => configStore.saveProfile(profile));
  ipcMain.handle('profiles:delete', (_e, id) => configStore.deleteProfile(id));
  ipcMain.handle('profiles:generate-random', (_e, name) => configStore.generateRandomFingerprint(name));

  // CSS Customizer
  ipcMain.handle('css:get-userchrome', () => configStore.getUserChromeCSS());
  ipcMain.handle('css:set-userchrome', (_e, css) => configStore.setUserChromeCSS(css));
  ipcMain.handle('css:get-usercontent', () => configStore.getUserContentCSS());
  ipcMain.handle('css:set-usercontent', (_e, css) => configStore.setUserContentCSS(css));
  ipcMain.handle('css:reload-ui', () => {
    updateViewBounds();
  });

  // Shield
  ipcMain.handle('shield:get-stats', () => adblockShield.getStats());
  ipcMain.handle('shield:reset-stats', () => {
    adblockShield.resetStats();
    notifyActiveTabChanged();
    return true;
  });

  // Tor status
  ipcMain.handle('tor:status', () => torManager.status());
  ipcMain.handle('tor:start', async () => {
    await torManager.ensureRunning();
    return torManager.status();
  });

  // Extensions Store
  ipcMain.handle('ext:list', () => extensionsManager.listInstalled());
  ipcMain.handle('ext:chrome-candidates', () => extensionsManager.chromeCandidates());
  ipcMain.handle('ext:import', (_e, payload) => {
    const p = payload || {};
    if (typeof p.sourcePath !== 'string' || !p.sourcePath) return { ok: false, error: 'bad path' };
    return extensionsManager.importFromPath(p.sourcePath, typeof p.chromeId === 'string' ? p.chromeId : null);
  });
  ipcMain.handle('ext:install-folder', () => extensionsManager.installFromFolderDialog());
  ipcMain.handle('ext:toggle', (_e, { id, enabled }) => {
    const res = extensionsManager.toggle(String(id), !!enabled);
    notifyActiveTabChanged();
    return res;
  });
  ipcMain.handle('ext:uninstall', (_e, id) => {
    const res = extensionsManager.uninstall(String(id));
    notifyActiveTabChanged();
    return res;
  });

  // Bookmarks & History
  const bookmarksChanged = () => mainWindow && mainWindow.webContents.send('bookmarks:changed');
  ipcMain.handle('bookmarks:get', () => configStore.getBookmarks());
  ipcMain.handle('bookmarks:add', (_e, b) => { const r = configStore.addBookmark(b); bookmarksChanged(); return r; });
  ipcMain.handle('bookmarks:remove', (_e, url) => { configStore.removeBookmark(url); bookmarksChanged(); });
  ipcMain.handle('bookmarks:add-folder', (_e, name) => { const r = configStore.addFolder(name); bookmarksChanged(); return r; });
  ipcMain.handle('bookmarks:add-to-folder', (_e, { folderId, item }) => {
    const r = configStore.addItemToFolder(folderId, item);
    bookmarksChanged();
    return r;
  });
  ipcMain.handle('history:get', () => configStore.getHistory());
  ipcMain.handle('history:clear', () => configStore.clearHistory());

  // Tabs Actions
  ipcMain.handle('tabs:create', async (_e, { url, profileId, incognito }) => {
    const tab = await createTab(url, profileId, incognito);
    return { id: tab.id, title: tab.title, url: tab.url, profileId: tab.profileId, incognito: !!tab.incognito };
  });
  ipcMain.handle('tabs:switch', (_e, tabId) => switchTab(tabId));
  ipcMain.handle('tabs:close', (_e, tabId) => closeTab(tabId));
  ipcMain.handle('tabs:reload', (_e, tabId) => {
    const t = tabs.find(x => x.id === tabId);
    if (!t || !t.view) return;
    // After a failed load the tab shows error.html - reload must retry the
    // original URL, not refresh the error page itself
    if (t.lastFailedUrl) {
      const url = t.lastFailedUrl;
      t.lastFailedUrl = null;
      t.view.webContents.loadURL(resolvePageUrl(url));
    } else {
      t.view.webContents.reload();
    }
  });
  ipcMain.handle('tabs:back', (_e, tabId) => {
    const t = tabs.find(x => x.id === tabId);
    if (t && t.view) {
      const wc = t.view.webContents;
      if (wc.navigationHistory && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
      else if (wc.canGoBack && wc.canGoBack()) wc.goBack();
    }
  });
  ipcMain.handle('tabs:forward', (_e, tabId) => {
    const t = tabs.find(x => x.id === tabId);
    if (t && t.view) {
      const wc = t.view.webContents;
      if (wc.navigationHistory && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
      else if (wc.canGoForward && wc.canGoForward()) wc.goForward();
    }
  });
  ipcMain.handle('tabs:navigate', (_e, { tabId, url }) => {
    const t = tabs.find(x => x.id === tabId);
    if (t && t.view) {
      t.view.webContents.loadURL(resolvePageUrl(url));
    }
  });
  ipcMain.handle('tabs:navigate-current', (_e, url) => {
    if (!activeTabId) return;
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab && currentTab.view) {
      currentTab.view.webContents.loadURL(resolvePageUrl(url));
    }
  });
  ipcMain.handle('tabs:devtools', (_e, tabId) => {
    const t = tabs.find(x => x.id === tabId);
    if (t && t.view) {
      if (t.view.webContents.isDevToolsOpened()) {
        t.view.webContents.closeDevTools();
      } else {
        t.view.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });
  ipcMain.handle('tabs:reorder', (_e, { id, beforeId }) => {
    const from = tabs.findIndex(t => t.id === id);
    if (from === -1) return;
    const [moved] = tabs.splice(from, 1);
    let to = beforeId ? tabs.findIndex(t => t.id === beforeId) : tabs.length;
    if (to === -1) to = tabs.length;
    tabs.splice(to, 0, moved);
    notifyTabsUpdated();
  });

  // Zoom for the active tab
  ipcMain.on('zoom:in', () => zoomActive(0.5));
  ipcMain.on('zoom:out', () => zoomActive(-0.5));
  ipcMain.on('zoom:reset', () => {
    const wc = activeView();
    if (wc) wc.setZoomLevel(0);
  });

  // Downloads
  ipcMain.handle('downloads:get', () => [...downloads.values()]);
  ipcMain.handle('downloads:open', (_e, id) => {
    const d = downloads.get(id);
    if (d && d.path && fs.existsSync(d.path)) shell.openPath(d.path);
  });
  ipcMain.handle('downloads:show', (_e, id) => {
    const d = downloads.get(id);
    if (d && d.path && fs.existsSync(d.path)) shell.showItemInFolder(d.path);
  });

  // Find in page (drives the shell find bar)
  ipcMain.handle('find:start', (_e, { text, forward, findNext }) => {
    const t = tabs.find(x => x.id === activeTabId);
    if (!t || !t.view || !text) return null;
    t.view.webContents.findInPage(text, { forward: forward !== false, findNext: !!findNext });
    return true;
  });
  ipcMain.handle('find:stop', () => {
    const t = tabs.find(x => x.id === activeTabId);
    if (t && t.view) t.view.webContents.stopFindInPage('clearSelection');
  });

  // New tab wallpaper
  ipcMain.handle('wallpaper:set-image', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Выберите изображение для новой вкладки',
      properties: ['openFile'],
      filters: [{ name: 'Изображения', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }]
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const dest = path.join(app.getPath('userData'), 'newtab-wallpaper' + path.extname(res.filePaths[0]).toLowerCase());
    fs.copyFileSync(res.filePaths[0], dest);
    const pref = 'file:///' + dest.replace(/\\/g, '/');
    configStore.setPref('ui.newtab.wallpaper', pref);
    mainWindow.webContents.send('wallpaper:changed', pref);
    return pref;
  });
  ipcMain.handle('wallpaper:set-preset', (_e, value) => {
    configStore.setPref('ui.newtab.wallpaper', String(value));
    mainWindow.webContents.send('wallpaper:changed', String(value));
  });

  // Favicons (fetched via the requesting tab's session; no tabId = active tab)
  ipcMain.handle('favicon:get', (_e, { url, tabId }) => {
    const t = tabId ? tabs.find(x => x.id === tabId) : tabs.find(x => x.id === activeTabId);
    const wc = t && t.view ? t.view.webContents : null;
    return fetchFavicon(url, wc);
  });

  ipcMain.handle('history:remove', (_e, url) => {
    configStore.removeHistoryItem(url);
  });

  // Window & Overlay Controls
  ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow && mainWindow.close());

  // ---- Popup windows (shield / main menu) ----
  // Rendered in a frameless child window floating ABOVE the page view, so the
  // page stays visible while open - it is only dimmed via injected CSS.
  const POPUP_DIM_CSS = 'html{filter:brightness(.5) saturate(.85);animation:zenithDimIn .18s ease-out}@keyframes zenithDimIn{from{filter:none}to{filter:brightness(.5) saturate(.85)}}';
  // Electron 34 has WebContents.insertCSS but NO removeCSS - the only reliable
  // way to toggle page dimming is an idempotent <style id> element.
  const DIM_ON_JS = `(function(){var s=document.getElementById('zenith-dim-style');if(!s){s=document.createElement('style');s.id='zenith-dim-style';s.textContent=${JSON.stringify(POPUP_DIM_CSS)};document.documentElement.appendChild(s);}})()`;
  const DIM_OFF_JS = `(function(){var s=document.getElementById('zenith-dim-style');if(s)s.parentNode.removeChild(s);})()`;
  const POPUP_SIZES = { shield: { w: 268, h: 430 }, menu: { w: 288, h: 492 }, palette: { w: 540, h: 360 }, engine: { w: 240, h: 224 }, extlist: { w: 300, h: 480 }, folder: { w: 264, h: 320 }, bmadd: { w: 300, h: 430 }, downloads: { w: 330, h: 420 } };
  let popupWin = null;
  let popupDim = null; // { wc }
  let popupLastClosedAt = 0;

  function dimActivePage() {
    try {
      const t = tabs.find(x => x.id === activeTabId);
      if (!t || !t.view) return;
      popupDim = { wc: t.view.webContents };
      t.view.webContents.executeJavaScript(DIM_ON_JS, true).catch(() => {});
    } catch (e) {}
  }

  function undimPage() {
    const entry = popupDim;
    if (!entry) return;
    popupDim = null;
    try { entry.wc.executeJavaScript(DIM_OFF_JS, true).catch(() => {}); } catch (e) {}
  }

  function closePopupWindow() {
    if (popupWin && !popupWin.isDestroyed()) popupWin.destroy();
    popupWin = null;
    undimPage();
    popupLastClosedAt = Date.now();
  }

  function openPopupWindow(type, rect, data = null) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const wasOpen = popupWin && !popupWin.isDestroyed();
    const sameType = wasOpen && popupWin.__type === type;
    closePopupWindow();
    // Clicking the same trigger again while open = toggle off (the blur-close
    // from the mousedown already destroyed the window)
    if (sameType) return;

    const size = POPUP_SIZES[type] || POPUP_SIZES.menu;
    const cb = mainWindow.getContentBounds();
    const wx = cb.x, wy = cb.y, ww = cb.width;
    let x = wx + ww - size.w - 10;
    let y = wy + 86;
    if (type === 'palette') {
      x = wx + Math.round((ww - size.w) / 2);
      y = wy + 64;
    } else if (type === 'engine' && rect && typeof rect.left === 'number') {
      x = Math.max(wx + 8, wx + rect.left - 8);
      y = wy + (rect.bottom || 84) + 10;
    } else {
      if (rect && typeof rect.right === 'number') {
        x = Math.max(wx + 8, Math.min(wx + rect.right - size.w + 14, wx + ww - size.w - 8));
      }
      if (rect && typeof rect.bottom === 'number') {
        y = Math.min(wy + rect.bottom + 10, wy + 620);
      }
    }

    popupWin = new BrowserWindow({
      x, y,
      width: size.w,
      height: size.h,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      parent: mainWindow,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '../stealth/preload-content.js'),
        contextIsolation: false,
        nodeIntegration: false,
        sandbox: true
      }
    });
    popupWin.__type = type;
    popupWin.setAlwaysOnTop(true, 'screen-saver');
    popupWin.on('blur', () => closePopupWindow());
    popupWin.on('closed', () => {
      popupWin = null;
      undimPage();
      popupLastClosedAt = Date.now();
    });
    popupWin.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error(`[Zenith] Popup ${type} failed to load (${code} ${desc}): ${url}`);
    });
    popupWin.webContents.on('console-message', (e, level, message) => {
      if (level >= 2) console.warn(`[Zenith][popup:${type}]`, message);
    });
    popupWin.loadFile(path.join(__dirname, '../renderer/pages/popup.html'), {
      search: 'panel=' + type + (data && data.id ? '&id=' + encodeURIComponent(data.id) : '')
    });
    let shown = false;
    const doShow = () => {
      if (shown || !popupWin || popupWin.isDestroyed()) return;
      shown = true;
      try {
        popupWin.show();
        popupWin.focus();
      } catch (e) {
        console.error('[Zenith] Popup show failed:', e.message);
      }
    };
    popupWin.once('ready-to-show', doShow);
    // Fallback: transparent/child windows occasionally never emit ready-to-show
    setTimeout(doShow, 1200);
    dimActivePage();
  }

  ipcMain.on('popup:open', (_e, payload) => {
    const p = payload || {};
    const type = ['shield', 'menu', 'palette', 'engine', 'extlist', 'folder', 'bmadd', 'downloads'].includes(p.type) ? p.type : 'menu';
    // Folder popups size themselves by the number of quick links inside
    const rect = p.rect;
    if (type === 'folder' && p.data && typeof p.data.count === 'number') {
      POPUP_SIZES.folder.h = Math.min(480, 74 + p.data.count * 36);
    }
    openPopupWindow(type, rect, p.data);
  });
  ipcMain.on('popup:close', () => closePopupWindow());
}

// Window-local accelerators via application menu (NOT system-wide global shortcuts)
function setupAppMenu() {
  const toggleDevTools = () => {
    if (!activeTabId) return;
    const t = tabs.find(x => x.id === activeTabId);
    if (t && t.view) {
      if (t.view.webContents.isDevToolsOpened()) {
        t.view.webContents.closeDevTools();
      } else {
        t.view.webContents.openDevTools({ mode: 'detach' });
      }
    }
  };

  const template = [
    {
      label: '&Файл',
      submenu: [
        { label: 'Новая вкладка', accelerator: 'CommandOrControl+T', click: () => createTab('about:newtab') },
        { label: 'Новая инкогнито-вкладка', accelerator: 'CommandOrControl+Shift+N', click: () => createTab('about:newtab', null, true) },
        { label: 'Закрыть вкладку', accelerator: 'CommandOrControl+W', click: () => { if (activeTabId) closeTab(activeTabId); } },
        { label: 'Вернуть закрытую вкладку', accelerator: 'CommandOrControl+Shift+T', click: () => restoreClosedTab() },
        { label: 'Новое окно поиска на странице', accelerator: 'CommandOrControl+F', click: () => mainWindow && mainWindow.webContents.send('action:find') },
        { type: 'separator' },
        { role: 'quit', label: 'Выход' }
      ]
    },
    {
      label: '&Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выделить всё' }
      ]
    },
    {
      label: '&Вид',
      submenu: [
        { label: 'Командная палитра', accelerator: 'CommandOrControl+K', click: () => mainWindow && mainWindow.webContents.send('action:toggle-palette') },
        { label: 'Адресная строка', accelerator: 'CommandOrControl+L', click: () => mainWindow && mainWindow.webContents.send('action:focus-omnibox') },
        { type: 'separator' },
        { label: 'Инструменты разработчика', accelerator: 'F12', click: toggleDevTools },
        { label: 'Расширения', accelerator: 'CommandOrControl+Shift+E', click: () => {
          if (!activeTabId) return;
          const t = tabs.find(x => x.id === activeTabId);
          if (t && t.view) t.view.webContents.loadURL(resolvePageUrl('about:extensions'));
        } }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// App lifecycle
process.on('uncaughtException', (err) => {
  // A browser must not die on a single unhandled main-process error:
  // log loudly and keep running instead of showing a modal crash dialog.
  console.error('[Zenith] Uncaught main-process error:', err && err.stack ? err.stack : err);
});

app.whenReady().then(() => {
  // Real DNS-over-HTTPS (privacy.shield / network.doh prefs)
  try {
    if (configStore.getPref('network.doh.enabled', true) && typeof app.configureHostResolver === 'function') {
      app.configureHostResolver({
        enableDOH: true,
        serverURL: configStore.getPref('network.doh.provider', 'https://cloudflare-dns.com/dns-query'),
        insecureDNSClientEnabled: true,
        insecureFallbackConnsEnabled: false
      });
    }
  } catch (e) {
    console.warn('Zenith: DoH setup failed:', e.message);
  }

  // Protocol Handlers for internal pages.
  // Whitelist-only: an unknown zenith://host must never resolve to a
  // caller-controlled local path under this CSP-bypassing privileged scheme.
  const handleInternalProtocol = (request) => {
    let host = '';
    try {
      host = new URL(request.url).hostname.toLowerCase();
    } catch (e) {}
    const pageFile = INTERNAL_PAGE_ROUTES[host];
    if (!pageFile) {
      return new Response('Not Found', { status: 404 });
    }
    return net.fetch(pathToFileURL(path.join(PAGES_DIR, pageFile)).toString());
  };

  try {
    protocol.handle('zenith', handleInternalProtocol);
    protocol.handle('aegis', handleInternalProtocol);
  } catch(e) {
    console.warn('Protocol handler setup error:', e);
  }

  setupIPCHandlers();
  createMainWindow();
  setupAppMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Save open tabs and stop the Tor daemon before quitting
app.on('before-quit', () => {
  saveSessionState();
  torManager.stop();
});
