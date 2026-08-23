const { contextBridge, ipcRenderer } = require('electron');

// Strict allow-list: the privileged bridge is exposed ONLY to built-in pages
// shipped inside <app>/src/renderer/pages/. Remote sites (even ones with
// "/pages/" in their URL) and arbitrary local files never match.
const INTERNAL_PAGE_NAMES = new Set([
  'newtab.html',
  'config.html',
  'customizer.html',
  'profiles.html',
  'fingerprint.html',
  'error.html'
]);

function isInternalPage() {
  try {
    const loc = window.location;
    if (loc.protocol !== 'file:') return false;
    const pagePath = decodeURIComponent(loc.pathname);
    if (!pagePath.includes('/renderer/pages/')) return false;
    return INTERNAL_PAGE_NAMES.has(pagePath.slice(pagePath.lastIndexOf('/') + 1));
  } catch (e) {
    return false;
  }
}

if (isInternalPage()) {
  contextBridge.exposeInMainWorld('aegisAPI', {
    // Preferences (about:config)
    getAllPrefs: () => ipcRenderer.invoke('prefs:get-all'),
    getPref: (key) => ipcRenderer.invoke('prefs:get', key),
    setPref: (key, val) => ipcRenderer.invoke('prefs:set', key, val),
    resetPref: (key) => ipcRenderer.invoke('prefs:reset', key),

    // Profiles & Anti-detect
    getProfiles: () => ipcRenderer.invoke('profiles:get-all'),
    getActiveProfile: () => ipcRenderer.invoke('profiles:get-active'),
    setActiveProfile: (id) => ipcRenderer.invoke('profiles:set-active', id),
    saveProfile: (profile) => ipcRenderer.invoke('profiles:save', profile),
    deleteProfile: (id) => ipcRenderer.invoke('profiles:delete', id),
    generateRandomFingerprint: (name) => ipcRenderer.invoke('profiles:generate-random', name),

    // Customization (userChrome.css / userContent.css)
    getUserChromeCSS: () => ipcRenderer.invoke('css:get-userchrome'),
    setUserChromeCSS: (css) => ipcRenderer.invoke('css:set-userchrome', css),
    getUserContentCSS: () => ipcRenderer.invoke('css:get-usercontent'),
    setUserContentCSS: (css) => ipcRenderer.invoke('css:set-usercontent', css),
    reloadUIStyles: () => ipcRenderer.invoke('css:reload-ui'),

    // AdBlock & Shield Stats
    getShieldStats: () => ipcRenderer.invoke('shield:get-stats'),
    resetShieldStats: () => ipcRenderer.invoke('shield:reset-stats'),
    getTorStatus: () => ipcRenderer.invoke('tor:status'),
    startTor: () => ipcRenderer.invoke('tor:start'),

    // Bookmarks & History
    getBookmarks: () => ipcRenderer.invoke('bookmarks:get'),
    addBookmark: (b) => ipcRenderer.invoke('bookmarks:add', b),
    removeBookmark: (url) => ipcRenderer.invoke('bookmarks:remove', url),
    getHistory: () => ipcRenderer.invoke('history:get'),
    clearHistory: () => ipcRenderer.invoke('history:clear'),

    // Tab & Navigation controls
    createNewTab: (url, profileId) => ipcRenderer.invoke('tabs:create', { url, profileId }),
    createIncognitoTab: (url) => ipcRenderer.invoke('tabs:create', { url, incognito: true }),
    switchTab: (tabId) => ipcRenderer.invoke('tabs:switch', tabId),
    closeTab: (tabId) => ipcRenderer.invoke('tabs:close', tabId),
    reloadTab: (tabId) => ipcRenderer.invoke('tabs:reload', tabId),
    goBack: (tabId) => ipcRenderer.invoke('tabs:back', tabId),
    goForward: (tabId) => ipcRenderer.invoke('tabs:forward', tabId),
    navigateTab: (tabId, url) => ipcRenderer.invoke('tabs:navigate', { tabId, url }),
    navigateCurrent: (url) => ipcRenderer.invoke('tabs:navigate-current', url),
    toggleDevTools: (tabId) => ipcRenderer.invoke('tabs:devtools', tabId),

    // Window & Overlay control
    minimizeWindow: () => ipcRenderer.send('window:minimize'),
    maximizeWindow: () => ipcRenderer.send('window:maximize'),
    closeWindow: () => ipcRenderer.send('window:close'),
    setOverlayActive: (active) => ipcRenderer.send('overlay:set-active', active),

    // Events subscription
    onTabsUpdated: (callback) => ipcRenderer.on('tabs:updated', (_e, data) => callback(data)),
    onActiveTabChanged: (callback) => ipcRenderer.on('tabs:active-changed', (_e, data) => callback(data)),
    onShieldUpdated: (callback) => ipcRenderer.on('shield:updated', (_e, data) => callback(data)),
    onCommandPaletteToggle: (callback) => ipcRenderer.on('action:toggle-palette', (_e) => callback()),
    onFocusOmnibox: (callback) => ipcRenderer.on('action:focus-omnibox', (_e) => callback()),
    onPageDarken: (callback) => ipcRenderer.on('overlay:page-darken', (_e, dataUrl) => callback(dataUrl)),
    onThemeChanged: (callback) => ipcRenderer.on('theme:changed', (_e, theme) => callback(theme))
  });
}
