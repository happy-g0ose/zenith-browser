const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { app } = require('electron');

class ConfigStore {
  constructor() {
    // Plain Node contexts (e.g. `npm test`) have no Electron app: keep their
    // scratch data in the OS temp dir instead of polluting the project root.
    this.userDataPath = app ? app.getPath('userData') : path.join(os.tmpdir(), 'zenith-browser-data');
    this.ensureDirectoryExists(this.userDataPath);

    this.chromeDir = path.join(this.userDataPath, 'chrome');
    this.ensureDirectoryExists(this.chromeDir);

    this.configFile = path.join(this.userDataPath, 'prefs.json');
    this.profilesFile = path.join(this.userDataPath, 'profiles.json');
    this.bookmarksFile = path.join(this.userDataPath, 'bookmarks.json');
    this.historyFile = path.join(this.userDataPath, 'history.json');
    this.userChromeFile = path.join(this.chromeDir, 'userChrome.css');
    this.userContentFile = path.join(this.chromeDir, 'userContent.css');

    this.defaultPrefs = {
      // Security & Privacy Shield
      'privacy.shield.enabled': true,
      'privacy.shield.block_trackers': true,
      'privacy.shield.block_ads': true,
      'privacy.shield.block_miners': true,
      'privacy.shield.dnt_header': true,
      'privacy.shield.gpc_header': true,
      'privacy.shield.https_only': false,

      // Stealth & Anti-Detect
      'stealth.enabled': true,
      'stealth.geolocation.spoof': false,
      'stealth.canvas.noise': true,
      'stealth.canvas.noise_level': 0.003,
      'stealth.webgl.spoof': true,
      'stealth.webgl.vendor': 'Google Inc. (NVIDIA)',
      'stealth.webgl.renderer': 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'stealth.audio.noise': true,
      'stealth.audio.noise_level': 0.0001,
      'stealth.webrtc.mode': 'disable_non_proxied_udp', // 'default', 'disable_non_proxied_udp', 'disable_all'
      'stealth.hardware.spoof': true,
      'stealth.hardware.concurrency': 16,
      'stealth.hardware.memory_gb': 32,
      'stealth.navigator.platform': 'Win32',
      'stealth.navigator.languages': 'en-US,en;q=0.9,ru;q=0.8',
      'stealth.navigator.hide_webdriver': true,
      'stealth.screen.spoof': true,
      'stealth.screen.width': 1920,
      'stealth.screen.height': 1080,
      'stealth.screen.colorDepth': 24,
      'stealth.screen.devicePixelRatio': 1,
      'stealth.clientrects.jitter': true,

      // UI & Customization
      'ui.language': 'ru', // 'ru', 'en', 'de', 'fr', 'es'
      'ui.theme': 'stealth-dark', // 'stealth-dark', 'oled-black', 'nord', 'cyberpunk', 'gruvbox', 'tokyo-night', 'paper-light'
      'ui.tabs.position': 'top', // 'top' or 'left' (vertical tabs)
      'ui.tabs.show_favicon': true,
      'ui.userchrome.enabled': true,
      'ui.usercontent.enabled': true,
      'ui.search.default_engine': 'duckduckgo', // 'duckduckgo', 'searx', 'brave', 'google'
      'ui.animations.enabled': true,
      'ui.sites_theme': 'system', // 'system' | 'dark' | 'light' - prefers-color-scheme для сайтов
      'ui.force_dark': false, // Chromium Force Dark: авто-затемнение любых сайтов (нужен перезапуск)
      'ui.newtab.wallpaper': '', // '' | 'preset:<name>' | 'file:///<path>'
      'ui.topbar.wallpaper': '', // same format - gradient/image for tabstrip+navbar+bookmarks
      'ui.custom.overrides': {}, // { '--bg-tabstrip': '#0a0c10', ... } - smart customizer

      // Network & DNS
      'network.doh.enabled': true,
      'network.doh.provider': 'https://cloudflare-dns.com/dns-query',

      // Active Profile
      'browser.active_profile': 'profile_default',
      'browser.extensions.disabled': []
    };

    this.defaultProfiles = [
      {
        id: 'profile_default',
        name: 'Stealth Win11 / RTX 4080',
        color: '#6366f1',
        isDefault: true,
        seed: 48291,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        platform: 'Win32',
        vendor: 'Google Inc. (NVIDIA)',
        renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        hardwareConcurrency: 16,
        deviceMemory: 32,
        languages: ['en-US', 'en'],
        timezone: 'America/New_York',
        screenWidth: 1920,
        screenHeight: 1080,
        devicePixelRatio: 1,
        canvasNoise: true,
        webglSpoof: true,
        audioNoise: true,
        webrtcMode: 'disable_non_proxied_udp',
        proxy: { enabled: false, type: 'direct', server: '', username: '', password: '' }
      },
      {
        id: 'profile_ghost_mac',
        name: 'Ghost macOS / M3 Pro',
        color: '#10b981',
        isDefault: false,
        seed: 93821,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        platform: 'MacIntel',
        vendor: 'Apple Inc.',
        renderer: 'Apple M3 Pro',
        hardwareConcurrency: 12,
        deviceMemory: 18,
        languages: ['en-US', 'en'],
        timezone: 'America/Los_Angeles',
        screenWidth: 2560,
        screenHeight: 1440,
        devicePixelRatio: 2,
        canvasNoise: true,
        webglSpoof: true,
        audioNoise: true,
        webrtcMode: 'disable_non_proxied_udp',
        proxy: { enabled: false, type: 'direct', server: '', username: '', password: '' }
      },
      {
        id: 'profile_bastion_linux',
        name: 'Bastion Linux / Mesa',
        color: '#f59e0b',
        isDefault: false,
        seed: 12489,
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
        platform: 'Linux x86_64',
        vendor: 'Mesa',
        renderer: 'Mesa Intel(R) UHD Graphics 630 (CFL GT2)',
        hardwareConcurrency: 8,
        deviceMemory: 16,
        languages: ['en-US', 'en'],
        timezone: 'America/Chicago',
        screenWidth: 1920,
        screenHeight: 1080,
        devicePixelRatio: 1,
        canvasNoise: true,
        webglSpoof: true,
        audioNoise: true,
        webrtcMode: 'disable_all',
        proxy: { enabled: false, type: 'direct', server: '', username: '', password: '' }
      }
    ];

    this.defaultUserChrome = `/* ========================================================
 * Zenith userChrome.css (Firefox-like UI Customization)
 * Live-editable inside browser or directly in this file!
 * ======================================================== */

/* Example: Customize Accent Color */
:root {
  --accent-color: #6366f1;
  --accent-glow: rgba(99, 102, 241, 0.25);
  --border-radius: 8px;
}

/* Example: Add sleek subtle shadow to address bar */
.omnibox-wrapper {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.omnibox-wrapper:focus-within {
  box-shadow: 0 0 0 2px var(--accent-color), 0 8px 24px var(--accent-glow);
}

/* Example: Custom Tab Pinning / Animation */
.tab-item {
  transition: background 0.15s ease, transform 0.1s ease;
}

.tab-item:active {
  transform: scale(0.98);
}
`;

    this.defaultUserContent = `/* ========================================================
 * Zenith userContent.css (Web Page Custom Styles Injection)
 * ======================================================== */

/* Force dark mode scrollbars on all pages */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 120, 120, 0.4) transparent;
}
`;

    this.loadAll();
  }

  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) {
        console.error('Failed to create dir:', dir, e);
      }
    }
  }

  // ---- Secret protection (proxy passwords) via OS-level safeStorage ----
  // Values are stored as "zenc1:<base64>"; anything without the prefix is
  // treated as legacy plaintext and migrates to ciphertext on next save.

  _encryptSecret(value) {
    if (value === null || value === undefined || value === '') return '';
    const plain = String(value);
    if (plain.startsWith('zenc1:')) return plain;
    try {
      const { safeStorage } = require('electron');
      if (!safeStorage || !safeStorage.isEncryptionAvailable()) return plain;
      return 'zenc1:' + safeStorage.encryptString(plain).toString('base64');
    } catch (e) {
      return plain;
    }
  }

  _decryptSecret(value) {
    if (typeof value !== 'string' || !value.startsWith('zenc1:')) return value;
    try {
      const { safeStorage } = require('electron');
      return safeStorage.decryptString(Buffer.from(value.slice(6), 'base64'));
    } catch (e) {
      return '';
    }
  }

  _encryptProfile(profileData) {
    if (!profileData || !profileData.proxy) return profileData;
    return {
      ...profileData,
      proxy: { ...profileData.proxy, password: this._encryptSecret(profileData.proxy.password) }
    };
  }

  _decryptProfile(profile) {
    if (!profile || !profile.proxy) return profile;
    return { ...profile, proxy: { ...profile.proxy, password: this._decryptSecret(profile.proxy.password) } };
  }

  loadAll() {
    this.prefs = this.readJSON(this.configFile, this.defaultPrefs);
    this.pruneUnknownPrefs();
    this.profiles = this.readJSON(this.profilesFile, this.defaultProfiles);
    // Migrate stale Chrome/124 UA strings: Electron 34 is Chromium 132, and
    // the version mismatch is a bot signal Google cross-checks
    let uaMigrated = false;
    this.profiles = this.profiles.map(p => {
      if (p.userAgent && p.userAgent.includes('Chrome/124.0.0.0')) {
        uaMigrated = true;
        return { ...p, userAgent: p.userAgent.replace(/Chrome\/124\.0\.0\.0/g, 'Chrome/132.0.0.0') };
      }
      return p;
    });
    if (uaMigrated) this.writeJSON(this.profilesFile, this.profiles);
    this.bookmarks = this.readJSON(this.bookmarksFile, []);
    this.history = this.readJSON(this.historyFile, []);

    if (!fs.existsSync(this.userChromeFile)) {
      this.writeText(this.userChromeFile, this.defaultUserChrome);
    }
    if (!fs.existsSync(this.userContentFile)) {
      this.writeText(this.userContentFile, this.defaultUserContent);
    }
  }

  // Drops settings left over from older versions that no engine reads
  pruneUnknownPrefs() {
    const known = new Set([...Object.keys(this.defaultPrefs), 'browser.last_session']);
    const entries = Object.entries(this.prefs).filter(([key]) => known.has(key));
    if (entries.length !== Object.keys(this.prefs).length) {
      this.prefs = Object.fromEntries(entries);
      this.writeJSON(this.configFile, this.prefs);
    }
  }

  readJSON(filePath, defaultValue) {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(data);
        if (Array.isArray(defaultValue)) {
          return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultValue;
        }
        return { ...defaultValue, ...parsed };
      }
    } catch (e) {
      console.warn(`Failed to read ${filePath}, using defaults:`, e.message);
    }
    this.writeJSON(filePath, defaultValue);
    return defaultValue;
  }

  writeJSON(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error(`Failed to write ${filePath}:`, e.message);
    }
  }

  // Non-blocking variant for high-frequency stores (session state)
  writeJSONAsync(filePath, data) {
    fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', (err) => {
      if (err) console.error(`Failed to write ${filePath}:`, err.message);
    });
  }

  readText(filePath, defaultValue = '') {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
    } catch (e) {
      console.warn(`Failed to read text ${filePath}:`, e.message);
    }
    return defaultValue;
  }

  writeText(filePath, content) {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (e) {
      console.error(`Failed to write text ${filePath}:`, e.message);
    }
  }

  // Preferences
  getPref(key, defaultValue = null) {
    let value;
    if (this.prefs[key] !== undefined) {
      value = this.prefs[key];
    } else {
      value = defaultValue !== null ? defaultValue : this.defaultPrefs[key];
    }
    if (key.endsWith('.password')) {
      return this._decryptSecret(value);
    }
    return value;
  }

  setPref(key, value) {
    if (key === 'network.proxy.password') {
      value = this._encryptSecret(value);
    }
    this.prefs[key] = value;
    this.writeJSON(this.configFile, this.prefs);
  }

  getAllPrefs() {
    return { ...this.defaultPrefs, ...this.prefs };
  }

  resetPref(key) {
    if (this.defaultPrefs[key] !== undefined) {
      this.prefs[key] = this.defaultPrefs[key];
      this.writeJSON(this.configFile, this.prefs);
      return this.prefs[key];
    }
    return null;
  }

  // Profiles
  getProfiles() {
    return this.profiles.map(p => this._decryptProfile(p));
  }

  getActiveProfile() {
    const activeId = this.getPref('browser.active_profile', 'profile_default');
    let found = this.profiles.find(p => p.id === activeId);
    if (!found) {
      found = this.profiles[0] || this.defaultProfiles[0];
    }
    return this._decryptProfile(found);
  }

  saveProfile(profileData) {
    const stored = this._encryptProfile(profileData);
    const index = this.profiles.findIndex(p => p.id === stored.id);
    if (index >= 0) {
      this.profiles[index] = { ...this.profiles[index], ...stored };
    } else {
      this.profiles.push(stored);
    }
    this.writeJSON(this.profilesFile, this.profiles);
    return profileData;
  }

  deleteProfile(profileId) {
    if (this.profiles.length <= 1) return false;
    this.profiles = this.profiles.filter(p => p.id !== profileId);
    if (this.getPref('browser.active_profile') === profileId) {
      this.setPref('browser.active_profile', this.profiles[0].id);
    }
    this.writeJSON(this.profilesFile, this.profiles);
    return true;
  }

  generateRandomFingerprint(name = 'Random Stealth Identity') {
    const pick = (arr) => arr[crypto.randomInt(arr.length)];
    const seed = crypto.randomInt(1, 1000000);
    const timezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Phoenix'
    ];
    const platforms = [
      {
        os: 'Windows 11',
        platform: 'Win32',
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        vendor: 'Google Inc. (NVIDIA)',
        renderers: [
          'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
          'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
          'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)'
        ]
      },
      {
        os: 'macOS Sonoma',
        platform: 'MacIntel',
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        vendor: 'Apple Inc.',
        renderers: ['Apple M2 Max', 'Apple M3 Pro', 'Apple M1']
      },
      {
        os: 'Linux Ubuntu',
        platform: 'Linux x86_64',
        ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        vendor: 'Mesa/X.org',
        renderers: [
          'Mesa Intel(R) UHD Graphics 770 (ADL-S GT1)',
          'AMD Radeon RX 7800 XT (radeonsi, navi32, LLVM 17.0.6, DRM 3.57)'
        ]
      }
    ];

    const chosenOs = pick(platforms);
    const chosenRenderer = pick(chosenOs.renderers);
    const concurrencies = [6, 8, 12, 16, 24, 32];
    const memories = [8, 16, 32, 64];
    const resolutions = [
      { w: 1920, h: 1080, dpr: 1 },
      { w: 2560, h: 1440, dpr: 1 },
      { w: 2560, h: 1600, dpr: 2 },
      { w: 3840, h: 2160, dpr: 1.5 }
    ];
    const chosenRes = pick(resolutions);

    return {
      id: 'profile_' + Date.now(),
      name: name,
      color: pick(['#6366f1', '#ec4899', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4']),
      isDefault: false,
      seed: seed,
      userAgent: chosenOs.ua,
      platform: chosenOs.platform,
      vendor: chosenOs.vendor,
      renderer: chosenRenderer,
      hardwareConcurrency: pick(concurrencies),
      deviceMemory: pick(memories),
      languages: ['en-US', 'en'],
      timezone: pick(timezones),
      screenWidth: chosenRes.w,
      screenHeight: chosenRes.h,
      devicePixelRatio: chosenRes.dpr,
      canvasNoise: true,
      webglSpoof: true,
      audioNoise: true,
      webrtcMode: 'disable_non_proxied_udp',
      proxy: { enabled: false, type: 'direct', server: '', username: '', password: '' }
    };
  }

  // One-shot identity for incognito tabs: fresh random seed & hardware,
  // so the fingerprint never matches the persistent profiles.
  generateIncognitoIdentity() {
    const ident = this.generateRandomFingerprint('Инкогнито ' + (1000 + crypto.randomInt(9000)));
    ident.webrtcMode = 'disable_all';
    return ident;
  }

  // userChrome / userContent
  getUserChromeCSS() {
    return this.readText(this.userChromeFile, this.defaultUserChrome);
  }

  setUserChromeCSS(css) {
    this.writeText(this.userChromeFile, css);
  }

  getUserContentCSS() {
    return this.readText(this.userContentFile, this.defaultUserContent);
  }

  setUserContentCSS(css) {
    this.writeText(this.userContentFile, css);
  }

  // Bookmarks.
  // Structure: flat items {title, url} and folders {id, name, children:[items]}
  getBookmarks() {
    return this.bookmarks;
  }

  addBookmark(item) {
    if (!item || !item.url) return false;
    if (!this.bookmarks.some(b => b.url === item.url)) {
      this.bookmarks.push({ title: item.title || item.url, url: item.url });
      this.writeJSON(this.bookmarksFile, this.bookmarks);
    }
    return true;
  }

  addFolder(name) {
    const folder = { id: 'folder_' + Date.now(), name: String(name || 'Новая папка'), children: [] };
    this.bookmarks.push(folder);
    this.writeJSON(this.bookmarksFile, this.bookmarks);
    return folder;
  }

  addItemToFolder(folderId, item) {
    const folder = this._findFolder(folderId);
    if (!folder || !item || !item.url) return false;
    if (!folder.children.some(c => c.url === item.url)) {
      folder.children.push({ title: item.title || item.url, url: item.url });
      this.writeJSON(this.bookmarksFile, this.bookmarks);
    }
    return true;
  }

  _findFolder(id, list = this.bookmarks) {
    for (const b of list) {
      if (b.id === id) return b;
      if (b.children) {
        const found = this._findFolder(id, b.children);
        if (found) return found;
      }
    }
    return null;
  }

  removeBookmark(url) {
    const filterList = (list) => list
      .filter(b => b.url !== url)
      .map(b => b.children ? { ...b, children: filterList(b.children) } : b);
    this.bookmarks = filterList(this.bookmarks);
    this.writeJSON(this.bookmarksFile, this.bookmarks);
  }

  // History
  getHistory() {
    return this.history;
  }

  addHistory(item) {
    if (!item.url || item.url.startsWith('about:') || item.url.startsWith('file:')) return;
    this.history = this.history.filter(h => h.url !== item.url);
    this.history.unshift({
      title: item.title || item.url,
      url: item.url,
      visitedAt: new Date().toISOString()
    });
    if (this.history.length > 500) {
      this.history = this.history.slice(0, 500);
    }
    // History changes on every page load: coalesce writes instead of
    // rewriting the whole file synchronously each time
    clearTimeout(this._historyTimer);
    this._historyTimer = setTimeout(() => {
      this.writeJSONAsync(this.historyFile, this.history);
    }, 900);
  }

  clearHistory() {
    clearTimeout(this._historyTimer);
    this.history = [];
    this.writeJSON(this.historyFile, this.history);
  }

  removeHistoryItem(url) {
    this.history = this.history.filter(h => h.url !== url);
    this.writeJSONAsync(this.historyFile, this.history);
  }
}

module.exports = new ConfigStore();
