let activeTab = 'userchrome';
let userChromeContent = '';
let userContentStyle = '';

const $ = (id) => document.getElementById(id);

const snippets = {
  compact_tabs: `/* Compact Minimalist Tabs */
.tab-bar {
  height: 32px !important;
}
.tab-item {
  height: 28px !important;
  font-size: 0.78rem !important;
  padding: 0 10px !important;
  border-radius: 6px !important;
}
`,
  glassmorphism: `/* Frosted Glass Acrylic UI */
.browser-header, .tab-bar, .omnibox-wrapper {
  background: rgba(18, 20, 29, 0.65) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
}
`,
  neon_cyberpunk: `/* Cyberpunk Neon Glow */
:root {
  --accent-color: #06b6d4 !important;
  --accent-glow: rgba(6, 182, 212, 0.4) !important;
}
.tab-item.active {
  border: 1px solid #06b6d4 !important;
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.35) !important;
}
.omnibox-wrapper:focus-within {
  box-shadow: 0 0 16px rgba(6, 182, 212, 0.5) !important;
}
`,
  autohide_omnibox: `/* Smooth Focus Expansion */
.omnibox-wrapper {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
  max-width: 450px !important;
}
.omnibox-wrapper:focus-within {
  max-width: 850px !important;
}
`,
  oled_black: `/* Pure Pitch Black OLED */
:root {
  --bg-primary: #000000 !important;
  --bg-secondary: #080808 !important;
  --card-border: rgba(255, 255, 255, 0.05) !important;
}
`
};

// ---- Visual studio ----
const PART_NAMES = {
  '--bg-tabstrip': 'Полоса вкладок (таббар)',
  '--bg-navbar': 'Панель навигации и активная вкладка',
  '--bg-tertiary': 'Адресная строка',
  '--bg-secondary': 'Панель закладок',
  '--bg-primary': 'Фон страницы',
  '--accent': 'Акцентный цвет',
  '--text': 'Цвет текста'
};

const THEME_PRESETS = [
  ['stealth-dark', 'Stealth Dark', '#0b0d11'],
  ['oled-black', 'OLED Black', '#000000'],
  ['nord', 'Nord', '#242933'],
  ['tokyo-night', 'Tokyo Night', '#1a1b26'],
  ['gruvbox', 'Gruvbox', '#1d2021'],
  ['paper-light', 'Paper Light', '#f6f8fa']
];

let overrides = {};
let selectedVar = null;
let currentTheme = 'stealth-dark';
let saveTimer = null;

function normalizeHex(val) {
  val = (val || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(val)) return val.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(val)) return '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
  const m = val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return '#' + [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('');
  return '#000000';
}

function currentVarValue(varName) {
  if (overrides[varName]) return overrides[varName];
  return normalizeHex(getComputedStyle(document.body).getPropertyValue(varName));
}

function applyLocalOverrides() {
  for (const [name, value] of Object.entries(overrides)) {
    document.documentElement.style.setProperty(name, value);
    document.body.style.setProperty(name, value);
  }
}

function refreshEditorFields() {
  const picker = $('color-picker');
  const hex = $('hex-input');
  const resetBtn = $('btn-reset-part');
  if (!selectedVar) {
    $('sel-name').textContent = 'Ничего не выбрано';
    $('sel-var').textContent = 'кликни по части миниатюры слева';
    picker.disabled = true; hex.disabled = true; resetBtn.disabled = true;
    return;
  }
  $('sel-name').textContent = PART_NAMES[selectedVar] || selectedVar;
  $('sel-var').textContent = selectedVar + (overrides[selectedVar] ? '  •  переопределён' : '  •  из темы');
  const hexVal = currentVarValue(selectedVar);
  picker.value = hexVal;
  hex.value = hexVal;
  picker.disabled = false; hex.disabled = false;
  resetBtn.disabled = !overrides[selectedVar];
}

function selectPart(varName) {
  selectedVar = varName;
  document.querySelectorAll('.part').forEach(p => p.classList.toggle('selected', p.dataset.var === varName));
  refreshEditorFields();
}

function setOverride(varName, hex) {
  overrides = { ...overrides, [varName]: hex };
  applyLocalOverrides();
  scheduleSave();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (window.aegisAPI) await window.aegisAPI.setPref('ui.custom.overrides', overrides);
  }, 300);
}

