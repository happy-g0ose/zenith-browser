const { contextBridge, ipcRenderer } = require('electron');

// The full shell bridge is exposed ONLY to the browser UI document
// (src/renderer/index.html). Never to web content.
const isInternalPage = (() => {
  try {
    if (window.location.protocol !== 'file:') return false;
    return decodeURIComponent(window.location.pathname).includes('/renderer/index.html');
  } catch (e) {
    return false;
  }
})();

// If internal UI or internal page, expose the Aegis API bridge
if (isInternalPage) {
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
    addFolder: (name) => ipcRenderer.invoke('bookmarks:add-folder', name),
    addItemToFolder: (folderId, b) => ipcRenderer.invoke('bookmarks:add-to-folder', { folderId, item: b }),
    getHistory: () => ipcRenderer.invoke('history:get'),
    clearHistory: () => ipcRenderer.invoke('history:clear'),
    removeHistory: (url) => ipcRenderer.invoke('history:remove', url),
    getFavicon: (url, tabId) => ipcRenderer.invoke('favicon:get', { url, tabId }),
    importOperaCookies: () => ipcRenderer.invoke('cookies:import-opera'),
    onBookmarksChanged: (callback) => ipcRenderer.on('bookmarks:changed', () => callback()),

    // Tabs Actions
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
    reorderTab: (id, beforeId) => ipcRenderer.invoke('tabs:reorder', { id, beforeId }),

    // Zoom
    zoomIn: () => ipcRenderer.send('zoom:in'),
    zoomOut: () => ipcRenderer.send('zoom:out'),
    zoomReset: () => ipcRenderer.send('zoom:reset'),

    // Find in page
    findStart: (text, forward, findNext) => ipcRenderer.invoke('find:start', { text, forward, findNext }),
    findStop: () => ipcRenderer.invoke('find:stop'),
    onFindResults: (cb) => ipcRenderer.on('find:results', (_e, r) => cb(r)),
    onFindRequest: (cb) => ipcRenderer.on('action:find', () => cb()),

    // Downloads
    getDownloads: () => ipcRenderer.invoke('downloads:get'),
    openDownload: (id) => ipcRenderer.invoke('downloads:open', id),
    showDownloadInFolder: (id) => ipcRenderer.invoke('downloads:show', id),
    onDownloadsUpdated: (cb) => ipcRenderer.on('downloads:updated', (_e, list) => cb(list)),

    // New tab wallpaper
    setWallpaperImage: (target) => ipcRenderer.invoke('wallpaper:set-image', target === 'topbar' ? 'topbar' : 'newtab'),
    setWallpaperPreset: (value, target) => ipcRenderer.invoke('wallpaper:set-preset', value, target === 'topbar' ? 'topbar' : 'newtab'),
    onWallpaperChanged: (cb) => ipcRenderer.on('wallpaper:changed', (_e, v) => cb(v)),
    
    // Window & Overlay control
    minimizeWindow: () => ipcRenderer.send('window:minimize'),
    maximizeWindow: () => ipcRenderer.send('window:maximize'),
    closeWindow: () => ipcRenderer.send('window:close'),
    openPopup: (type, rect) => ipcRenderer.send('popup:open', { type, rect }),
    closePopup: () => ipcRenderer.send('popup:close'),

    // Events subscription
    onTabsUpdated: (callback) => ipcRenderer.on('tabs:updated', (_e, data) => callback(data)),
    onActiveTabChanged: (callback) => ipcRenderer.on('tabs:active-changed', (_e, data) => callback(data)),
    onShieldUpdated: (callback) => ipcRenderer.on('shield:updated', (_e, data) => callback(data)),
    onCommandPaletteToggle: (callback) => ipcRenderer.on('action:toggle-palette', (_e) => callback()),
    onFocusOmnibox: (callback) => ipcRenderer.on('action:focus-omnibox', (_e) => callback()),
    onPageDarken: (callback) => ipcRenderer.on('overlay:page-darken', (_e, dataUrl) => callback(dataUrl)),
    onThemeChanged: (callback) => ipcRenderer.on('theme:changed', (_e, theme) => callback(theme)),
    onEngineChanged: (callback) => ipcRenderer.on('engine:changed', (_e, engine) => callback(engine)),
    onCustomChanged: (callback) => ipcRenderer.on('custom:changed', (_e, overrides) => callback(overrides)),
    onLayoutChanged: (callback) => ipcRenderer.on('custom:layout', (_e, layout) => callback(layout))
  });
}
