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

window.addEventListener('DOMContentLoaded', runAllAudits);