function setupVisualStudio() {
  document.querySelectorAll('.part[data-var]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectPart(el.dataset.var);
    });
  });

  const picker = $('color-picker');
  const hex = $('hex-input');

  picker.addEventListener('input', () => {
    if (!selectedVar) return;
    setOverride(selectedVar, picker.value);
    hex.value = picker.value;
    refreshEditorFields();
  });
  hex.addEventListener('change', () => {
    if (!selectedVar) return;
    const v = normalizeHex(hex.value);
    if (/^#[0-9a-f]{6}$/.test(v)) {
      setOverride(selectedVar, v);
      refreshEditorFields();
    }
  });

  $('btn-reset-part').onclick = () => {
    if (!selectedVar || !overrides[selectedVar]) return;
    const next = { ...overrides };
    delete next[selectedVar];
    overrides = next;
    document.documentElement.style.removeProperty(selectedVar);
    document.body.style.removeProperty(selectedVar);
    scheduleSave();
    refreshEditorFields();
  };

  $('btn-reset-all').onclick = async () => {
    overrides = {};
    OVERRIDABLE_VARS.forEach(v => {
      document.documentElement.style.removeProperty(v);
      document.body.style.removeProperty(v);
    });
    if (window.aegisAPI) await window.aegisAPI.setPref('ui.custom.overrides', {});
    refreshEditorFields();
    showToast('Раскраска сброшена к теме');
  };

  const grid = $('preset-grid');
  grid.innerHTML = THEME_PRESETS.map(([val, name, dot]) => `
    <button class="preset-btn" data-theme="${val}">
      <span class="preset-dot" style="background:${dot}"></span>${name}
    </button>`).join('');
  grid.querySelectorAll('.preset-btn').forEach(btn => {
    btn.onclick = async () => {
      currentTheme = btn.dataset.theme;
      overrides = {};
      OVERRIDABLE_VARS.forEach(v => {
        document.documentElement.style.removeProperty(v);
        document.body.style.removeProperty(v);
      });
      document.body.setAttribute('data-theme', currentTheme);
      if (window.aegisAPI) {
        await window.aegisAPI.setPref('ui.theme', currentTheme);
        await window.aegisAPI.setPref('ui.custom.overrides', {});
      }
      markActivePreset();
      refreshEditorFields();
      showToast('Тема применена: ' + btn.textContent.trim());
    };
  });
  markActivePreset();
}

const OVERRIDABLE_VARS = Object.keys(PART_NAMES);

function markActivePreset() {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === currentTheme);
  });
}

async function initVisualStudio() {
  if (!window.aegisAPI) return;
  try {
    currentTheme = (await window.aegisAPI.getPref('ui.theme')) || currentTheme;
  } catch (e) {}
  document.body.setAttribute('data-theme', currentTheme);
  try {
    const saved = await window.aegisAPI.getPref('ui.custom.overrides');
    if (saved && typeof saved === 'object') {
      overrides = saved;
      applyLocalOverrides();
    }
  } catch (e) {}
  refreshEditorFields();
}

// ---- Tabs ----
function setupTopTabs() {
  $('tab-visual').onclick = () => switchTopTab('visual');
  $('tab-css').onclick = () => switchTopTab('css');
}

function switchTopTab(pane) {
  $('tab-visual').classList.toggle('active', pane === 'visual');
  $('tab-css').classList.toggle('active', pane === 'css');
  $('pane-visual').classList.toggle('active', pane === 'visual');
  $('pane-css').classList.toggle('active', pane === 'css');
}

// ---- CSS editor (legacy, preserved) ----
async function loadFiles() {
  if (window.aegisAPI) {
    try {
      userChromeContent = await window.aegisAPI.getUserChromeCSS();
      userContentStyle = await window.aegisAPI.getUserContentCSS();
    } catch (e) {
      console.warn('Failed to load CSS:', e);
    }
  }
  const editor = $('code-editor');
  editor.value = activeTab === 'userchrome' ? userChromeContent : userContentStyle;
}

function switchEditor(type) {
  const editor = $('code-editor');
  if (activeTab === 'userchrome') userChromeContent = editor.value;
  else userContentStyle = editor.value;

  activeTab = type;
  $('tab-userchrome').classList.toggle('active', type === 'userchrome');
  $('tab-usercontent').classList.toggle('active', type === 'usercontent');
  $('current-file-label').textContent = type === 'userchrome' ? 'chrome/userChrome.css' : 'chrome/userContent.css';
  editor.value = type === 'userchrome' ? userChromeContent : userContentStyle;
}

function insertSnippet(name) {
  const editor = $('code-editor');
  if (snippets[name]) {
    editor.value += '\n\n' + snippets[name];
    showToast('Сниппет добавлен!');
  }
}

async function saveAndApply() {
  const editor = $('code-editor');
  if (activeTab === 'userchrome') {
    userChromeContent = editor.value;
    if (window.aegisAPI) {
      await window.aegisAPI.setUserChromeCSS(userChromeContent);
      await window.aegisAPI.reloadUIStyles();
    }
  } else {
    userContentStyle = editor.value;
    if (window.aegisAPI) {
      await window.aegisAPI.setUserContentCSS(userContentStyle);
    }
  }
  showToast('Сохранено и применено!');
}

function loadDefaultSnippet() {
  $('code-editor').value = `/* Zenith userChrome.css Custom Styling */
:root {
  --accent-color: #5b8def;
  --border-radius: 4px;
}
`;
}

function showToast(msg) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

window.addEventListener('DOMContentLoaded', async () => {
  setupTopTabs();
  setupVisualStudio();
  await initVisualStudio();
  await loadFiles();
  $('tab-userchrome').onclick = () => switchEditor('userchrome');
  $('tab-usercontent').onclick = () => switchEditor('usercontent');
});
