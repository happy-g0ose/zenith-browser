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
  else if (type === 'extlist') renderExtList();
  else if (type === 'downloads') renderDownloads();
  else if (type === 'folder') renderFolder();
  else if (type === 'bmadd') renderBmAdd();
  else renderMenu();
} else {
  panel.innerHTML = '<div style="padding:20px;color:var(--text-muted)">Мост недоступен</div>';
}

// ---- Downloads ----
function fmtSize(bytes) {
  if (!bytes) return '';
  const u = ['Б', 'КБ', 'МБ', 'ГБ'];
  let i = 0, v = bytes;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return v.toFixed(v >= 10 || i === 0 ? 0 : 1) + ' ' + u[i];
}

async function renderDownloads() {
  let list = [];
  try { list = (await window.aegisAPI.getDownloads()) || []; } catch (e) {}
  list = list.slice().reverse();

  const rows = list.map(d => {
    const pct = d.total ? Math.round((d.received / d.total) * 100) : (d.state === 'done' ? 100 : 0);
    const stateText = d.state === 'done' ? fmtSize(d.total || d.received)
      : d.state === 'cancelled' ? 'Отменено'
      : d.state === 'paused' ? 'Пауза · ' + fmtSize(d.received)
      : fmtSize(d.received) + (d.total ? ' из ' + fmtSize(d.total) : '');
    return `
      <div class="dl-row">
        <div class="dl-top">
          <span class="dl-name" title="${esc(d.name)}">${esc(d.name)}</span>
          <span class="dl-size">${stateText}</span>
        </div>
        <div class="dl-bar"><div class="dl-fill${d.state === 'done' ? ' done' : ''}" style="width:${pct}%"></div></div>
        <div class="dl-btns">
          ${d.state === 'done' ? `<button class="ext-manage dl-open" data-id="${esc(d.id)}">Открыть</button>` : ''}
          <button class="ext-manage dl-show" data-id="${esc(d.id)}">Папка</button>
        </div>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="popup-header"><span class="popup-title">Загрузки</span></div>
    <div style="overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-top:4px">
      ${rows || '<div class="ext-empty">Загрузок пока нет</div>'}
    </div>`;

  panel.querySelectorAll('.dl-open').forEach(b => { b.onclick = () => window.aegisAPI.openDownload(b.dataset.id); });
  panel.querySelectorAll('.dl-show').forEach(b => { b.onclick = () => window.aegisAPI.showDownloadInFolder(b.dataset.id); });
}

// ---- Folder quick links ----
function chipHtml(item) {
  const letter = (item.title || item.url || '?').replace(/^https?:\/\/(www\.)?/, '')[0].toUpperCase();
  const colors = ['#de5833', '#5b8def', '#3ecf8e', '#d29922', '#8b5cf6', '#06b6d4', '#ec4899', '#f85149'];
  let hash = 0;
  const s = String(item.url || '');
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return `<span class="bm-chip" style="width:18px;height:18px;background:${colors[hash % colors.length]}">${esc(letter)}</span>`;
}

async function renderFolder() {
  const folderId = new URLSearchParams(location.search).get('id');
  let folder = null;
  try {
    const all = await window.aegisAPI.getBookmarks();
    const find = (list) => {
      for (const b of list) {
        if (b.id === folderId) return b;
        if (b.children) { const f = find(b.children); if (f) return f; }
      }
      return null;
    };
    folder = find(all || []);
  } catch (e) {}

  const children = (folder && folder.children) || [];
  panel.innerHTML = `
    <div class="popup-header">
      <span class="popup-title">${esc((folder && folder.name) || 'Папка')}</span>
    </div>
    <div style="overflow-y:auto;display:flex;flex-direction:column;gap:2px;margin-top:2px">
      ${children.length ? children.map(item => `
        <button class="menu-item" data-url="${esc(item.url)}">
          ${chipHtml(item)}
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.title || item.url)}</span>
        </button>`).join('') : '<div class="ext-empty">Папка пуста</div>'}
    </div>`;

  panel.querySelectorAll('[data-url]').forEach(btn => {
    btn.onclick = () => go(btn.dataset.url);
  });
}

