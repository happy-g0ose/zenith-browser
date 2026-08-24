const $ = (id) => document.getElementById(id);
const panel = $('panel');
const type = new URLSearchParams(location.search).get('panel') || 'menu';

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function closeMe() { window.close(); }

function go(url) { if (window.aegisAPI) window.aegisAPI.navigateCurrent(url); closeMe(); }

const THEMES = [
  ['stealth-dark', 'Stealth Dark', '#0b0d11'],
  ['oled-black', 'OLED Black', '#000000'],
  ['nord', 'Nord', '#242933'],
  ['tokyo-night', 'Tokyo Night', '#1a1b26'],
  ['gruvbox', 'Gruvbox', '#1d2021'],
  ['paper-light', 'Paper Light', '#f6f8fa']
];

const MENU_ITEMS = [
  ['profiles', 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4', 'Профили цифровой личности', 'about:profiles'],
  ['fingerprint', 'M12 10a2 2 0 100 4 2 2 0 000-4z"/><circle cx="12" cy="12" r="9" stroke-dasharray="3 3', 'Аудит фингерпринта', 'about:fingerprint'],
  ['config', 'M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.51 1 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.14.62.63 1.11 1.25 1.25H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z', 'Настройки и конфигурация', 'about:config'],
  ['customizer', 'M12 2 2 7l10 5 10-5-10-5z"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12', 'Редактор userChrome.css', 'about:customizer'],
  ['extensions', 'M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z', 'Магазин расширений', 'about:extensions']
];

async function renderMenu() {
  let theme = 'stealth-dark';
  let profileName = 'Default';
  let profileColor = '#5b8def';
  try { theme = (await window.aegisAPI.getPref('ui.theme')) || theme; } catch (e) {}
  try {
    const p = await window.aegisAPI.getActiveProfile();
    if (p) { profileName = p.name; profileColor = p.color || profileColor; }
  } catch (e) {}

  panel.innerHTML = `
    <div class="menu-profile-card">
      <div class="profile-info">
        <span class="profile-dot-large" style="background:${esc(profileColor)};color:${esc(profileColor)}"></span>
        <div class="profile-texts">
          <span class="profile-label">Текущая личность</span>
          <span class="profile-name">${esc(profileName.replace(/^[^\w\sа-яА-ЯёЁ]+/, '').trim() || profileName)}</span>
        </div>
      </div>
      <button class="menu-sub-btn" id="p-switch">Профили</button>
    </div>
    <div class="menu-divider"></div>
    <div class="menu-items-list">
      ${MENU_ITEMS.map(([id, path, label]) => `
        <button class="menu-item" data-go="${id}">
          <svg viewBox="0 0 24 24"><path d="${path}"/></svg>
          <span>${esc(label)}</span>
        </button>`).join('')}
      <button class="menu-item" data-go="about:newtab-incognito">
        <svg viewBox="0 0 24 24"><path d="M4 8.5l8-2.5 8 2.5"/><path d="M4.5 8.5V13a7.5 3.5 0 0 0 15 0V8.5"/><path d="M9 12.5a1.5 1 0 0 0 3-.2M12 12.3a1.5 1 0 0 0 3 .2"/></svg>
        <span>Инкогнито-вкладка (без следа)</span>
        <span class="menu-shortcut">Ctrl+Shift+N</span>
      </button>
    </div>
    <div class="menu-theme-row">
      <span class="menu-subhead">Тема</span>
      <div class="theme-bubbles">
        ${THEMES.map(([val, title, bg]) => `
          <button class="theme-bubble ${val === theme ? 'active' : ''}" data-theme="${val}" title="${title}"
            style="background:${bg};border:1px solid ${val === theme ? 'var(--accent)' : '#333'}"></button>`).join('')}
      </div>
    </div>`;

  panel.querySelectorAll('[data-go]').forEach(btn => {
    btn.onclick = () => {
      const target = btn.dataset.go;
      if (target === 'about:newtab-incognito') {
        if (window.aegisAPI) window.aegisAPI.createIncognitoTab('about:newtab');
        closeMe();
      } else {
        go(target);
      }
    };
  });
  $('p-switch').onclick = () => go('about:profiles');
  panel.querySelectorAll('.theme-bubble').forEach(btn => {
    btn.onclick = async () => {
      if (!window.aegisAPI) return;
      await window.aegisAPI.setPref('ui.theme', btn.dataset.theme);
      closeMe();
    };
  });
}

async function renderShield() {
  let blocked = 0;
  let tor = { running: false, available: false };
  try { const s = await window.aegisAPI.getShieldStats(); if (s) blocked = s.totalBlocked || 0; } catch (e) {}
  try { tor = await window.aegisAPI.getTorStatus(); } catch (e) {}

  panel.innerHTML = `
    <div class="popup-header">
      <div class="popup-title-group">
        <svg viewBox="0 0 24 24" width="16" height="16" class="icon-green" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span class="popup-title">Щит приватности</span>
      </div>
      <span class="badge-status">Активен</span>
    </div>
    <div class="popup-content">
      <div class="popup-stat-row"><span class="stat-label">Заблокировано трекеров и рекламы</span><span class="stat-value" id="p-blocked">${blocked}</span></div>
      <div class="popup-stat-row"><span class="stat-label">Доступ к геолокации</span><span class="stat-value text-green">Заблокирован</span></div>
      <div class="popup-stat-row"><span class="stat-label">Шум Canvas & WebGL</span><span class="stat-value text-green">Активен</span></div>
      <div class="popup-stat-row"><span class="stat-label">Защита от утечек WebRTC</span><span class="stat-value text-green">Изолирован</span></div>
      <div class="popup-stat-row"><span class="stat-label">Tor</span><span class="stat-value" id="p-tor">${tor.running ? 'Подключён' : (tor.available ? 'Остановлен' : 'Недоступен')}</span></div>
    </div>
    <div class="popup-footer">
      <button class="popup-btn" id="p-tor-btn">${tor.running ? 'Tor работает' : 'Запустить Tor (9050)'}</button>
      <button class="popup-btn" id="p-audit">Аудит отпечатков</button>
    </div>`;

  const torBtn = $('p-tor-btn');
  if (tor.running) torBtn.disabled = true;
  torBtn.onclick = async () => {
    torBtn.textContent = 'Подключение...';
    torBtn.disabled = true;
    try {
      await window.aegisAPI.startTor();
      const st = await window.aegisAPI.getTorStatus();
      $('p-tor').textContent = st.running ? 'Подключён' : 'Не удалось';
    } catch (e) {}
  };
  $('p-audit').onclick = () => go('about:fingerprint');
}

if (window.aegisAPI) {
  if (type === 'shield') renderShield();
  else renderMenu();
} else {
  panel.innerHTML = '<div style="padding:20px;color:var(--text-muted)">Мост недоступен</div>';
}
