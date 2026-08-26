/**
 * Zenith Ultra-Stealth Engine
 * Injected at document_start in the page's main world
 */

function generateStealthScript(profile) {
  return `(function() {
    'use strict';

    if (window.__AEGIS_STEALTH_ACTIVE__) return;
    Object.defineProperty(window, '__AEGIS_STEALTH_ACTIVE__', { value: true, enumerable: false, writable: false });

    const PROFILE = ${JSON.stringify(profile)};
    const SEED = PROFILE.seed || 48291;

    // Deterministic PRNG
    function createPRNG(seed) {
      return function() {
        var t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    const rng = createPRNG(SEED);

    // Native function string masking (Anti-Tamper)
    const nativeToString = Function.prototype.toString;
    const hookedFunctions = new WeakSet();

    function maskFunction(fn, originalName) {
      hookedFunctions.add(fn);
      try {
        Object.defineProperty(fn, 'name', { value: originalName || fn.name, configurable: true });
      } catch(e) {}
      return fn;
    }

    Function.prototype.toString = function() {
      if (hookedFunctions.has(this)) {
        return 'function ' + (this.name || '') + '() { [native code] }';
      }
      return nativeToString.apply(this, arguments);
    };
    hookedFunctions.add(Function.prototype.toString);

    // =========================================================================
    // 1. CLOUDFLARE & CHROME RUNTIME EMULATION
    // =========================================================================
    try {
      // Complete removal of automation indicators
      Object.defineProperty(Navigator.prototype, 'webdriver', {
        get: () => undefined,
        configurable: true,
        enumerable: true
      });
      delete Object.getPrototypeOf(navigator).webdriver;
      delete navigator.webdriver;

      // Accurate window.chrome object including csi and loadTimes
      if (!window.chrome) {
        window.chrome = {};
      }

      window.chrome.app = {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        getDetails: maskFunction(function() { return null; }, 'getDetails'),
        getIsInstalled: maskFunction(function() { return false; }, 'getIsInstalled'),
        installState: maskFunction(function() { return 'not_installed'; }, 'installState'),
        runningState: maskFunction(function() { return 'cannot_run'; }, 'runningState')
      };

      window.chrome.csi = maskFunction(function() {
        return {
          startE: Date.now() - 500,
          onloadT: Date.now(),
          pageT: 500.12,
          tran: 15
        };
      }, 'csi');

      window.chrome.loadTimes = maskFunction(function() {
        return {
          requestTime: (Date.now() - 600) / 1000,
          startLoadTime: (Date.now() - 550) / 1000,
          commitLoadTime: (Date.now() - 400) / 1000,
          finishDocumentLoadTime: (Date.now() - 200) / 1000,
          finishLoadTime: (Date.now() - 100) / 1000,
          firstPaintTime: (Date.now() - 350) / 1000,
          firstPaintAfterLoadTime: 0,
          navigationType: 'Other',
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true,
          npnNegotiatedProtocol: 'h2',
          wasAlternateProtocolAvailable: false,
          connectionInfo: 'h2'
        };
      }, 'loadTimes');

      window.chrome.runtime = {
        OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
        OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
        PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
        RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
        connect: maskFunction(function() {}, 'connect'),
        sendMessage: maskFunction(function() {}, 'sendMessage')
      };

      // 2. Full navigator.userAgentData (Client Hints for Cloudflare)
      const brands = [
        { brand: 'Chromium', version: '132' },
        { brand: 'Google Chrome', version: '132' },
        { brand: 'Not-A.Brand', version: '99' }
      ];

      const userAgentData = {
        brands: brands,
        mobile: false,
        platform: PROFILE.platform === 'MacIntel' ? 'macOS' : (PROFILE.platform === 'Linux x86_64' ? 'Linux' : 'Windows'),
        getHighEntropyValues: maskFunction(function(hints) {
          return Promise.resolve({
            architecture: 'x86',
            bitness: '64',
            brands: brands,
            fullVersionList: [
              { brand: 'Chromium', version: '132.0.6836.0' },
              { brand: 'Google Chrome', version: '132.0.6836.0' },
              { brand: 'Not-A.Brand', version: '99.0.0.0' }
            ],
            mobile: false,
            model: '',
            platform: PROFILE.platform === 'MacIntel' ? 'macOS' : (PROFILE.platform === 'Linux x86_64' ? 'Linux' : 'Windows'),
            platformVersion: '15.0.0'
          });
        }, 'getHighEntropyValues'),
        toJSON: maskFunction(function() {
          return {
            brands: brands,
            mobile: false,
            platform: PROFILE.platform === 'MacIntel' ? 'macOS' : 'Windows'
          };
        }, 'toJSON')
      };

      Object.defineProperty(Navigator.prototype, 'userAgentData', {
        get: () => userAgentData,
        configurable: true,
        enumerable: true
      });

      // 3. Geolocation Shield & Permissions query spoofing
      try {
        if (navigator.geolocation) {
          function createGeoError() {
            const err = new Error('User denied Geolocation');
            err.code = 1; // PERMISSION_DENIED
            err.PERMISSION_DENIED = 1;
            err.POSITION_UNAVAILABLE = 2;
            err.TIMEOUT = 3;
            return err;
          }

          navigator.geolocation.getCurrentPosition = maskFunction(function(successCallback, errorCallback, options) {
            if (PROFILE.geolocation && PROFILE.geolocation.spoof) {
              const fakePosition = {
                coords: {
                  latitude: PROFILE.geolocation.latitude || 37.774929,
                  longitude: PROFILE.geolocation.longitude || -122.419418,
                  altitude: null,
                  accuracy: 20,
                  altitudeAccuracy: null,
                  heading: null,
                  speed: null
                },
                timestamp: Date.now()
              };
              if (typeof successCallback === 'function') setTimeout(() => successCallback(fakePosition), 30);
              return;
            }
            if (typeof errorCallback === 'function') {
              setTimeout(() => errorCallback(createGeoError()), 30);
            }
          }, 'getCurrentPosition');

          navigator.geolocation.watchPosition = maskFunction(function(successCallback, errorCallback, options) {
            if (PROFILE.geolocation && PROFILE.geolocation.spoof) {
              const fakePosition = {
                coords: {
                  latitude: PROFILE.geolocation.latitude || 37.774929,
                  longitude: PROFILE.geolocation.longitude || -122.419418,
                  altitude: null,
                  accuracy: 20,
                  altitudeAccuracy: null,
                  heading: null,
                  speed: null
                },
                timestamp: Date.now()
              };
              if (typeof successCallback === 'function') setTimeout(() => successCallback(fakePosition), 30);
              return 1;
            }
            if (typeof errorCallback === 'function') {
              setTimeout(() => errorCallback(createGeoError()), 30);
            }
            return 1;
          }, 'watchPosition');

          navigator.geolocation.clearWatch = maskFunction(function(id) {}, 'clearWatch');
        }

        if (navigator.permissions && navigator.permissions.query) {
          const origQuery = navigator.permissions.query;
          navigator.permissions.query = maskFunction(function(parameters) {
            if (parameters && parameters.name === 'geolocation') {
              return Promise.resolve({
                state: PROFILE.geolocation && PROFILE.geolocation.spoof ? 'granted' : 'denied',
                name: 'geolocation',
                onchange: null
              });
            }
            if (parameters && parameters.name === 'notifications') {
              return Promise.resolve({
                state: 'denied',
                name: 'notifications',
                onchange: null
              });
            }
            if (parameters && (parameters.name === 'camera' || parameters.name === 'microphone')) {
              return Promise.resolve({
                state: 'denied',
                name: parameters.name,
                onchange: null
              });
            }
            return origQuery.apply(this, arguments);
          }, 'query');
        }

        // Timezone isolation to prevent physical location inference.
        // Only override when the profile actually defines a timezone;
        // forcing one universal timezone for every identity is itself a
        // fingerprinting red flag.
        const targetTimezone = PROFILE.timezone;
        if (targetTimezone && typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
          const origResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
          Intl.DateTimeFormat.prototype.resolvedOptions = maskFunction(function() {
            const opts = origResolvedOptions.apply(this, arguments);
            opts.timeZone = targetTimezone;
            return opts;
          }, 'resolvedOptions');
        }
      } catch(geoErr) {}

      // 4. Hardware specs (UA and languages always follow the session; the
      // master toggle only gates the raw hardware counters)
      if (PROFILE.hardwareSpoof !== false) {
        if (PROFILE.platform) {
          Object.defineProperty(Navigator.prototype, 'platform', { get: () => PROFILE.platform, configurable: true, enumerable: true });
        }
        if (PROFILE.hardwareConcurrency) {
          Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => PROFILE.hardwareConcurrency, configurable: true, enumerable: true });
        }
        if (PROFILE.deviceMemory) {
          Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => PROFILE.deviceMemory, configurable: true, enumerable: true });
        }
      }
      if (PROFILE.languages) {
        Object.defineProperty(Navigator.prototype, 'languages', { get: () => Object.freeze([...PROFILE.languages]), configurable: true, enumerable: true });
        Object.defineProperty(Navigator.prototype, 'language', { get: () => PROFILE.languages[0], configurable: true, enumerable: true });
      }
      if (PROFILE.userAgent) {
        Object.defineProperty(Navigator.prototype, 'userAgent', { get: () => PROFILE.userAgent, configurable: true, enumerable: true });
        Object.defineProperty(Navigator.prototype, 'appVersion', { get: () => PROFILE.userAgent.replace(/^Mozilla\\//, ''), configurable: true, enumerable: true });
      }

      // 4b. Screen identity (classic fingerprint vector; must stay
      // consistent with the UA claiming a desktop OS)
      if (PROFILE.screenSpoof !== false && PROFILE.screenWidth > 0 && PROFILE.screenHeight > 0) {
        const sw = PROFILE.screenWidth;
        const sh = PROFILE.screenHeight;
        const dpr = PROFILE.devicePixelRatio || 1;
        const colorDepth = PROFILE.colorDepth || 24;
        const availHeight = Math.max(sh - 40, sh);

        const defineScreen = (target) => {
          Object.defineProperty(target, 'width', { get: () => sw, configurable: true });
          Object.defineProperty(target, 'height', { get: () => sh, configurable: true });
          Object.defineProperty(target, 'availWidth', { get: () => sw, configurable: true });
          Object.defineProperty(target, 'availHeight', { get: () => availHeight, configurable: true });
          Object.defineProperty(target, 'colorDepth', { get: () => colorDepth, configurable: true });
          Object.defineProperty(target, 'pixelDepth', { get: () => colorDepth, configurable: true });
        };
        if (window.Screen && window.Screen.prototype) defineScreen(Screen.prototype);
        try { defineScreen(window.screen); } catch(e) {}

        Object.defineProperty(window, 'devicePixelRatio', { get: () => dpr, configurable: true });

        // Outer dimensions reported as a normal maximized desktop window
        try {
          Object.defineProperty(window, 'outerWidth', { get: () => sw, configurable: true });
          Object.defineProperty(window, 'outerHeight', { get: () => availHeight, configurable: true });
        } catch(e) {}
      }

      // 5. Plugins
      const mockPlugins = [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
      ];
      const pluginArray = Object.create(PluginArray.prototype);
      mockPlugins.forEach((p, idx) => {
        const plug = Object.create(Plugin.prototype);
        Object.defineProperty(plug, 'name', { value: p.name });
        Object.defineProperty(plug, 'filename', { value: p.filename });
        Object.defineProperty(plug, 'description', { value: p.description });
        pluginArray[idx] = plug;
        pluginArray[p.name] = plug;
      });
      Object.defineProperty(pluginArray, 'length', { value: mockPlugins.length });
      Object.defineProperty(Navigator.prototype, 'plugins', { get: () => pluginArray, configurable: true, enumerable: true });

    } catch(e) {
      console.warn('Aegis: Cloudflare runtime init note:', e);
    }

    // =========================================================================
    // 2. CANVAS POISONING & SUB-PIXEL NOISE
    // =========================================================================
    if (PROFILE.canvasNoise !== false) {
      try {
        const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const origToBlob = HTMLCanvasElement.prototype.toBlob;
        const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        const origMeasureText = CanvasRenderingContext2D.prototype.measureText;

        function applyCanvasNoise(canvas) {
          try {
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const w = canvas.width;
            const h = canvas.height;
            if (w === 0 || h === 0 || w > 4096 || h > 4096) return;

            const imgData = origGetImageData.call(ctx, 0, 0, w, h);
            const data = imgData.data;
            const noiseFactor = (SEED % 5) + 1;
            const amp = Math.min(8, Math.max(0, Math.round((PROFILE.canvasNoiseLevel || 0.003) * 1000)));

            // Deterministic perturbation spread across the ENTIRE bitmap.
            // The stride caps touched pixels (~65k) so huge canvases stay fast,
            // while every region of the image contributes to the fingerprint,
            // not just the top-left corner.
            const stride = Math.max(16, Math.floor(data.length / 65536) * 4);
            for (let i = 0; i < data.length; i += stride) {
              if (data[i + 3] > 0) {
                data[i] = ((data[i] ^ noiseFactor) + amp) % 256;
              }
            }
            ctx.putImageData(imgData, 0, 0);
          } catch(e) {}
        }

        HTMLCanvasElement.prototype.toDataURL = maskFunction(function() {
          applyCanvasNoise(this);
          return origToDataURL.apply(this, arguments);
        }, 'toDataURL');

        HTMLCanvasElement.prototype.toBlob = maskFunction(function(callback, type, quality) {
          applyCanvasNoise(this);
          return origToBlob.apply(this, arguments);
        }, 'toBlob');

        CanvasRenderingContext2D.prototype.getImageData = maskFunction(function(sx, sy, sw, sh) {
          const imgData = origGetImageData.apply(this, arguments);
          try {
            const d = imgData.data;
            if (d && d.length > 0) {
              const step = (SEED % 7) + 1 + Math.min(6, Math.round((PROFILE.canvasNoiseLevel || 0.003) * 500));
              const stride = Math.max(32, Math.floor(d.length / 131072) * 4);
              for (let i = 0; i < d.length; i += stride) {
                if (d[i + 3] > 10) d[i] = (d[i] + step) % 256;
              }
            }
          } catch(e) {}
          return imgData;
        }, 'getImageData');

        CanvasRenderingContext2D.prototype.measureText = maskFunction(function(text) {
          const metrics = origMeasureText.apply(this, arguments);
          const shift = ((SEED % 100) / 1000000);
          return new Proxy(metrics, {
            get(target, prop) {
              const val = target[prop];
              return typeof val === 'number' ? val + shift : val;
            }
          });
        }, 'measureText');
      } catch(e) {}
    }

    // =========================================================================
    // 3. WEBGL & GPU HARDWARE MASK
    // =========================================================================
    if (PROFILE.webglSpoof !== false) {
      try {
        const vendor = PROFILE.vendor || 'Google Inc. (NVIDIA)';
        const renderer = PROFILE.renderer || 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)';

        const patchWebGL = (proto) => {
          const origGetParameter = proto.getParameter;
          const origGetExtension = proto.getExtension;

          proto.getParameter = maskFunction(function(parameter) {
            if (parameter === 37445 || parameter === 0x9245) return vendor;
            if (parameter === 37446 || parameter === 0x9246) return renderer;
            if (parameter === 7936) return 'WebKit';
            if (parameter === 7937) return 'WebKit WebGL';
            return origGetParameter.apply(this, arguments);
          }, 'getParameter');

          proto.getExtension = maskFunction(function(extName) {
            const ext = origGetExtension.apply(this, arguments);
            if (extName === 'WEBGL_debug_renderer_info' || extName === 'webgl_debug_renderer_info') {
              return { UNMASKED_VENDOR_WEBGL: 37445, UNMASKED_RENDERER_WEBGL: 37446 };
            }
            return ext;
          }, 'getExtension');
        };

        if (window.WebGLRenderingContext) patchWebGL(WebGLRenderingContext.prototype);
        if (window.WebGL2RenderingContext) patchWebGL(WebGL2RenderingContext.prototype);
      } catch(e) {}
    }

    // =========================================================================
    // 4. AUDIOCONTEXT PROTECTION
    // =========================================================================
    if (PROFILE.audioNoise !== false) {
      try {
        const origGetChannelData = AudioBuffer.prototype.getChannelData;
        AudioBuffer.prototype.getChannelData = maskFunction(function(channel) {
          const data = origGetChannelData.apply(this, arguments);
          const levelMul = (PROFILE.audioNoiseLevel || 0.0001) / 0.0001;
          const noiseOffset = ((SEED % 100) - 50) * 1e-7 * levelMul;
          for (let i = 0; i < data.length; i += 100) data[i] += noiseOffset;
          return data;
        }, 'getChannelData');
      } catch(e) {}
    }

    // =========================================================================
    // 4b. WEBGPU IDENTITY (adapter.info leaks the real GPU above WebGL spoof)
    // =========================================================================
    if (PROFILE.webglSpoof !== false && navigator.gpu && navigator.gpu.requestAdapter) {
      try {
        const gpuIdentity = PROFILE.platform === 'MacIntel'
          ? { vendor: 'apple', architecture: 'apple-m3-pro', device: 'Apple M3 Pro', description: 'Apple M3 Pro' }
          : PROFILE.platform === 'Linux x86_64'
            ? { vendor: 'mesa', architecture: 'radeonsi', device: PROFILE.renderer || 'Mesa GPU', description: PROFILE.renderer || 'Mesa GPU' }
            : { vendor: 'nvidia', architecture: '', device: PROFILE.renderer || 'NVIDIA GeForce RTX 4080', description: PROFILE.renderer || 'NVIDIA GeForce RTX 4080' };

        const origRequestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
        navigator.gpu.requestAdapter = maskFunction(async function () {
          const adapter = await origRequestAdapter.apply(navigator.gpu, arguments);
          if (!adapter) return null;
          try {
            Object.defineProperty(adapter, 'info', { get: () => ({ ...gpuIdentity }), configurable: true });
          } catch (e) {}
          if (typeof adapter.requestAdapterInfo === 'function') {
            adapter.requestAdapterInfo = maskFunction(async function () { return { ...gpuIdentity }; }, 'requestAdapterInfo');
          }
          return adapter;
        }, 'requestAdapter');
      } catch (e) {}
    }

    // =========================================================================
    // 4c. MEDIA DEVICES (real webcam/mic names and per-load device IDs leak)
    // =========================================================================
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const hashStr = (s) => {
          let h = SEED;
          for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
          return h.toString(36);
        };
        const origEnumerate = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
        navigator.mediaDevices.enumerateDevices = maskFunction(async function () {
          const devices = await origEnumerate();
          if (!devices.length) return devices;
          return devices.map(d => ({
            deviceId: hashStr('dev' + d.kind + (d.deviceId || '')),
            kind: d.kind,
            label: d.label,
            groupId: hashStr('grp' + d.kind + (d.groupId || '')),
            toJSON() { return this; }
          }));
        }, 'enumerateDevices');
      } catch (e) {}
    }

    // =========================================================================
    // 4d. SPEECH VOICES (OS voice list reveals the real system)
    // =========================================================================
    if (window.speechSynthesis && speechSynthesis.getVoices) {
      try {
        const fakeVoices = [
          { name: 'Google US English', lang: 'en-US', default: true, localService: false, voiceURI: 'Google US English' },
          { name: 'Google UK English Male', lang: 'en-GB', default: false, localService: false, voiceURI: 'Google UK English Male' },
          { name: 'Google UK English Female', lang: 'en-GB', default: false, localService: false, voiceURI: 'Google UK English Female' }
        ].map(v => {
          const vs = Object.create(SpeechSynthesisVoice.prototype);
          Object.defineProperty(vs, 'name', { value: v.name });
          Object.defineProperty(vs, 'lang', { value: v.lang });
          Object.defineProperty(vs, 'default', { value: v.default });
          Object.defineProperty(vs, 'localService', { value: v.localService });
          Object.defineProperty(vs, 'voiceURI', { value: v.voiceURI });
          return vs;
        });
        speechSynthesis.getVoices = maskFunction(function () { return fakeVoices; }, 'getVoices');
      } catch (e) {}
    }

    // =========================================================================
    // 5. WEBRTC LEAK PROTECTION
    // =========================================================================
    if (PROFILE.webrtcMode && PROFILE.webrtcMode !== 'default') {
      try {
        if (PROFILE.webrtcMode === 'disable_all' && window.RTCPeerConnection) {
          // Keep the object alive (undefined is an instant detection) but
          // strip every ICE candidate: the connection looks like it sits
          // behind a strict firewall - plausible, and nothing leaks
          const stripCandidates = (name) => {
            const orig = RTCPeerConnection.prototype[name];
            if (!orig) return;
            RTCPeerConnection.prototype[name] = maskFunction(function() {
              return orig.apply(this, arguments).then(desc => {
                if (desc && desc.sdp) {
                  desc.sdp = desc.sdp.replace(/^a=candidate:.*$/gmi, '').replace(/\\r\\n\\r\\n/g, '\\r\\n');
                }
                return desc;
              });
            }, name);
          };
          stripCandidates('createOffer');
          stripCandidates('createAnswer');
        } else if (window.RTCPeerConnection) {
          const origCreateOffer = RTCPeerConnection.prototype.createOffer;
          RTCPeerConnection.prototype.createOffer = maskFunction(function() {
            return origCreateOffer.apply(this, arguments).then(offer => {
              if (offer && offer.sdp) {
                offer.sdp = offer.sdp.replace(/a=candidate:.*\\s+typ\\s+host\\s+.*\\r\\n/gi, '');
              }
              return offer;
            });
          }, 'createOffer');
        }
      } catch(e) {}
    }

    // =========================================================================
    // 6. CLIENTRECTS JITTER (getBoundingClientRect fingerprinting defense)
    // =========================================================================
    // A tiny deterministic per-identity bias applied consistently to every
    // measurement. Constant (not random per call) so page layout logic and
    // element visibility checks stay intact.
    if (PROFILE.clientrectsJitter !== false) {
      try {
        const jitter = (((SEED % 13) - 6) / 100000);
        const origGBCR = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = maskFunction(function() {
          const rect = origGBCR.apply(this, arguments);
          return new DOMRect(rect.x + jitter, rect.y - jitter, rect.width + jitter, rect.height + jitter);
        }, 'getBoundingClientRect');

        const origGCRs = Element.prototype.getClientRects;
        Element.prototype.getClientRects = maskFunction(function() {
          const list = origGCRs.apply(this, arguments);
          const out = [];
          for (let i = 0; i < list.length; i++) {
            const r = list[i];
            out.push(new DOMRect(r.x + jitter, r.y - jitter, r.width + jitter, r.height + jitter));
          }
          out.item = (i) => out[i];
          return out;
        }, 'getClientRects');
      } catch(e) {}
    }

    console.log('%cZenith Stealth Core Active | Identity: ' + (PROFILE.name || 'Default'), 'color: #5b8def; font-weight: bold;');
  })();`;
}

module.exports = { generateStealthScript };
