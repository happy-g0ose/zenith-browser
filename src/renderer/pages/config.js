let allPrefs = {};

const prefMeta = {
  'privacy.shield.enabled': { ru: 'Главный щит приватности', en: 'Master Privacy Shield', desc_ru: 'Включение/отключение блокировщика трекеров и рекламы', desc_en: 'Enable/disable tracker and ad blocking engine' },
  'privacy.shield.block_trackers': { ru: 'Блокировка трекеров и аналитики', en: 'Block Trackers & Analytics', desc_ru: 'Блокирует Google Analytics, Yandex Metrika, Facebook Pixel и др.', desc_en: 'Blocks tracking scripts and behavioral telemetry' },
  'privacy.shield.block_ads': { ru: 'Блокировка баннеров и рекламы', en: 'Block Advertisements', desc_ru: 'Блокирует рекламные сети и всплывающие окна', desc_en: 'Blocks display ads, popups, and ad networks' },
  'privacy.shield.block_miners': { ru: 'Защита от криптомайнеров', en: 'Block Cryptominers', desc_ru: 'Блокирует скрытый майнинг криптовалют в браузере', desc_en: 'Prevents websites from running hidden in-browser miners' },
  'privacy.shield.dnt_header': { ru: 'Заголовок Do Not Track (DNT)', en: 'Do Not Track (DNT) Header', desc_ru: 'ВНИМАНИЕ: настоящий Chrome не шлёт DNT — включение палит браузер (капчи). Для антидетекта держать ВЫКЛ', desc_en: 'WARNING: real Chrome never sends DNT - enabling it flags the browser (captchas). Keep OFF for anti-detect' },
  'privacy.shield.gpc_header': { ru: 'Заголовок Global Privacy Control (GPC)', en: 'Global Privacy Control Header', desc_ru: 'ВНИМАНИЕ: настоящий Chrome не шлёт GPC — включение палит браузер. Для антидетекта держать ВЫКЛ', desc_en: 'WARNING: real Chrome never sends GPC - enabling it flags the browser. Keep OFF for anti-detect' },
  'privacy.shield.https_only': { ru: 'Режим только HTTPS (HTTPS-Only)', en: 'HTTPS-Only Mode', desc_ru: 'Автоматически переводит все соединения на зашифрованный протокол', desc_en: 'Forces all web traffic over encrypted HTTPS connections' },

  'stealth.enabled': { ru: 'Главный стелс-режим (Anti-Detect)', en: 'Stealth Anti-Detect Core', desc_ru: 'Активирует подмену цифровых отпечатков и защиту от антифрода', desc_en: 'Master toggle for fingerprint spoofing and anti-bot defenses' },
  'stealth.canvas.noise': { ru: 'Рандомизация отпечатка Canvas', en: 'Canvas Noise Injection', desc_ru: 'Добавляет математический микро-шум в холст для маскировки отпечатка', desc_en: 'Injects sub-pixel noise into HTML5 Canvas rendering' },
  'stealth.canvas.noise_level': { ru: 'Уровень шума Canvas', en: 'Canvas Noise Level', desc_ru: 'Коэффициент смещения пикселей', desc_en: 'Pixel distortion multiplier for canvas operations' },
  'stealth.webgl.spoof': { ru: 'Спуфинг видеокарты WebGL', en: 'WebGL Hardware Masking', desc_ru: 'Подменяет вендор и модель GPU на безопасный профиль', desc_en: 'Spoofs GPU vendor and renderer in WebGL contexts' },
  'stealth.webgl.vendor': { ru: 'Вендор видеокарты WebGL', en: 'WebGL GPU Vendor', desc_ru: 'Отображаемый производитель чипа (напр. Google Inc. (NVIDIA))', desc_en: 'Reported GPU manufacturer string' },
  'stealth.webgl.renderer': { ru: 'Модель видеокарты WebGL', en: 'WebGL GPU Renderer', desc_ru: 'Строка рендерера GPU (напр. NVIDIA GeForce RTX 4080)', desc_en: 'Reported GPU model and DirectX/OpenGL pipeline' },
  'stealth.audio.noise': { ru: 'Шум в AudioContext', en: 'AudioContext Noise', desc_ru: 'Защита от снятия акустического отпечатка процессора', desc_en: 'Injects jitter into audio buffer processing' },
  'stealth.audio.noise_level': { ru: 'Уровень шума Audio', en: 'Audio Noise Level', desc_ru: 'Коэффициент фазового шума в аудио-буфере', desc_en: 'Phase distortion multiplier for audio processing' },
  'stealth.webrtc.mode': { ru: 'Режим защиты WebRTC', en: 'WebRTC Leak Prevention Policy', desc_ru: 'Блокирует утечку реального IP-адреса через STUN/TURN запросы', desc_en: 'Prevents real local/public IP leaks via WebRTC' },
  'stealth.hardware.spoof': { ru: 'Спуфинг процессора и ОЗУ', en: 'Hardware Specs Masking', desc_ru: 'Подменяет количество ядер CPU и объём оперативной памяти', desc_en: 'Spoofs navigator.hardwareConcurrency and deviceMemory' },
  'stealth.hardware.concurrency': { ru: 'Количество ядер процессора (Cores)', en: 'CPU Core Count', desc_ru: 'Число ядер передаваемое скриптам (напр. 8, 16, 32)', desc_en: 'Reported logical processor core count' },
  'stealth.hardware.memory_gb': { ru: 'Объём оперативной памяти (RAM GB)', en: 'Device RAM (GB)', desc_ru: 'Объём ОЗУ в гигабайтах (напр. 16, 32, 64)', desc_en: 'Reported device memory capacity in gigabytes' },
  'stealth.navigator.platform': { ru: 'Платформа ОС (navigator.platform)', en: 'OS Platform String', desc_ru: 'Отображаемая операционная система (Win32, MacIntel, Linux)', desc_en: 'Reported operating system architecture string' },
  'stealth.navigator.languages': { ru: 'Языковые заголовки браузера', en: 'Navigator Languages', desc_ru: 'Список языков отправляемый в HTTP и JS (напр. ru-RU,ru,en;q=0.8)', desc_en: 'Language priority string sent to websites' },
  'stealth.navigator.hide_webdriver': { ru: 'Скрытие navigator.webdriver', en: 'Hide Webdriver Automation', desc_ru: 'Удаляет флаги ботов для прохождения Cloudflare Turnstile', desc_en: 'Purges automation flags to pass bot challenges seamlessly' },
  'stealth.screen.spoof': { ru: 'Спуфинг параметров дисплея', en: 'Screen Specs Masking', desc_ru: 'Подменяет разрешение экрана, глубину цвета и DPR', desc_en: 'Spoofs window screen dimensions and color depth' },
  'stealth.screen.width': { ru: 'Ширина экрана (px)', en: 'Screen Width (px)', desc_ru: 'Виртуальная ширина экрана (напр. 1920)', desc_en: 'Reported screen pixel width' },
  'stealth.screen.height': { ru: 'Высота экрана (px)', en: 'Screen Height (px)', desc_ru: 'Виртуальная высота экрана (напр. 1080)', desc_en: 'Reported screen pixel height' },
  'stealth.screen.colorDepth': { ru: 'Глубина цвета (бит)', en: 'Color Depth (bits)', desc_ru: 'screen.colorDepth (обычно 24)', desc_en: 'Reported color depth bits per pixel' },
  'stealth.screen.devicePixelRatio': { ru: 'Коэффициент пикселей (DPR)', en: 'Device Pixel Ratio (DPR)', desc_ru: 'Масштабирование дисплея (1.0, 1.5, 2.0)', desc_en: 'Screen scale factor ratio' },
  'stealth.clientrects.jitter': { ru: 'Защита DOM ClientRects', en: 'DOM ClientRects Noise', desc_ru: 'Рандомизирует координаты элементов для защиты от снятия шрифтового отпечатка', desc_en: 'Adds microscopic jitter to bounding box measurements' },
  'stealth.geolocation.spoof': { ru: 'Спуфинг виртуальных координат', en: 'Spoof Virtual Coordinates', desc_ru: 'Возвращает заданные координаты вместо блокировки', desc_en: 'Returns spoofed coordinates instead of error denial' },

  'ui.language': { ru: 'Язык интерфейса', en: 'UI Language', desc_ru: 'Язык оболочки браузера и внутренних страниц (ru, en, de, fr, es, zh)', desc_en: 'Browser shell and internal pages language' },
  'ui.theme': { ru: 'Тема оформления', en: 'Color Theme', desc_ru: 'Цветовая схема (stealth-dark, oled-black, nord, gruvbox, tokyo-night, paper-light)', desc_en: 'Active UI color theme' },
  'ui.tabs.position': { ru: 'Расположение вкладок', en: 'Tab Bar Position', desc_ru: 'top — горизонтальные вкладки сверху, left — боковая панель', desc_en: 'top for horizontal tabs, left for vertical sidebar' },
  'ui.tabs.show_favicon': { ru: 'Отображение значков сайтов', en: 'Show Tab Favicons', desc_ru: 'Показывать цветные индикаторы страниц на вкладках', desc_en: 'Display page indicator dots on tabs' },
  'ui.userchrome.enabled': { ru: 'Поддержка userChrome.css', en: 'Enable userChrome.css', desc_ru: 'Применяет кастомные стили CSS к оболочке браузера', desc_en: 'Applies custom CSS styling to browser window' },
  'ui.usercontent.enabled': { ru: 'Поддержка userContent.css', en: 'Enable userContent.css', desc_ru: 'Внедряет кастомный CSS во все открываемые веб-страницы', desc_en: 'Injects user stylesheet into all visited web pages' },
  'ui.search.default_engine': { ru: 'Поисковая система по умолчанию', en: 'Default Search Engine', desc_ru: 'duckduckgo, brave, searx или google', desc_en: 'Search provider for omnibox query submission' },
  'ui.animations.enabled': { ru: 'Анимации интерфейса', en: 'UI Animations', desc_ru: 'Плавные переходы меню и вкладок', desc_en: 'Smooth transitions for popups and tabs' },
  'ui.sites_theme': { ru: 'Тема сайтов (prefers-color-scheme)', en: 'Sites Color Scheme', desc_ru: 'system / dark / light — сайты с поддержкой тёмной темы (YouTube и др.) подстроятся автоматически', desc_en: 'system / dark / light - dark-mode-aware sites adapt automatically' },
  'ui.force_dark': { ru: 'Принудительная тёмная тема (Force Dark)', en: 'Force Dark Mode', desc_ru: 'Авто-затемнение ЛЮБЫХ сайтов, включая Google. Требуется перезапуск браузера', desc_en: 'Auto-darkens ALL sites including Google. Requires browser restart' },

  'network.doh.enabled': { ru: 'Защищённый DNS over HTTPS (DoH)', en: 'DNS over HTTPS (DoH)', desc_ru: 'Шифрует все DNS-запросы для защиты от перехвата провайдером', desc_en: 'Encrypts all domain resolution queries via HTTPS' },
  'network.doh.provider': { ru: 'Сервер DoH', en: 'DoH Resolver URL', desc_ru: 'Адрес сервера DoH (Cloudflare, Quad9, Google)', desc_en: 'Encrypted DNS resolver endpoint endpoint' },

  'browser.active_profile': { ru: 'Активный профиль личности', en: 'Active Identity Profile ID', desc_ru: 'Идентификатор текущей изолированной личности', desc_en: 'Currently active browser fingerprint identity profile' }
};

