const $ = (id) => document.getElementById(id);
const grid = $('installed-grid');
const emptyState = $('installed-empty');

window.addEventListener('unhandledrejection', (e) => {
  const msg = (e.reason && e.reason.message) || String(e.reason || 'неизвестная ошибка');
  toast('Ошибка: ' + msg, true);
});

function toast(msg, isErr) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  setTimeout(() => { t.className = 'toast'; }, 2600);
}

function badgeHtml(ext) {
  const map = {
    full: ['full', 'Совместимо'],
    partial: ['partial', 'Частично'],
    none: ['none', 'Не совместимо']
  };
  const [cls, label] = map[ext.compat] || map.none;
  return `<span class="badge ${cls}">${label}</span>`;
}

function iconHtml(ext, cls) {
  return ext.icon
    ? `<span class="${cls}"><img src="${ext.icon}" alt=""></span>`
    : `<span class="${cls} fallback">🧩</span>`;
}

function rowHtml(ext) {
  const desc = ext.description && !/^__MSG_/.test(ext.description) ? ext.description : '';
  return `
    ${iconHtml(ext, 'ext-icon-lg')}
    <div class="ext-info">
      <div class="ext-name-row">
        <span class="name">${escapeHtml(ext.name)}</span>
        <span class="ver">v${escapeHtml(ext.version)}</span>
        ${badgeHtml(ext)}
      </div>
      ${desc ? `<div class="ext-desc" title="${escapeAttr(desc)}">${escapeHtml(desc)}</div>` : ''}
      ${ext.disabled ? '<div class="reason">Выключено</div>' : (ext.compatReason ? `<div class="reason">⚠ ${escapeHtml(ext.compatReason)}</div>` : '')}
    </div>
    <div class="ext-actions">
      <label class="switch" title="${ext.disabled ? 'Включить' : 'Отключить'}">
        <input type="checkbox" data-act="toggle" data-id="${escapeAttr(ext.id)}" ${ext.disabled ? '' : 'checked'}>
        <span class="track"></span><span class="knob"></span>
      </label>
      <button class="btn small danger" data-act="delete" data-id="${escapeAttr(ext.id)}">Удалить</button>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

async function renderInstalled() {
  if (!window.aegisAPI) return;
  const list = await window.aegisAPI.listExtensions();
  const grid = $('installed-grid');
  grid.innerHTML = list.map(ext => `<div class="ext-row${ext.disabled ? ' off' : ''}">${rowHtml(ext)}</div>`).join('');
  emptyState.style.display = list.length ? 'none' : 'block';
}

grid.onclick = async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const id = el.dataset.id;
  if (el.dataset.act === 'toggle') {
    await window.aegisAPI.toggleExtension(id, el.checked);
    renderInstalled();
  } else if (el.dataset.act === 'delete') {
    if (!confirm('Удалить расширение?')) return;
    const res = await window.aegisAPI.uninstallExtension(id);
    if (res && res.ok) { toast('Удалено'); renderInstalled(); }
    else toast(res && res.error || 'Ошибка удаления', true);
  }
};

$('btn-import-chrome').onclick = async () => {
  try {
    const candidates = await window.aegisAPI.chromeCandidates();
    const listEl = $('chrome-list');
    if (!candidates.length) {
      listEl.innerHTML = '<div class="empty">Браузеры с расширениями не найдены.<br>Проверены: Opera, Opera GX, Chrome, Edge, Brave, Vivaldi, Yandex.</div>';
    } else {
      const installedKeys = new Set((await window.aegisAPI.listExtensions()).map(x => x.chromeId || x.id));
      listEl.innerHTML = candidates.map(c => `
        <div class="cand">
          ${iconHtml(c, 'ext-icon-lg')}
          <div class="info">
            <div class="name">${escapeHtml(c.name)} <span class="ver">v${escapeHtml(c.version)}</span></div>
            <div class="meta">${escapeHtml(c.browser || '')} · ${escapeHtml(c.chromeProfile || '')} · ${badgeHtml(c)} ${c.compatReason ? '· ' + escapeHtml(c.compatReason) : ''}</div>
          </div>
          <button class="btn small primary" data-src="${escapeAttr(c.source)}" data-chrome-id="${escapeAttr(c.chromeId || '')}"
            ${c.alreadyImported ? 'disabled' : ''}>${c.alreadyImported ? 'Есть' : 'Установить'}</button>
        </div>
      `).join('');
    }
    $('chrome-modal').classList.add('open');
  } catch (err) {
    toast('Ошибка сканирования: ' + err.message, true);
  }
};

$('chrome-list').onclick = async (e) => {
  const btn = e.target.closest('button[data-src]');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const res = await window.aegisAPI.importExtension(btn.dataset.src, btn.dataset.chromeId || null);
    if (res.ok) { toast('Установлено: ' + res.extension.name); renderInstalled(); btn.textContent = 'Есть'; }
    else { toast(res.error || 'Ошибка', true); btn.disabled = false; btn.textContent = 'Установить'; }
  } catch (err) {
    toast('Ошибка импорта: ' + err.message, true);
    btn.disabled = false;
    btn.textContent = 'Установить';
  }
};

$('btn-install-folder').onclick = async () => {
  try {
    const res = await window.aegisAPI.installFromFolder();
    if (res.canceled) return;
    if (res.ok) { toast('Установлено: ' + res.extension.name); renderInstalled(); }
    else toast(res.error || 'Не удалось установить', true);
  } catch (err) {
    toast('Ошибка: ' + err.message, true);
  }
};

$('btn-close-modal').onclick = () => $('chrome-modal').classList.remove('open');
$('chrome-modal').onclick = (e) => {
  if (e.target === $('chrome-modal')) $('chrome-modal').classList.remove('open');
};

renderInstalled();
