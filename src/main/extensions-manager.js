const fs = require('fs');
const path = require('path');
const { app, dialog, session } = require('electron');

const CHROME_ROOTS = [
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
  path.join(process.env.LOCALAPPDATA || '', 'Chromium', 'User Data')
].filter(r => r && r.length > 2);

function readManifest(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  } catch (e) {
    return null;
  }
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

function metaFor(dirName, dir, manifest, disabledSet) {
  const { compat, reason } = computeCompat(manifest);
  return {
    id: dirName,
    name: (manifest && manifest.name) || dirName,
    version: (manifest && manifest.version) || '',
    description: (manifest && manifest.description) || '',
    compat,
    compatReason: reason,
    manifestVersion: (manifest && manifest.manifest_version) || 0,
    disabled: disabledSet.has(dirName),
    icon: pickIcon(dir, manifest)
  };
}

class ExtensionsManager {
  constructor(configStore) {
    this.configStore = configStore;
    this.dir = path.join(app.getPath('userData'), 'extensions');
    fs.mkdirSync(this.dir, { recursive: true });
    // extId -> Extension handle, per session id (for live unload)
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
        return fs.statSync(p).isDirectory() && !!readManifest(p);
      });
    } catch (e) {}
    for (const n of names) {
      out.push(metaFor(n, path.join(this.dir, n), readManifest(path.join(this.dir, n)), disabled));
    }
    return out;
  }

  // Scan local Chrome profiles for unpacked extension sources
  chromeCandidates() {
    const disabled = this.disabledIds;
    const seen = new Set();
    const out = [];
    for (const root of CHROME_ROOTS) {
      let profiles = [];
      try {
        profiles = fs.readdirSync(root).filter(n => n === 'Default' || /^Profile \d+$/.test(n));
      } catch (e) { continue; }
      for (const prof of profiles) {
        const extRoot = path.join(root, prof, 'Extensions');
        let ids = [];
        try { ids = fs.readdirSync(extRoot); } catch (e) { continue; }
        for (const extId of ids) {
          const extDir = path.join(extRoot, extId);
          let versions = [];
          try {
            versions = fs.readdirSync(extDir).filter(v => {
              return fs.statSync(path.join(extDir, v)).isDirectory() && !!readManifest(path.join(extDir, v));
            });
          } catch (e) { continue; }
          versions.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
          const best = versions[versions.length - 1];
          if (!best || seen.has(extId)) continue;
          seen.add(extId);
          const dir = path.join(extDir, best);
          const manifest = readManifest(dir);
          out.push({
            source: dir,
            chromeId: extId,
            chromeProfile: prof,
            ...metaFor(extId, dir, manifest, disabled)
          });
        }
      }
    }
    return out;
  }

  importFromPath(sourcePath) {
    const manifest = readManifest(sourcePath);
    if (!manifest) {
      return { ok: false, error: 'В папке нет корректного manifest.json (нужна распакованная версия)' };
    }
    const base = String(manifest.name || path.basename(sourcePath))
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
    const disabled = this.disabledIds;
    let installed = [];
    try {
      installed = fs.readdirSync(this.dir).filter(n => {
        const p = path.join(this.dir, n);
        return fs.statSync(p).isDirectory() && !!readManifest(p);
      });
    } catch (e) {}
    const handles = this.attached.get(ses.id) || new Map();
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
    this.attached.set(ses.id, handles);
  }

  attachAllSessions() {
    for (const ses of session.getAllSessions()) {
      this.attachToSession(ses);
    }
  }

  toggle(id, enabled) {
    const set = this.disabledIds;
    if (enabled) {
      set.delete(id);
    } else {
      set.add(id);
      // Unload live instances
      for (const [sesId, handles] of this.attached) {
        const ext = handles.get(id);
        if (ext) {
          try {
            const ses = session.getAllSessions().find(s => s.id === sesId);
            if (ses) ses.unloadExtension(ext);
          } catch (e) {}
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
    // Guard against path escape
    if (path.dirname(dest) !== this.dir) return { ok: false, error: 'bad id' };
    this.toggle(id, false);
    try { fs.rmSync(dest, { recursive: true, force: true }); } catch (e) {
      return { ok: false, error: e.message };
    }
    return { ok: true, list: this.listInstalled() };
  }
}

module.exports = ExtensionsManager;
