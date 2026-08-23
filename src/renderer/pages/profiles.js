let profiles = [];
let activeProfileId = '';
let selectedProfileId = '';

async function loadProfiles() {
  if (window.aegisAPI) {
    try {
      profiles = await window.aegisAPI.getProfiles();
      const active = await window.aegisAPI.getActiveProfile();
      activeProfileId = active ? active.id : (profiles[0] ? profiles[0].id : '');
    } catch (e) {
      console.warn('Failed to load profiles:', e);
    }
  }

  if (profiles.length === 0) {
    profiles = [
      {
        id: 'profile_default',
        name: 'Stealth Win11 RTX4080',
        color: '#5b8def',
        seed: 48291,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        platform: 'Win32',
        vendor: 'Google Inc. (NVIDIA)',
        renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        hardwareConcurrency: 16,
        deviceMemory: 32,
        screenWidth: 1920,
        screenHeight: 1080,
        devicePixelRatio: 1,
        webrtcMode: 'disable_non_proxied_udp',
        proxy: { enabled: false, type: 'direct', server: '' }
      }
    ];
    activeProfileId = profiles[0].id;
  }

  if (!selectedProfileId) {
    selectedProfileId = activeProfileId;
  }

  renderProfileList();
  populateForm(selectedProfileId);
}

function renderProfileList() {
  const container = document.getElementById('profiles-list-container');
  container.innerHTML = '';

  profiles.forEach(p => {
    const isCurrent = p.id === activeProfileId;
    const isSelected = p.id === selectedProfileId;

    const card = document.createElement('div');
    card.className = `profile-card ${isSelected ? 'active-selected' : ''}`;
    card.onclick = () => selectProfile(p.id);

    const proxyLabel = p.proxy && p.proxy.enabled && p.proxy.server ? `${p.proxy.type.toUpperCase()}: ${p.proxy.server}` : 'Direct Connection';

    card.innerHTML = `
      <div class="profile-header">
        <div class="profile-title">
          <span class="color-dot" style="background-color: ${p.color || '#5b8def'};"></span>
          <span>${p.name}</span>
        </div>
        ${isCurrent ? '<span class="badge-current">Active</span>' : ''}
      </div>
      <div class="profile-specs">
        <span>OS: ${p.platform || 'Win32'} | ${p.hardwareConcurrency || 8} Cores | ${p.deviceMemory || 16}GB</span>
        <span>GPU: ${p.renderer ? p.renderer.substring(0, 28) + '...' : 'Default'}</span>
        <span>Proxy: ${proxyLabel}</span>
      </div>
    `;

    container.appendChild(card);
  });
}

function selectProfile(id) {
  selectedProfileId = id;
  renderProfileList();
  populateForm(id);
}

function populateForm(id) {
  const p = profiles.find(x => x.id === id);
  if (!p) return;

  document.getElementById('editor-title').textContent = `Edit Identity: ${p.name}`;
  document.getElementById('p-name').value = p.name || '';
  document.getElementById('p-seed').value = p.seed || 12345;
  document.getElementById('p-ua').value = p.userAgent || '';
  document.getElementById('p-platform').value = p.platform || 'Win32';
  document.getElementById('p-cores').value = p.hardwareConcurrency || 8;
  document.getElementById('p-ram').value = p.deviceMemory || 16;
  document.getElementById('p-vendor').value = p.vendor || 'Google Inc. (NVIDIA)';
  document.getElementById('p-renderer').value = p.renderer || 'ANGLE (NVIDIA, RTX 4080)';
  document.getElementById('p-screen-w').value = p.screenWidth || 1920;
  document.getElementById('p-screen-h').value = p.screenHeight || 1080;
  document.getElementById('p-screen-dpr').value = p.devicePixelRatio || 1;
  document.getElementById('p-webrtc').value = p.webrtcMode || 'disable_non_proxied_udp';
  document.getElementById('p-languages').value = (p.languages && p.languages.join(',')) || 'en-US,en';

  const proxy = p.proxy || {};
  document.getElementById('p-proxy-type').value = proxy.type || 'direct';
  document.getElementById('p-proxy-server').value = proxy.server || '';
}

async function saveProfile(e) {
  e.preventDefault();
  const p = profiles.find(x => x.id === selectedProfileId);
  if (!p) return;

  p.name = document.getElementById('p-name').value;
  p.seed = parseInt(document.getElementById('p-seed').value, 10);
  p.userAgent = document.getElementById('p-ua').value;
  p.platform = document.getElementById('p-platform').value;
  p.hardwareConcurrency = parseInt(document.getElementById('p-cores').value, 10);
  p.deviceMemory = parseInt(document.getElementById('p-ram').value, 10);
  p.vendor = document.getElementById('p-vendor').value;
  p.renderer = document.getElementById('p-renderer').value;
  p.screenWidth = parseInt(document.getElementById('p-screen-w').value, 10);
  p.screenHeight = parseInt(document.getElementById('p-screen-h').value, 10);
  p.devicePixelRatio = parseFloat(document.getElementById('p-screen-dpr').value);
  p.webrtcMode = document.getElementById('p-webrtc').value;

  const rawLangs = document.getElementById('p-languages').value.trim();
  p.languages = rawLangs ? rawLangs.split(',').map(s => s.trim()) : ['en-US', 'en'];

  const proxyType = document.getElementById('p-proxy-type').value;
  const proxyServer = document.getElementById('p-proxy-server').value.trim();
  p.proxy = {
    enabled: proxyType !== 'direct' && proxyServer.length > 0,
    type: proxyType,
    server: proxyServer
  };

  if (window.aegisAPI) {
    await window.aegisAPI.saveProfile(p);
  }

  renderProfileList();
}

async function activateCurrentProfile() {
  if (selectedProfileId) {
    activeProfileId = selectedProfileId;
    if (window.aegisAPI) {
      await window.aegisAPI.setActiveProfile(selectedProfileId);
    }
    renderProfileList();
  }
}

async function generateRandomProfile() {
  if (window.aegisAPI) {
    const newP = await window.aegisAPI.generateRandomFingerprint('Random Ghost Identity ' + (profiles.length + 1));
    await window.aegisAPI.saveProfile(newP);
    profiles.push(newP);
    selectedProfileId = newP.id;
    renderProfileList();
    populateForm(newP.id);
  }
}

function createNewProfile() {
  const newP = {
    id: 'profile_' + Date.now(),
    name: 'Stealth Linux Mesa',
    color: '#3ecf8e',
    seed: Math.floor(Math.random() * 100000),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    platform: 'Win32',
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    hardwareConcurrency: 12,
    deviceMemory: 16,
    screenWidth: 1920,
    screenHeight: 1080,
    devicePixelRatio: 1,
    webrtcMode: 'disable_non_proxied_udp',
    proxy: { enabled: false, type: 'direct', server: '' }
  };

  profiles.push(newP);
  selectedProfileId = newP.id;
  renderProfileList();
  populateForm(newP.id);
}

async function deleteCurrentProfile() {
  if (profiles.length <= 1) {
    alert('You must keep at least one profile!');
    return;
  }
  if (confirm(`Delete identity profile "${document.getElementById('p-name').value}"?`)) {
    if (window.aegisAPI) {
      await window.aegisAPI.deleteProfile(selectedProfileId);
    }
    profiles = profiles.filter(x => x.id !== selectedProfileId);
    selectedProfileId = profiles[0].id;
    if (activeProfileId === selectedProfileId) {
      activeProfileId = profiles[0].id;
    }
    renderProfileList();
    populateForm(selectedProfileId);
  }
}

window.addEventListener('DOMContentLoaded', loadProfiles);