// ---- Add bookmark / folder ----
async function renderBmAdd() {
  let bookmarks = [];
  try { bookmarks = await window.aegisAPI.getBookmarks(); } catch (e) {}
  const folders = (bookmarks || []).filter(b => b.children);

  panel.innerHTML = `
    <div class="popup-header"><span class="popup-title">Закладки</span></div>
    <div style="display:flex;flex-direction:column;gap:14px;margin-top:4px">
      <div>
        <div class="form-label">Новая ссылка</div>
        <input class="form-input" id="bm-name" placeholder="Название" autocomplete="off">
        <input class="form-input" id="bm-url" placeholder="https://..." autocomplete="off" spellcheck="false">
        <select class="form-input" id="bm-folder">
          <option value="">— В панель закладок —</option>
          ${folders.map(f => `<option value="${esc(f.id)}">В папку: ${esc(f.name)}</option>`).join('')}
        </select>
        <button class="ext-manage" id="bm-add-link" style="margin-top:8px">Добавить ссылку</button>
      </div>
      <div>
        <div class="form-label">Новая папка</div>
        <input class="form-input" id="fd-name" placeholder="Название папки" autocomplete="off">
        <button class="ext-manage" id="bm-add-folder" style="margin-top:8px">Создать папку</button>
      </div>
    </div>`;

  $('bm-add-link').onclick = async () => {
    const name = $('bm-name').value.trim();
    let url = $('bm-url').value.trim();
    if (!url) return;
    if (!/^(https?:\/\/|about:)/i.test(url)) url = 'https://' + url;
    const folderId = $('bm-folder').value;
    if (folderId) await window.aegisAPI.addItemToFolder(folderId, { title: name || url, url });
    else await window.aegisAPI.addBookmark({ title: name || url, url });
    closeMe();
  };
  $('bm-add-folder').onclick = async () => {
    const name = $('fd-name').value.trim();
    if (!name) return;
    await window.aegisAPI.addFolder(name);
    closeMe();
  };
}

