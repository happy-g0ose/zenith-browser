let activeTab = 'userchrome';
let userChromeContent = '';
let userContentStyle = '';

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

async function loadFiles() {
  if (window.aegisAPI) {
    try {
      userChromeContent = await window.aegisAPI.getUserChromeCSS();
      userContentStyle = await window.aegisAPI.getUserContentCSS();
    } catch (e) {
      console.warn('Failed to load CSS:', e);
    }
  }

  const editor = document.getElementById('code-editor');
  editor.value = activeTab === 'userchrome' ? userChromeContent : userContentStyle;
}

function switchEditor(type) {
  const editor = document.getElementById('code-editor');
  if (activeTab === 'userchrome') {
    userChromeContent = editor.value;
  } else {
    userContentStyle = editor.value;
  }

  activeTab = type;
  document.getElementById('tab-userchrome').classList.toggle('active', type === 'userchrome');
  document.getElementById('tab-usercontent').classList.toggle('active', type === 'usercontent');
  document.getElementById('current-file-label').textContent = type === 'userchrome' ? 'chrome/userChrome.css' : 'chrome/userContent.css';

  editor.value = type === 'userchrome' ? userChromeContent : userContentStyle;
}

function insertSnippet(name) {
  const editor = document.getElementById('code-editor');
  if (snippets[name]) {
    editor.value += '\n\n' + snippets[name];
    showToast('Snippet appended!');
  }
}

async function saveAndApply() {
  const editor = document.getElementById('code-editor');
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
  showToast('Saved & applied live!');
}

function loadDefaultSnippet() {
  const editor = document.getElementById('code-editor');
  editor.value = `/* Zenith userChrome.css Custom Styling */
:root {
  --accent-color: #5b8def;
  --border-radius: 4px;
}
`;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 2500);
}

window.addEventListener('DOMContentLoaded', loadFiles);