const langPresets = {
  'ru': {
    nav: 'ru-RU,ru,en-US;q=0.8,en;q=0.7',
    title: 'Настройки и конфигурация (about:config)',
    subtitle: 'Управление защитой, языком, шумом холста, видеокартой и сетью.',
    labelTitle: 'Язык интерфейса и локаль',
    labelDesc: 'Задает язык браузера и языковые заголовки navigator.languages',
    colName: 'Параметр и описание',
    colType: 'Тип',
    colValue: 'Значение',
    colAction: 'Действие',
    searchPlaceholder: 'Поиск по названию параметра или значению...',
    resetBtn: 'Сброс',
    badgePrivacy: '[приватность]',
    badgeStealth: '[стелс]',
    badgeUi: '[интерфейс]',
    badgeNetwork: '[сеть]',
    typeBool: 'логический',
    typeNumber: 'число',
    typeString: 'текст'
  },
  'en': {
    nav: 'en-US,en',
    title: 'Settings & Preferences (about:config)',
    subtitle: 'Configure privacy shields, language, stealth noise, GPU, and network.',
    labelTitle: 'Browser Language & Locale',
    labelDesc: 'Sets interface language and client navigator.languages headers',
    colName: 'Preference & Description',
    colType: 'Type',
    colValue: 'Value',
    colAction: 'Action',
    searchPlaceholder: 'Search preference names or values...',
    resetBtn: 'Reset',
    badgePrivacy: '[privacy]',
    badgeStealth: '[stealth]',
    badgeUi: '[ui]',
    badgeNetwork: '[network]',
    typeBool: 'boolean',
    typeNumber: 'number',
    typeString: 'string'
  }
};