// ---- Extensions list (Opera-style dropdown) ----
async function renderExtList() {
  let list = [];
  try { list = await window.aegisAPI.listExtensions(); } catch (e) {}

  const rows = list.map(ext => `
    <div class="ext-row${ext.disabled ? ' off' : ''}">
      <span class="ext-ico">${ext.icon ? `<img src="${ext.icon}" alt="">` : '🧩'}</span>
      <span class="ext-nm" title="${esc(ext.name)}">${esc(ext.name)}</span>
      <label class="switch">
        <input type="checkbox" data-id="${esc(ext.id)}" ${ext.disabled ? '' : 'checked'}>
        <span class="track"></span><span class="knob"></span>
      </label>
    </div>`).join('');

  panel.innerHTML = `
    <div class="popup-header">
      <span class="popup-title">Расширения</span>
    </div>
    <div style="overflow-y:auto;display:flex;flex-direction:column;gap:2px;margin-top:2px">
      ${rows || '<div class="ext-empty">Расширений нет.<br>Открой магазин, чтобы установить.</div>'}
    </div>
    <div class="ext-footer">
      <button class="ext-manage" id="ext-manage">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/></svg>
        Управление расширениями
      </button>
    </div>`;

  panel.querySelectorAll('.switch input').forEach(inp => {
    inp.addEventListener('change', async () => {
      if (!window.aegisAPI) return;
      await window.aegisAPI.toggleExtension(inp.dataset.id, inp.checked);
      const row = inp.closest('.ext-row');
      if (row) row.classList.toggle('off', !inp.checked);
    });
  });
  const manage = $('ext-manage');
  if (manage) {
    manage.onclick = () => go('about:extensions');
  }
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
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="${icon.color}" style="flex-shrink:0"><path d="${icon.path}"/></svg>`;
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
  { title: 'Новая вкладка',                 key: 'Ctrl+T',        kw: 'вкладка tab new',              run: () => window.aegisAPI.createNewTab('about:newtab') },
  { title: 'Новая инкогнито-вкладка',       key: 'Ctrl+Shift+N',  kw: 'вкладка приватная incognito',  run: () => window.aegisAPI.createIncognitoTab('about:newtab') },
  { title: 'Настройки и конфигурация',      key: 'Internal',      kw: 'настройки config settings preferences параметры', run: () => go('about:config') },
  { title: 'Аудит фингерпринта',            key: 'Internal',      kw: 'фингерпринт fingerprint отпечаток антидетект', run: () => go('about:fingerprint') },
  { title: 'Профили личности',              key: 'Internal',      kw: 'профили личности identity антидетект', run: () => go('about:profiles') },
  { title: 'Студия кастомизации',           key: 'Internal',      kw: 'кастомизация css userchrome тема цвет оформление', run: () => go('about:customizer') },
  { title: 'Магазин расширений',            key: 'Internal',      kw: 'расширения extensions plugins', run: () => go('about:extensions') },
  { title: 'Сгенерировать случайную личность', key: 'Stealth',    kw: 'личность fingerprint сгенерировать рандом', run: async () => {
      const p = await window.aegisAPI.generateRandomFingerprint();
      await window.aegisAPI.saveProfile(p);
      await window.aegisAPI.setActiveProfile(p.id);
    } },
  { title: 'Переключить вертикальные вкладки', key: 'Layout',     kw: 'вкладки вертикальные боковые layout', run: async () => {
      const pos = await window.aegisAPI.getPref('ui.tabs.position', 'top');
      await window.aegisAPI.setPref('ui.tabs.position', pos === 'left' ? 'top' : 'left');
      await window.aegisAPI.reloadUIStyles();
    } },
  { title: 'Показать/скрыть панель закладок', key: 'Layout',     kw: 'закладки панель bookmarks бар скрыть', run: async () => {
      const l = (await window.aegisAPI.getPref('ui.custom.layout')) || {};
      l.hide = l.hide || {};
      l.hide.bookmarks = !l.hide.bookmarks;
      await window.aegisAPI.setPref('ui.custom.layout', l);
    } },
  { title: 'Тёмные сайты: вкл/выкл',        key: 'Theme',         kw: 'тёмный темный dark сайты тема night', run: async () => {
      const cur = await window.aegisAPI.getPref('ui.sites_theme', 'system');
      await window.aegisAPI.setPref('ui.sites_theme', cur === 'dark' ? 'system' : 'dark');
    } },
  { title: 'Force Dark: вкл/выкл (перезапуск)', key: 'Theme',     kw: 'force dark принудительный тёмный google затемнение', run: async () => {
      const cur = await window.aegisAPI.getPref('ui.force_dark', false);
      await window.aegisAPI.setPref('ui.force_dark', !cur);
    } },
  { title: 'Сбросить счётчик блокировок',   key: 'Privacy',       kw: 'сброс блокировки счётчик щит privacy', run: () => window.aegisAPI.resetShieldStats() },
  { title: 'Очистить историю',              key: 'Privacy',       kw: 'история очистить удалить history', run: () => window.aegisAPI.clearHistory() },
  { title: 'Тема: Stealth Dark',            key: 'Theme',         kw: 'тема stealth dark',            run: () => window.aegisAPI.setPref('ui.theme', 'stealth-dark') },
  { title: 'Тема: OLED Black',              key: 'Theme',         kw: 'тема oled black чёрный',       run: () => window.aegisAPI.setPref('ui.theme', 'oled-black') },
  { title: 'Тема: Nord',                    key: 'Theme',         kw: 'тема nord',                    run: () => window.aegisAPI.setPref('ui.theme', 'nord') },
  { title: 'Тема: Tokyo Night',             key: 'Theme',         kw: 'тема tokyo night',             run: () => window.aegisAPI.setPref('ui.theme', 'tokyo-night') },
  { title: 'Тема: Gruvbox',                 key: 'Theme',         kw: 'тема gruvbox',                 run: () => window.aegisAPI.setPref('ui.theme', 'gruvbox') },
  { title: 'Тема: Paper Light',             key: 'Theme',         kw: 'тема paper light светлая',     run: () => window.aegisAPI.setPref('ui.theme', 'paper-light') }
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

  const render = () => {
    if (!filtered.length) {
      results.innerHTML = '<div class="palette-empty">Ничего не найдено.<br>Попробуй: «тема», «вкладка», «настройки»</div>';
      return;
    }
    results.innerHTML = filtered.map((c, i) => `
      <button class="palette-item ${i === selected ? 'selected' : ''}" data-i="${i}">
        <span>${esc(c.title)}</span><span class="p-key">${esc(c.key)}</span>
      </button>`).join('');
  };

  const applyFilter = () => {
    const q = input.value.trim().toLowerCase();
    filtered = !q ? PALETTE_COMMANDS : PALETTE_COMMANDS.filter(c =>
      c.title.toLowerCase().includes(q) || (c.kw || '').toLowerCase().includes(q) || c.key.toLowerCase().includes(q)
    );
    selected = 0;
    render();
  };

  const exec = (cmd) => {
    closeMe();
    try { Promise.resolve(cmd.run()).catch(() => {}); } catch (e) {}
  };

  input.addEventListener('input', applyFilter);
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
