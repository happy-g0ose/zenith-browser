const $ = (id) => document.getElementById(id);
const grid = $('installed-grid');
const emptyState = $('installed-empty');

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

function iconHtml(ext) {
  return ext.icon
    ? `<span class="icon"><img src="${ext.icon}" alt=""></span>`
    : `<span class="icon fallback">🧩</span>`;
}

function cardHtml(ext) {
  return `
    <div class="row">
      ${iconHtml(ext)}
      <div style="flex:1;min-width:0">
        <div class="name">${escapeHtml(ext.name)}<span class="ver">v${escapeHtml(ext.version)}</span></div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:2px">
          ${badgeHtml(ext)}
        </div>
      </div>
      <label class="switch" title="${ext.disabled ? 'Включить' : 'Отключить'}">
        <input type="checkbox" data-act="toggle" data-id="${escapeAttr(ext.id)}" ${ext.disabled ? '' : 'checked'}>
        <span class="track"></span><span class="knob"></span>
      </label>
    </div>
    ${ext.description ? `<div class="desc">${escapeHtml(ext.description)}</div>` : ''}
    ${ext.compatReason ? `<div class="reason">⚠ ${escapeHtml(ext.compatReason)}</div>` : ''}
    <div class="actions">
      <span class="spacer" style="flex:1"></span>
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
  grid.innerHTML = list.map(cardHtml).join('');
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

$('btn-install-folder').onclick = async () => {
  const res = await window.aegisAPI.installFromFolder();
  if (res.canceled) return;
  if (res.ok) { toast('Установлено: ' + res.extension.name); renderInstalled(); }
  else toast(res.error || 'Не удалось установить', true);
};

$('btn-import-chrome').onclick = async () => {
  const candidates = await window.aegisAPI.chromeCandidates();
  const listEl = $('chrome-list');
  if (!candidates.length) {
    listEl.innerHTML = '<div class="empty">Chrome не найден или в нём нет расширений.<br>Проверено: %LocalAppData%\\Google\\Chrome\\User Data</div>';
  } else {
    const installedIds = new Set((await window.aegisAPI.listExtensions()).map(x => x.id));
    listEl.innerHTML = candidates.map(c => `
      <div class="cand">
        ${iconHtml(c)}
        <div class="info">
          <div class="name">${escapeHtml(c.name)} <span class="ver">v${escapeHtml(c.version)}</span></div>
          <div class="meta">Chrome · ${escapeHtml(c.chromeProfile)} · ${badgeHtml(c)} ${c.compatReason ? '· ' + escapeHtml(c.compatReason) : ''}</div>
        </div>
        <button class="btn small primary" data-src="${escapeAttr(c.source)}" data-name="${escapeAttr(c.name)}"
          ${installedIds.has(c.id) ? 'disabled' : ''}>${installedIds.has(c.id) ? 'Есть' : 'Установить'}</button>
      </div>
    `).join('');
  }
  $('chrome-modal').classList.add('open');
};

$('chrome-list').onclick = async (e) => {
  const btn = e.target.closest('button[data-src]');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = '...';
  const res = await window.aegisAPI.importExtension(btn.dataset.src);
  if (res.ok) { toast('Установлено: ' + res.extension.name); renderInstalled(); btn.textContent = 'Есть'; }
  else { toast(res.error || 'Ошибка', true); btn.disabled = false; btn.textContent = 'Установить'; }
};

$('btn-close-modal').onclick = () => $('chrome-modal').classList.remove('open');
$('chrome-modal').onclick = (e) => {
  if (e.target === $('chrome-modal')) $('chrome-modal').classList.remove('open');
};

renderInstalled();
