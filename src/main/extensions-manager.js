const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');

// Chromium browsers store unpacked extensions in <profile-root>/<profile>/Extensions.
// Opera (and Opera GX) keep their profile in Roaming, not LocalAppData.
const BROWSER_ROOTS = [
  { browser: 'Chrome', root: process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data') : '' },
  { browser: 'Edge', root: process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data') : '' },
  { browser: 'Brave', root: process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'User Data') : '' },
  { browser: 'Vivaldi', root: process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Vivaldi', 'User Data') : '' },
  { browser: 'Yandex', root: process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Yandex', 'YandexBrowser', 'User Data') : '' },
  { browser: 'Opera', root: process.env.APPDATA ? path.join(process.env.APPDATA, 'Opera Software', 'Opera Stable') : '' },
  { browser: 'Opera GX', root: process.env.APPDATA ? path.join(process.env.APPDATA, 'Opera Software', 'Opera GX Stable') : '' }
].filter(b => b.root && b.root.length > 3);

function readManifest(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  } catch (e) {
    return null;
  }
}

// Resolve __MSG_Key__ placeholders through _locales/<locale>/messages.json
function resolveLocalizedName(manifest, dir) {
  const raw = (manifest && manifest.name) || '';
  const m = raw.match(/^__MSG_(.+?)__$/);
  if (!m) return raw;
  const key = m[1];
  const localesDir = path.join(dir, '_locales');
  const order = [manifest.default_locale, 'en', 'en_US', 'en_GB', 'ru'].filter(Boolean);
  try {
    order.push(...fs.readdirSync(localesDir).filter(d => !order.includes(d)));
  } catch (e) {}
  for (const loc of order) {
    try {
      const file = path.join(localesDir, loc, 'messages.json');
      if (!fs.existsSync(file)) continue;
      const msgs = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (msgs[key] && msgs[key].message) return msgs[key].message;
    } catch (e) {}
  }
  return raw;
}

function pickIcon(dir, manifest) {
  try {
    const icons = (manifest && manifest.icons) || {};
    const sizes = Object.keys(icons).map(Number).sort((a, b) => a - b);
    for (let i = sizes.length - 1; i >= 0; i--) {
      const p = path.join(dir, icons[sizes[i]]);
      if (fs.existsSync(p) && fs.statSync(p).size < 200 * 1024) {
        const ext = path.extname(p).toLowerCase().replace('.', '');
        const mime = ext === 'ico' ? 'x-icon' : (ext === 'svg' ? 'svg+xml' : ext);
        return 'data:image/' + mime + ';base64,' + fs.readFileSync(p).toString('base64');
      }
    }
  } catch (e) {}
  return null;
}

// Compatibility verdict for Electron's limited extension surface:
// - content scripts + storage work
// - toolbar popups do not exist, full chrome.tabs/cookies/webRequest absent
function computeCompat(manifest) {
  if (!manifest) return { compat: 'none', reason: 'manifest.json не читается' };
  const json = JSON.stringify(manifest.permissions || []) + JSON.stringify(manifest.optional_permissions || []);
  const hasContent = !!(manifest.content_scripts && manifest.content_scripts.length);
  const bg = manifest.background && (manifest.background.service_worker || manifest.background.page || manifest.background.scripts);
  if (/declarativeNetRequest/.test(json)) {
    return { compat: 'none', reason: 'требует declarativeNetRequest (нет в Electron)' };
  }
  if (hasContent) return { compat: bg ? 'partial' : 'full', reason: bg ? 'фоновой сервис ограничен, контент-скрипты работают' : '' };
  if (bg) return { compat: 'partial', reason: 'нет тулбар-попапа; фоновой режим ограничен' };
  return { compat: 'none', reason: 'нужны popup/tabs API' };
}

function readStoredMeta(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, '.zenith-meta.json'), 'utf8'));
  } catch (e) {
    return {};
  }
}

function metaFor(dirName, dir, manifest, disabledSet) {
  const { compat, reason } = computeCompat(manifest);
  const stored = readStoredMeta(dir);
  return {
    id: dirName,
    chromeId: stored.chromeId || null,
    name: resolveLocalizedName(manifest, dir) || dirName,
    version: (manifest && manifest.version) || '',
    description: (manifest && manifest.description) || '',
    compat,
    compatReason: reason,
    manifestVersion: (manifest && manifest.manifest_version) || 0,
    disabled: disabledSet.has(dirName),
    icon: pickIcon(dir, manifest)
  };
}

function bestVersionDir(extDir) {
  let versions = [];
  try {
    versions = fs.readdirSync(extDir).filter(v => {
      try {
        return fs.statSync(path.join(extDir, v)).isDirectory() && !!readManifest(path.join(extDir, v));
      } catch (e) { return false; }
    });
  } catch (e) {}
  if (!versions.length) return null;
  versions.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return path.join(extDir, versions[versions.length - 1]);
}

class ExtensionsManager {
  constructor(configStore) {
    this.configStore = configStore;
    this.dir = path.join(app.getPath('userData'), 'extensions');
    fs.mkdirSync(this.dir, { recursive: true });
    // Session -> Map(extDirName -> Extension handle). Electron 34 has no
    // session.getAllSessions(), so live sessions are tracked here as they
    // are created by SessionManager.
    this.attached = new Map();
  }

  get disabledIds() {
    const v = this.configStore.getPref('browser.extensions.disabled', []);
    return new Set(Array.isArray(v) ? v : []);
  }

