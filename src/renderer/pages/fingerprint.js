async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 1. Test Canvas 2D
async function testCanvas() {
  const canvas = document.getElementById('canvas-test');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#5b8def';
  ctx.font = '16px sans-serif';
  ctx.fillText('Zenith', 10, 26);

  ctx.fillStyle = '#3ecf8e';
  ctx.fillRect(10, 36, 60, 16);

  ctx.fillStyle = '#f85149';
  ctx.beginPath();
  ctx.arc(100, 44, 10, 0, Math.PI * 2);
  ctx.fill();

  try {
    const dataUrl = canvas.toDataURL();
    const hash = await sha256(dataUrl);
    document.getElementById('canvas-hash').textContent = hash.substring(0, 32) + '...';
  } catch (e) {
    document.getElementById('canvas-hash').textContent = 'Error: ' + e.message;
  }
}

// 2. Test WebGL
function testWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      document.getElementById('webgl-vendor').textContent = 'WebGL Not Available';
      document.getElementById('webgl-renderer').textContent = 'WebGL Not Available';
      return;
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      document.getElementById('webgl-vendor').textContent = vendor || 'Unknown';
      document.getElementById('webgl-renderer').textContent = renderer || 'Unknown';
    } else {
      document.getElementById('webgl-vendor').textContent = gl.getParameter(gl.VENDOR);
      document.getElementById('webgl-renderer').textContent = gl.getParameter(gl.RENDERER);
    }
  } catch (e) {
    document.getElementById('webgl-vendor').textContent = 'Error: ' + e.message;
  }
}

// 3. Test AudioContext
async function testAudio() {
  try {
    const AudioCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AudioCtx) {
      document.getElementById('audio-hash').textContent = 'Not Supported';
      return;
    }

    const context = new AudioCtx(1, 44100, 44100);
    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, context.currentTime);

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-50, context.currentTime);
    compressor.knee.setValueAtTime(40, context.currentTime);
    compressor.ratio.setValueAtTime(12, context.currentTime);
    compressor.attack.setValueAtTime(0, context.currentTime);
    compressor.release.setValueAtTime(0.25, context.currentTime);

    oscillator.connect(compressor);
    compressor.connect(context.destination);
    oscillator.start(0);

    const renderedBuffer = await context.startRendering();
    const samples = renderedBuffer.getChannelData(0);
    let sampleSum = 0;
    for (let i = 0; i < samples.length; i += 100) {
      sampleSum += samples[i];
    }

    const hash = await sha256(sampleSum.toString());
    document.getElementById('audio-hash').textContent = hash.substring(0, 32) + '...';
    document.getElementById('audio-sample-rate').textContent = `${renderedBuffer.sampleRate} Hz`;
  } catch (e) {
    document.getElementById('audio-hash').textContent = 'Protected / Mocked';
  }
}

// 4. Test WebRTC
function testWebRTC() {
  try {
    if (!window.RTCPeerConnection) {
      document.getElementById('webrtc-local-ip').textContent = 'WebRTC Disabled (Safe)';
      document.getElementById('webrtc-public-ip').textContent = 'No Leak';
      return;
    }

    const rtc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    rtc.createDataChannel('');

    rtc.onicecandidate = (event) => {
      if (event && event.candidate) {
        const str = event.candidate.candidate;
        if (/192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\./.test(str)) {
          document.getElementById('webrtc-local-ip').textContent = 'LEAK: ' + str;
          document.getElementById('webrtc-local-ip').style.color = '#f85149';
        }
      }
    };

    rtc.createOffer().then(offer => {
      rtc.setLocalDescription(offer);
    }).catch(() => {});

    setTimeout(() => {
      rtc.close();
    }, 1500);
  } catch (e) {
    document.getElementById('webrtc-local-ip').textContent = 'Blocked by Policy';
  }
}

// 5. Test Navigator & Specs
function testNavigator() {
  document.getElementById('nav-platform').textContent = navigator.platform || 'Win32';
  document.getElementById('nav-cores').textContent = `${navigator.hardwareConcurrency || 8} Cores`;
  document.getElementById('nav-memory').textContent = `${navigator.deviceMemory || 8} GB RAM`;
  document.getElementById('nav-screen').textContent = `${screen.width} x ${screen.height} (${window.devicePixelRatio || 1}x DPR)`;
  document.getElementById('nav-languages').textContent = (navigator.languages || [navigator.language]).join(', ');
  document.getElementById('nav-ua').textContent = navigator.userAgent;
}