function getCategoryBadge(key, lang = 'ru') {
  const dict = langPresets[lang] || langPresets['en'];
  if (key.startsWith('privacy.')) return `<span class="pref-badge badge-privacy">${dict.badgePrivacy}</span>`;
  if (key.startsWith('stealth.')) return `<span class="pref-badge badge-stealth">${dict.badgeStealth}</span>`;
  if (key.startsWith('ui.')) return `<span class="pref-badge badge-ui">${dict.badgeUi}</span>`;
  if (key.startsWith('network.')) return `<span class="pref-badge badge-network">${dict.badgeNetwork}</span>`;
  return '';
}

function getLocalizedType(type, lang = 'ru') {
  const dict = langPresets[lang] || langPresets['en'];
  if (type === 'boolean') return dict.typeBool;
  if (type === 'number') return dict.typeNumber;
  return dict.typeString;
}

async function loadPreferences() {
  if (window.aegisAPI) {
    try {
      allPrefs = await window.aegisAPI.getAllPrefs();
    } catch (e) {
      console.warn('Failed to load prefs via bridge:', e);
    }
  }

  if (Object.keys(allPrefs).length === 0) {
    allPrefs = {
      'privacy.shield.enabled': true,
      'privacy.shield.block_trackers': true,
      'privacy.shield.block_ads': true,
      'stealth.enabled': true,
      'stealth.canvas.noise': true,
      'stealth.webgl.spoof': true,
      'stealth.webrtc.mode': 'disable_non_proxied_udp',
      'stealth.navigator.languages': 'ru-RU,ru,en-US;q=0.8,en;q=0.7',
      'ui.language': 'ru',
      'ui.theme': 'stealth-dark',
      'ui.tabs.position': 'top'
    };
  }

  initLanguageSelector();
  initEngineSegment();
  renderPreferences();
}

