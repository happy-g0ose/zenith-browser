const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, session } = require('electron');
const { generateStealthScript } = require('../stealth/stealth-injections');

// Static bridge source that gets appended to every generated content preload
const BRIDGE_SOURCE_PATH = path.join(__dirname, '../stealth/preload-content.js');

class SessionManager {
  constructor(configStore, adblockShield, torManager = null, extensionsManager = null) {
    this.configStore = configStore;
    this.adblockShield = adblockShield;
    this.torManager = torManager;
    this.extensionsManager = extensionsManager;
    this.sessions = new Map(); // profileId -> Electron session
    this.generatedPreloads = new Set();
  }

  /**
   * Builds (and caches) a per-profile preload file that contains BOTH the
   * stealth payload AND the internal-pages bridge. Content views run with
   * contextIsolation: false, so this executes synchronously in the page's
   * MAIN world at document_start - before any page script can probe the
   * real fingerprint. The old executeJavaScript-on-navigation approach lost
   * that race against inline scripts.
   */
  getContentPreloadPath(profile) {
    // Wire the about:config stealth toggles into the generated payload
    const enriched = {
      ...profile,
      screenSpoof: this.configStore.getPref('stealth.screen.spoof', true),
      hardwareSpoof: this.configStore.getPref('stealth.hardware.spoof', true),
      clientrectsJitter: this.configStore.getPref('stealth.clientrects.jitter', true),
      canvasNoiseLevel: this.configStore.getPref('stealth.canvas.noise_level', 0.003),
      audioNoiseLevel: this.configStore.getPref('stealth.audio.noise_level', 0.0001)
    };
    const stealthBody = generateStealthScript(enriched);
    const bridgeSource = fs.readFileSync(BRIDGE_SOURCE_PATH, 'utf8');
    const script = stealthBody + '\n;\n' + bridgeSource;

    const hash = crypto.createHash('sha1').update(script).digest('hex').slice(0, 12);
    const runtimeDir = path.join(app.getPath('userData'), 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true });
    const preloadPath = path.join(runtimeDir, `content-${hash}.js`);
    if (!fs.existsSync(preloadPath)) {
      fs.writeFileSync(preloadPath, script, 'utf8');
    }
    this.generatedPreloads.add(preloadPath);
    return preloadPath;
  }

  getOrCreateSession(profileId) {
    if (this.sessions.has(profileId)) {
      return this.sessions.get(profileId);
    }

    const partition = `persist:${profileId}`;
    const ses = session.fromPartition(partition);

    this.configureSession(ses, profileId);
    this.sessions.set(profileId, ses);
    return ses;
  }

  // In-memory session: cookies, cache, localStorage exist only in RAM
  // and are destroyed when the tab closes. Nothing is written to disk.
  async createIncognitoSession(profile) {
    const partition = `incognito:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    const ses = session.fromPartition(partition);
    const effectiveProfile = { ...profile };

    // Auto-route incognito through the bundled Tor daemon when possible
    if (!(effectiveProfile.proxy && effectiveProfile.proxy.enabled && effectiveProfile.proxy.server)) {
      const torOk = this.torManager ? await this.torManager.ensureRunning() : false;
      if (torOk) {
        effectiveProfile.proxy = { enabled: true, type: 'socks5', server: '127.0.0.1:9050' };
        effectiveProfile.webrtcMode = 'disable_all';
      }
    }

    this.configureSession(ses, effectiveProfile);
    return ses;
  }

  configureSession(ses, profileOrId) {
    const profile = typeof profileOrId === 'string'
      ? (this.configStore.getProfiles().find(p => p.id === profileOrId) || this.configStore.getActiveProfile())
      : profileOrId;

    // 1. User Agent & Language
    if (profile.userAgent) {
      ses.setUserAgent(profile.userAgent, (profile.languages && profile.languages.join(',')) || 'en-US,en');
    }

    // 2. Attach AdBlock Shield
    const statKey = typeof profileOrId === 'string' ? profileOrId : (profile.id || 'incognito');
    this.adblockShield.attachToSession(ses, statKey);

    // 2b. Attach unpacked extensions (persistent sessions only - incognito
    // stays clean so extensions can never leak into throwaway identities)
    if (typeof profileOrId === 'string' && this.extensionsManager) {
      this.extensionsManager.attachToSession(ses);
    }

    // 3. WebRTC Policy & Leak Prevention
    try {
      if (typeof ses.setWebRTCIPHandlingPolicy === 'function') {
        if (profile.webrtcMode === 'disable_non_proxied_udp' || profile.webrtcMode === 'disable_all') {
          ses.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
        } else {
          ses.setWebRTCIPHandlingPolicy('default');
        }
      }
      if (typeof ses.setWebRTCUDPPortRange === 'function' && profile.webrtcMode === 'disable_all') {
        ses.setWebRTCUDPPortRange({ min: 0, max: 0 });
      }
    } catch (e) {
      console.warn('WebRTC policy notice:', e.message);
    }

    // 4. Proxy Configuration
    if (profile.proxy && profile.proxy.enabled && profile.proxy.server) {
      const proxyRules = profile.proxy.type === 'socks5' 
        ? `socks5://${profile.proxy.server}` 
        : `${profile.proxy.type}://${profile.proxy.server}`;

      ses.setProxy({
        proxyRules: proxyRules,
        proxyBypassRules: '<local>;about:*;file:*'
      }).catch(err => {
        console.error(`Failed to set proxy for profile ${profile.id || 'unknown'}:`, err);
      });
    } else {
      ses.setProxy({ mode: 'direct' }).catch(() => {});
    }

    // 5. Strict Permission Handling (Block geolocation, camera, mic, notifications, sensors)
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['fullscreen'];
      if (allowedPermissions.includes(permission)) {
        callback(true);
      } else {
        // Strictly deny geolocation, media, notifications, clipboard, etc.
        callback(false);
      }
    });

    if (typeof ses.setPermissionCheckHandler === 'function') {
      ses.setPermissionCheckHandler((webContents, permission) => {
        if (permission === 'fullscreen') return true;
        return false;
      });
    }
  }

  // userContent.css injection (stealth JS is handled by the generated
  // content preload - see getContentPreloadPath)
  attachUserContentCSS(webContents) {
    webContents.on('dom-ready', () => {
      const url = webContents.getURL();
      if (!url || url.startsWith('about:') || url.startsWith('file:')) return;

      if (this.configStore.getPref('ui.usercontent.enabled', true)) {
        const userContentCSS = this.configStore.getUserContentCSS();
        if (userContentCSS && userContentCSS.trim().length > 0) {
          webContents.insertCSS(userContentCSS).catch(() => {});
        }
      }
    });
  }
}

module.exports = SessionManager;