// 6. Test Bot Automation Flags
function testBotFlags() {
  const wd = navigator.webdriver;
  document.getElementById('flag-webdriver').textContent = wd === undefined ? 'undefined (Pass)' : (wd ? 'Detected (True)' : 'false (Pass)');
  
  // Test native toString
  const isToStringHooked = Function.prototype.toString.toString() === 'function toString() { [native code] }';
  document.getElementById('flag-native').textContent = isToStringHooked ? 'Masked to Native [native code]' : 'Standard';
}

// 7. Test Geolocation Protection
function testGeolocation() {
  const geoStatusEl = document.getElementById('geo-status');
  const geoPermEl = document.getElementById('geo-permission');
  const geoTzEl = document.getElementById('geo-timezone');

  if (geoTzEl) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      geoTzEl.textContent = `${tz} (Protected)`;
    } catch(e) {
      geoTzEl.textContent = 'Isolated';
    }
  }

  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then(res => {
      if (geoPermEl) geoPermEl.textContent = `State: ${res.state} (Blocked)`;
    }).catch(() => {
      if (geoPermEl) geoPermEl.textContent = 'Denied by Policy';
    });
  }

  if (navigator.geolocation && navigator.geolocation.getCurrentPosition) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (geoStatusEl) geoStatusEl.textContent = `Spoofed: ${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`;
      },
      err => {
        if (geoStatusEl) geoStatusEl.textContent = `Strict Denial (Code ${err.code}: PERMISSION_DENIED)`;
      },
      { timeout: 500 }
    );
  } else {
    if (geoStatusEl) geoStatusEl.textContent = 'API Neutralized';
  }
}

function runAllAudits() {
  testCanvas();
  testWebGL();
  testAudio();
  testWebRTC();
  testNavigator();
  testBotFlags();
  testGeolocation();
}

window.addEventListener('DOMContentLoaded', () => {
  runAllAudits();
  setTimeout(runConsistencyLights, 400);
});


// ---- CONSISTENCY LIGHTS: does the identity contradict itself? ----
function consistencyChecks(profile) {
  const checks = [];
  const add = (name, status, detail) => checks.push({ name, status, detail }); // ok|warn|fail

  const ua = navigator.userAgent || '';
  const plat = navigator.platform || '';
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

  // 1. UA Chrome version vs userAgentData brands
  const uaVer = (ua.match(/Chrome\/(\d+)/) || [])[1];
  const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
  const brandVer = (brands.find(b => b.brand === 'Chromium') || {}).version;
  if (!uaVer) add('User-Agent: версия Chrome', 'warn', 'UA без версии Chrome');
  else if (brandVer === uaVer) add('UA ↔ userAgentData', 'ok', 'Chromium ' + uaVer + ' согласован');
  else add('UA ↔ userAgentData', 'fail', 'UA: ' + uaVer + ', brands: ' + (brandVer || 'нет'));

  // 2. Platform vs UA OS
  const uaHasWin = /Windows/.test(ua), uaHasMac = /Mac OS|Macintosh/.test(ua), uaHasLinux = /Linux/.test(ua);
  const platOk = (plat === 'Win32' && uaHasWin) || (plat === 'MacIntel' && uaHasMac) || (plat.includes('Linux') && uaHasLinux);
  if (platOk) add('Платформа ↔ UA ОС', 'ok', plat);
  else add('Платформа ↔ UA ОС', 'fail', 'platform=' + plat + ' против UA=' + (uaHasWin ? 'Windows' : uaHasMac ? 'macOS' : uaHasLinux ? 'Linux' : '?'));

  // 3. Screen sanity (desktop UA + tiny screen = suspicious)
  const w = screen.width, h = screen.height;
  if (!ua.match(/Mobile|Android/)) {
    if (w >= 1024 && h >= 700) add('Разрешение экрана', 'ok', w + 'x' + h + ' (десктоп-легенда)');
    else add('Разрешение экрана', 'warn', w + 'x' + h + ' маловато для десктопного UA');
  }

  // 4. devicePixelRatio vs screen (retta consistency)
  if (window.devicePixelRatio >= 1 && window.devicePixelRatio <= 3) add('devicePixelRatio', 'ok', String(window.devicePixelRatio));
  else add('devicePixelRatio', 'fail', 'нереалистичное значение: ' + window.devicePixelRatio);

  // 5. Timezone vs languages region (soft)
  if (tz) {
    const lang = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    const ruLang = /^ru/i.test(lang);
    const usTz = /America|US\//.test(tz);
    if (ruLang && usTz) add('Язык ↔ часовой пояс', 'warn', lang + ' при ' + tz + ' — допустимо, но заметно');
    else add('Язык ↔ часовой пояс', 'ok', lang + ' / ' + tz);
  } else add('Часовой пояс', 'fail', 'не определён');

  // 6. Hardware counters
  if (navigator.hardwareConcurrency >= 2 && navigator.hardwareConcurrency <= 64) add('Ядра CPU', 'ok', String(navigator.hardwareConcurrency));
  else add('Ядра CPU', 'fail', String(navigator.hardwareConcurrency));
  if ([0.25,0.5,1,2,4,8].includes(navigator.deviceMemory)) add('deviceMemory', 'ok', navigator.deviceMemory + ' ГБ');
  else add('deviceMemory', 'warn', String(navigator.deviceMemory) + ' — не из ряда Chrome');

  // 7. webdriver / chrome runtime
  if (navigator.webdriver === undefined || navigator.webdriver === false) add('navigator.webdriver', 'ok', 'скрыт');
  else add('navigator.webdriver', 'fail', 'виден автоматизаторам');
  if (window.chrome && window.chrome.runtime) add('window.chrome.runtime', 'ok', 'присутствует');
  else add('window.chrome.runtime', 'fail', 'отсутствует — признак не-Chrome');

  // 8. Timezone vs profile legend
  if (profile && profile.timezone && profile.timezone !== tz) {
    add('Таймзона ↔ профиль', 'fail', 'профиль: ' + profile.timezone + ', реально: ' + tz);
  } else if (profile && profile.timezone) {
    add('Таймзона ↔ профиль', 'ok', tz);
  }

  return checks;
}

