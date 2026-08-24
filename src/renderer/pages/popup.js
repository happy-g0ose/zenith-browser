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
      ${MENU_ITEMS.map(([, svgPath, label, url]) => `
        <button class="menu-item" data-go="${esc(url)}">
          <svg viewBox="0 0 24 24"><path d="${svgPath}"/></svg>
          <span>${esc(label)}</span>
        </button>`).join('')}
      <button class="menu-item" data-go="about:newtab-incognito">
        <svg viewBox="0 0 24 24"><path d="M9 3.5h6a2 2 0 0 1 1.97 1.63L18 9.5"/><path d="M6 9.5l1.03-4.37A2 2 0 0 1 9 3.5"/><path d="M3.5 9.5h17"/><circle cx="8.5" cy="16" r="2.75"/><circle cx="15.5" cy="16" r="2.75"/><path d="M11.25 16h1.5"/></svg>
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
  else if (type === 'palette') renderPalette();
  else if (type === 'engine') renderEngine();
  else renderMenu();
} else {
  panel.innerHTML = '<div style="padding:20px;color:var(--text-muted)">Мост недоступен</div>';
}

// ---- Quick search engine picker ----
const ENGINE_LIST = [
  ['duckduckgo', 'DuckDuckGo'],
  ['brave', 'Brave Search'],
  ['google', 'Google'],
  ['searx', 'SearXNG']
];

function engineDot(key) {
  const icon = (window.ENGINE_ICONS && window.ENGINE_ICONS[key]) || { color: '#888', path: '' };
  return `<span style="width:20px;height:20px;border-radius:50%;background:${icon.color};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">
    <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><path d="${icon.path}"/></svg>
  </span>`;
}

async function renderEngine() {
  let current = 'duckduckgo';
  try { current = (await window.aegisAPI.getPref('ui.search.default_engine')) || current; } catch (e) {}

  panel.innerHTML = `
    <div class="popup-header">
      <span class="popup-title">Поисковик по умолчанию</span>
    </div>
    <div class="menu-items-list" style="margin-top:2px">
      ${ENGINE_LIST.map(([key, name]) => `
        <button class="menu-item" data-engine="${key}">
          ${engineDot(key)}
          <span style="${key === current ? 'color:var(--accent);font-weight:600' : ''}">${esc(name)}</span>
          ${key === current ? '<span class="menu-shortcut" style="color:var(--accent)">●</span>' : ''}
        </button>`).join('')}
    </div>`;

  panel.querySelectorAll('[data-engine]').forEach(btn => {
    btn.onclick = async () => {
      if (!window.aegisAPI) return;
      await window.aegisAPI.setPref('ui.search.default_engine', btn.dataset.engine);
      closeMe();
    };
  });
}

// ---- Command palette ----
const PALETTE_COMMANDS = [
  { title: 'Новая вкладка',                 key: 'Ctrl+T',        run: () => window.aegisAPI.createNewTab('about:newtab') },
  { title: 'Новая инкогнито-вкладка',       key: 'Ctrl+Shift+N',  run: () => window.aegisAPI.createIncognitoTab('about:newtab') },
  { title: 'Аудит фингерпринта',            key: 'Internal',      run: () => go('about:fingerprint') },
  { title: 'Профили личности',              key: 'Internal',      run: () => go('about:profiles') },
  { title: 'Редактор userChrome.css',       key: 'Internal',      run: () => go('about:customizer') },
  { title: 'Настройки',                     key: 'Internal',      run: () => go('about:config') },
  { title: 'Магазин расширений',            key: 'Internal',      run: () => go('about:extensions') },
  { title: 'Сгенерировать случайную личность', key: 'Stealth',    run: async () => {
      const p = await window.aegisAPI.generateRandomFingerprint();
      await window.aegisAPI.saveProfile(p);
      await window.aegisAPI.setActiveProfile(p.id);
    } },
  { title: 'Переключить вертикальные вкладки', key: 'Layout',     run: async () => {
      const pos = await window.aegisAPI.getPref('ui.tabs.position', 'top');
      await window.aegisAPI.setPref('ui.tabs.position', pos === 'left' ? 'top' : 'left');
      await window.aegisAPI.reloadUIStyles();
    } },
  { title: 'Сбросить счётчик блокировок',   key: 'Privacy',       run: () => window.aegisAPI.resetShieldStats() },
  { title: 'Тема: Stealth Dark',            key: 'Theme',         run: () => window.aegisAPI.setPref('ui.theme', 'stealth-dark') },
  { title: 'Тема: OLED Black',              key: 'Theme',         run: () => window.aegisAPI.setPref('ui.theme', 'oled-black') },
  { title: 'Тема: Nord',                    key: 'Theme',         run: () => window.aegisAPI.setPref('ui.theme', 'nord') },
  { title: 'Тема: Tokyo Night',             key: 'Theme',         run: () => window.aegisAPI.setPref('ui.theme', 'tokyo-night') },
  { title: 'Тема: Gruvbox',                 key: 'Theme',         run: () => window.aegisAPI.setPref('ui.theme', 'gruvbox') },
  { title: 'Тема: Paper Light',             key: 'Theme',         run: () => window.aegisAPI.setPref('ui.theme', 'paper-light') }
];

async function renderPalette() {
  panel.innerHTML = `
    <div class="palette-input-wrapper">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" class="palette-input" id="pal-input" placeholder="Введите команду..." autocomplete="off" spellcheck="false">
    </div>
    <div class="palette-results" id="pal-results"></div>`;
  const input = $('pal-input');
  const results = $('pal-results');
  let filtered = PALETTE_COMMANDS;
  let selected = 0;

  function render() {
    if (!filtered.length) {
      results.innerHTML = '<div class="palette-empty">Ничего не найдено</div>';
      return;
    }
    results.innerHTML = filtered.map((c, i) => `
      <button class="palette-item ${i === selected ? 'selected' : ''}" data-i="${i}">
        <span>${esc(c.title)}</span><span class="p-key">${esc(c.key)}</span>
      </button>`).join('');
  }

  function exec(cmd) {
    closeMe();
    try { Promise.resolve(cmd.run()).catch(() => {}); } catch (e) {}
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    filtered = PALETTE_COMMANDS.filter(c => c.title.toLowerCase().includes(q));
    selected = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); selected = Math.min(selected + 1, filtered.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selected = Math.max(selected - 1, 0); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[selected]) exec(filtered[selected]); }
    else if (e.key === 'Escape') { closeMe(); }
  });
  results.addEventListener('click', (e) => {
    const btn = e.target.closest('.palette-item');
    if (btn && filtered[btn.dataset.i]) exec(filtered[btn.dataset.i]);
  });

  render();
  setTimeout(() => input.focus(), 40);
}