  _setDisabled(set) {
    this.configStore.setPref('browser.extensions.disabled', [...set]);
  }

  listInstalled() {
    const disabled = this.disabledIds;
    const out = [];
    let names = [];
    try {
      names = fs.readdirSync(this.dir).filter(n => {
        const p = path.join(this.dir, n);
        try {
          return fs.statSync(p).isDirectory() && !!readManifest(p);
        } catch (e) { return false; }
      });
    } catch (e) {}
    for (const n of names) {
      const dir = path.join(this.dir, n);
      out.push(metaFor(n, dir, readManifest(dir), disabled));
    }
    return out;
  }

  // Scan every known Chromium browser profile for import candidates
  chromeCandidates() {
    const disabled = this.disabledIds;
    const installed = new Set(this.listInstalled().map(x => x.chromeId || x.id));
    const seen = new Set();
    const out = [];
    for (const { browser, root } of BROWSER_ROOTS) {
      let profiles = [];
      try {
        profiles = fs.readdirSync(root).filter(n => n === 'Default' || /^Profile \d+$/.test(n));
      } catch (e) { continue; }
      for (const prof of profiles) {
        const extRoot = path.join(root, prof, 'Extensions');
        let ids = [];
        try { ids = fs.readdirSync(extRoot); } catch (e) { continue; }
        for (const extId of ids) {
          if (seen.has(extId)) continue;
          const dir = bestVersionDir(path.join(extRoot, extId));
          if (!dir) continue;
          seen.add(extId);
          const manifest = readManifest(dir);
          const meta = metaFor(extId, dir, manifest, disabled);
          meta.chromeId = extId;
          meta.browser = browser;
          meta.chromeProfile = prof;
          meta.source = dir;
          meta.alreadyImported = installed.has(extId);
          out.push(meta);
        }
      }
    }
    // Known-good content-script extensions first, then alphabetical
    out.sort((a, b) => {
      const rank = { full: 0, partial: 1, none: 2 };
      if (rank[a.compat] !== rank[b.compat]) return rank[a.compat] - rank[b.compat];
      return a.name.localeCompare(b.name, 'ru');
    });
    return out;
  }

  importFromPath(sourcePath, chromeId = null) {
    const manifest = readManifest(sourcePath);
    if (!manifest) {
      return { ok: false, error: 'В папке нет корректного manifest.json (нужна распакованная версия)' };
    }
    const displayName = resolveLocalizedName(manifest, sourcePath);
    const base = String(displayName || path.basename(sourcePath))
      .replace(/[^\wа-яА-ЯёЁ .-]/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'extension';
    let dest = path.join(this.dir, base);
    let n = 2;
    while (fs.existsSync(dest)) { dest = path.join(this.dir, base + '_' + n++); }
    try {
      fs.cpSync(sourcePath, dest, { recursive: true });
    } catch (e) {
      return { ok: false, error: 'Не удалось скопировать: ' + e.message };
    }
    if (chromeId) {
      try {
        fs.writeFileSync(path.join(dest, '.zenith-meta.json'), JSON.stringify({ chromeId }), 'utf8');
      } catch (e) {}
    }
    this.attachAllSessions();
    return { ok: true, extension: metaFor(path.basename(dest), dest, readManifest(dest), this.disabledIds) };
  }

  async installFromFolderDialog() {
    const res = await dialog.showOpenDialog({
      title: 'Выберите папку распакованного расширения',
      properties: ['openDirectory']
    });
    if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
    return this.importFromPath(res.filePaths[0]);
  }

  // Load every enabled unpacked extension into the session
  async attachToSession(ses) {
    if (!ses || typeof ses.loadExtension !== 'function') return;
    this.attached.set(ses, this.attached.get(ses) || new Map());
    const disabled = this.disabledIds;
    let installed = [];
    try {
      installed = fs.readdirSync(this.dir).filter(n => {
        const p = path.join(this.dir, n);
        try {
          return fs.statSync(p).isDirectory() && !!readManifest(p);
        } catch (e) { return false; }
      });
    } catch (e) {}
    const handles = this.attached.get(ses);
    for (const name of installed) {
      if (disabled.has(name) || handles.has(name)) continue;
      try {
        const ext = await ses.loadExtension(path.join(this.dir, name));
        handles.set(name, ext);
      } catch (e) {
        if (!/already loaded/i.test(e.message)) {
          console.warn(`Extension ${name} failed to load:`, e.message);
        }
      }
    }
  }

  attachAllSessions() {
    for (const ses of this.attached.keys()) {
      this.attachToSession(ses);
    }
  }

  toggle(id, enabled) {
    const set = this.disabledIds;
    if (enabled) {
      set.delete(id);
    } else {
      set.add(id);
      for (const [ses, handles] of this.attached) {
        const ext = handles.get(id);
        if (ext) {
          // Electron 34: removeExtension(extensionId); unloadExtension() не существует
          try { ses.removeExtension(ext.id); } catch (e) {}
          handles.delete(id);
        }
      }
    }
    this._setDisabled(set);
    if (enabled) this.attachAllSessions();
    return this.listInstalled();
  }

  uninstall(id) {
    const dest = path.join(this.dir, id);
    if (path.dirname(dest) !== this.dir) return { ok: false, error: 'bad id' };
    this.toggle(id, false);
    try { fs.rmSync(dest, { recursive: true, force: true }); } catch (e) {
      return { ok: false, error: e.message };
    }
    return { ok: true, list: this.listInstalled() };
  }
}

module.exports = ExtensionsManager;