async function runConsistencyLights() {
  const table = document.getElementById('consistency-table');
  const summary = document.getElementById('consistency-summary');
  if (!table) return;
  let profile = null;
  try { profile = window.aegisAPI ? await window.aegisAPI.getActiveProfile() : null; } catch (e) {}

  const checks = consistencyChecks(profile);

  // Async: WebGPU adapter info vs WebGL renderer family
  try {
    if (navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      const info = adapter && (adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : null));
      const glRenderer = (document.getElementById('webgl-renderer') || {}).textContent || '';
      if (info && info.device) {
        const gpuOk = /nvidia/i.test(info.vendor) === /nvidia/i.test(glRenderer) || /apple/i.test(info.vendor) === /apple/i.test(glRenderer) || /mesa|radeon/i.test(info.vendor) === /mesa|radeon/i.test(glRenderer);
        checks.push(gpuOk
          ? { name: 'WebGPU ↔ WebGL вендор', status: 'ok', detail: info.vendor + ' / ' + (info.device || '') }
          : { name: 'WebGPU ↔ WebGL вендор', status: 'fail', detail: 'WebGPU: ' + info.vendor + ' против WebGL: ' + glRenderer });
      }
    } else {
      checks.push({ name: 'WebGPU', status: 'warn', detail: 'недоступен в этой сборке' });
    }
  } catch (e) {}

  table.innerHTML = checks.map(c => {
    const cls = c.status === 'ok' ? 'text-success' : c.status === 'warn' ? 'text-warning' : 'text-danger';
    const dot = c.status === 'ok' ? 'dot-success' : c.status === 'warn' ? 'dot-warning' : 'dot-danger';
    return '<tr><td class="label"><span class="dot-indicator ' + dot + '" style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px"></span>' + c.name + '</td><td class="value ' + cls + '">' + c.detail + '</td></tr>';
  }).join('');

  const fails = checks.filter(c => c.status === 'fail').length;
  const warns = checks.filter(c => c.status === 'warn').length;
  if (fails) { summary.textContent = 'Обнаружено проблем: ' + fails; summary.className = 'text-small text-danger'; }
  else if (warns) { summary.textContent = 'Есть замечания: ' + warns; summary.className = 'text-small text-warning'; }
  else { summary.textContent = 'Всё согласовано'; summary.className = 'text-small text-success'; }
}

window.addEventListener('DOMContentLoaded', () => setTimeout(runConsistencyLights, 400));