function initEngineSegment() {
  const seg = document.getElementById('engine-seg');
  if (!seg) return;
  // Swap letter dots for real brand icons (brand-colored, no circle)
  if (window.ENGINE_ICONS) {
    seg.querySelectorAll('.engine-seg-btn').forEach(btn => {
      const icon = window.ENGINE_ICONS[btn.dataset.engine];
      const dot = btn.querySelector('.engine-dot');
      if (icon && dot) {
        dot.style.background = 'transparent';
        dot.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="${icon.color}"><path d="${icon.path}"/></svg>`;
      }
    });
  }
  const current = allPrefs['ui.search.default_engine'] || 'duckduckgo';
  seg.querySelectorAll('.engine-seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.engine === current);
    btn.onclick = () => {
      updatePref('ui.search.default_engine', btn.dataset.engine);
      seg.querySelectorAll('.engine-seg-btn').forEach(b => b.classList.toggle('active', b === btn));
    };
  });
}

function initLanguageSelector() {
  const select = document.getElementById('quick-lang-select');
  const currentLang = allPrefs['ui.language'] || 'ru';
  select.value = currentLang;
  applyLanguageTexts(currentLang);

  select.onchange = async () => {
    const lang = select.value;
    allPrefs['ui.language'] = lang;
    const preset = langPresets[lang] || langPresets['en'];
    allPrefs['stealth.navigator.languages'] = preset.nav;

    if (window.aegisAPI) {
      await window.aegisAPI.setPref('ui.language', lang);
      await window.aegisAPI.setPref('stealth.navigator.languages', preset.nav);

      try {
        const activeProf = await window.aegisAPI.getActiveProfile();
        if (activeProf) {
          activeProf.languages = preset.nav.split(',').map(s => s.split(';')[0].trim());
          await window.aegisAPI.saveProfile(activeProf);
        }
      } catch(e) {}
    }

    applyLanguageTexts(lang);
    renderPreferences(document.getElementById('search-prefs').value);
  };
}

function applyLanguageTexts(lang) {
  const preset = langPresets[lang] || langPresets['en'];
  const titleEl = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');
  const labelTitleEl = document.getElementById('label-lang-title');
  const labelDescEl = document.getElementById('label-lang-desc');
  const searchInput = document.getElementById('search-prefs');

  if (subtitleEl) subtitleEl.textContent = preset.subtitle;
  if (labelTitleEl) labelTitleEl.textContent = preset.labelTitle;
  if (labelDescEl) labelDescEl.textContent = preset.labelDesc;
  if (searchInput) searchInput.placeholder = preset.searchPlaceholder;

  // Table headers
  const thName = document.getElementById('th-name');
  const thType = document.getElementById('th-type');
  const thVal = document.getElementById('th-value');
  const thAct = document.getElementById('th-action');

  if (thName) thName.textContent = preset.colName;
  if (thType) thType.textContent = preset.colType;
  if (thVal) thVal.textContent = preset.colValue;
  if (thAct) thAct.textContent = preset.colAction;
}

function renderPreferences(filter = '') {
  const tbody = document.getElementById('prefs-tbody');
  tbody.innerHTML = '';

  const currentLang = allPrefs['ui.language'] || 'ru';
  const dict = langPresets[currentLang] || langPresets['en'];

  const filterLower = filter.toLowerCase().trim();
  const keys = Object.keys(allPrefs).filter(key => {
    const meta = prefMeta[key];
    const ruTitle = meta ? meta.ru.toLowerCase() : '';
    const enTitle = meta ? meta.en.toLowerCase() : '';
    const desc = meta ? (meta.desc_ru || meta.desc_en).toLowerCase() : '';
    return key.toLowerCase().includes(filterLower) ||
           String(allPrefs[key]).toLowerCase().includes(filterLower) ||
           ruTitle.includes(filterLower) ||
           enTitle.includes(filterLower) ||
           desc.includes(filterLower);
  });

  if (keys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">${currentLang === 'ru' ? 'Параметры не найдены по запросу' : 'No preferences matched'} "${filter}"</td></tr>`;
    return;
  }

  keys.sort().forEach(key => {
    const val = allPrefs[key];
    const type = typeof val;
    const meta = prefMeta[key];
    const friendlyName = meta ? (currentLang === 'ru' ? meta.ru : meta.en) : key;
    const description = meta ? (currentLang === 'ru' ? meta.desc_ru : meta.desc_en) : '';

    const tr = document.createElement('tr');

    let valueControl = '';
    if (type === 'boolean') {
      valueControl = `
        <label class="toggle-switch">
          <input type="checkbox" ${val ? 'checked' : ''} onchange="updatePref('${key}', this.checked)">
          <span class="slider"></span>
        </label>
      `;
    } else if (type === 'number') {
      valueControl = `
        <input type="number" class="input-edit" value="${val}" onchange="updatePref('${key}', parseFloat(this.value))">
      `;
    } else {
      valueControl = `
        <input type="text" class="input-edit" value="${val}" onchange="updatePref('${key}', this.value)">
      `;
    }

    tr.innerHTML = `
      <td>
        <div style="display: flex; flex-direction: column; gap: 3px;">
          <div style="display: flex; align-items: center;">
            ${getCategoryBadge(key, currentLang)}
            <span style="font-weight: 600; color: #fff; font-size: 0.9rem;">${friendlyName}</span>
          </div>
          ${description ? `<span style="font-size: 0.78rem; color: var(--text-muted); margin-left: 2px;">${description}</span>` : ''}
          <span class="pref-key" style="color: var(--accent); opacity: 0.8; font-size: 0.75rem; margin-top: 1px;">${key}</span>
        </div>
      </td>
      <td class="pref-type" style="font-size: 0.82rem;">${getLocalizedType(type, currentLang)}</td>
      <td class="pref-value">${valueControl}</td>
      <td style="text-align: right;">
        <button class="btn-reset" onclick="resetPreference('${key}')" title="Сбросить">${dict.resetBtn}</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

async function updatePref(key, value) {
  allPrefs[key] = value;
  if (window.aegisAPI) {
    await window.aegisAPI.setPref(key, value);
    if (key === 'ui.language') {
      const select = document.getElementById('quick-lang-select');
      if (select) select.value = value;
      applyLanguageTexts(value);
    }
  }
}

async function resetPreference(key) {
  if (window.aegisAPI) {
    const defaultVal = await window.aegisAPI.resetPref(key);
    allPrefs[key] = defaultVal;
    if (key === 'ui.language') {
      const select = document.getElementById('quick-lang-select');
      if (select) select.value = defaultVal;
      applyLanguageTexts(defaultVal);
    }
    renderPreferences(document.getElementById('search-prefs').value);
  }
}

document.getElementById('search-prefs').addEventListener('input', (e) => {
  renderPreferences(e.target.value);
});

window.addEventListener('DOMContentLoaded', loadPreferences);
