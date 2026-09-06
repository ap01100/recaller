/**
 * Recaller — Frontend SPA Engine
 * Vanilla ES6+ application for active recall self-testing.
 * Supports Server API (Python/Node) with seamless fallback to LocalStorage/IndexedDB.
 */

// ==============================================================================
// 1. DEFAULT DEMO TESTS (Used for initial seed and offline fallback)
// ==============================================================================
const DEFAULT_DEMO_TESTS = [
  {
    id: "linux-networking",
    title: "Основы Linux & Сети",
    tags: ["linux", "networking", "devops"],
    default_timer_minutes: 5,
    questions: [
      {
        id: 1,
        type: "choice",
        text: "Какой сигнал посылает команда `kill -9 <PID>` процессу?",
        options: ["SIGTERM", "SIGKILL", "SIGINT", "SIGHUP"],
        correct: [1],
        explanation: "Сигнал 9 — это `SIGKILL`. Он обрабатывается ядром напрямую и не может быть перехвачен или проигнорирован процессом."
      },
      {
        id: 2,
        type: "input",
        text: "Назовите команду Linux для просмотра сокетов и открытых портов (современная замена `netstat`).",
        correct: ["ss", "netstat"],
        explanation: "Утилита `ss` (Socket Statistics) выводит подробную информацию о сетевых сокетах и работает значительно быстрее устаревшей `netstat`."
      },
      {
        id: 3,
        type: "choice",
        text: "Какие из перечисленных портов по умолчанию зарезервированы для защищенных сетевых протоколов?",
        options: ["443 (HTTPS)", "80 (HTTP)", "22 (SSH)", "21 (FTP)"],
        correct: [0, 2],
        explanation: "Порт `443` используется для HTTPS (TLS), порт `22` — для безопасного SSH-доступа. Порты 80 и 21 передают данные в открытом незашифрованном виде."
      },
      {
        id: 4,
        type: "input",
        text: "Какой конфигурационный файл в Linux хранит статические сопоставления IP-адресов доменным именам?",
        correct: ["/etc/hosts", "etc/hosts", "hosts"],
        explanation: "Файл `/etc/hosts` используется операционной системой для локального разрешения имен до обращения к DNS-серверам."
      },
      {
        id: 5,
        type: "choice",
        text: "С помощью какой команды можно посмотреть доступное свободное дисковое пространство в понятном человеку формате?",
        options: ["df -h", "du -sh", "free -m", "lsblk -f"],
        correct: [0],
        explanation: "Команда `df -h` (Disk Free, Human-readable) показывает информацию о доступном и занятом месте на всех смонтированных файловых системах в удобном виде (ГБ/МБ)."
      }
    ]
  },
  {
    id: "web-http-frontend",
    title: "Веб-технологии и протокол HTTP",
    tags: ["web", "http", "api", "protocols"],
    default_timer_minutes: 5,
    questions: [
      {
        id: 1,
        type: "choice",
        text: "Какой код состояния HTTP сообщает клиенту о постоянном перенаправлении ресурса (Redirect)?",
        options: ["200 OK", "301 Moved Permanently", "403 Forbidden", "502 Bad Gateway"],
        correct: [1],
        explanation: "Код `301 Moved Permanently` сообщает клиентам и поисковым роботам, что запрашиваемый ресурс окончательно перенесен на новый URL (указанный в заголовке `Location`)."
      },
      {
        id: 2,
        type: "input",
        text: "Какой HTTP-метод предназначен для частичного изменения ресурса по соглашению REST?",
        correct: ["PATCH", "patch"],
        explanation: "Метод `PATCH` используется для внесения частичных изменений в ресурс, тогда как `PUT` выполняет полную замену представления ресурса."
      },
      {
        id: 3,
        type: "choice",
        text: "Какие из перечисленных заголовков HTTP участвуют в механизме безопасности CORS?",
        options: ["Access-Control-Allow-Origin", "X-Content-Type-Options", "Access-Control-Allow-Methods", "Content-Security-Policy"],
        correct: [0, 2],
        explanation: "Заголовки семейства `Access-Control-Allow-*` используются сервером для указания разрешенных источников, методов и заголовков при кросс-доменных запросах."
      },
      {
        id: 4,
        type: "input",
        text: "Какое значение свойства `display` в CSS используется для одномерного гибкого выравнивания элементов по главной оси?",
        correct: ["flex", "inline-flex"],
        explanation: "`display: flex` (Flexbox) предназначен для распределения элементов вдоль главной оси (row или column) с гибким выравниванием."
      }
    ]
  }
];

// ==============================================================================
// 2. CODEC & VALIDATION UTILITIES (Clean JSON, UTF-8 & Base64)
// ==============================================================================
const TestCodec = {
  /**
   * Safely encode a UTF-8 string to Base64 (supporting Russian Cyrillic & emojis)
   */
  encodeBase64(utf8Str) {
    const bytes = new TextEncoder().encode(utf8Str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },

  /**
   * Safely decode a Base64 string to a UTF-8 string
   */
  decodeBase64(base64Str) {
    const cleanStr = (base64Str || '')
      .trim()
      .replace(/^data:application\/json;base64,/, '')
      .replace(/\s+/g, '');
    const binary = atob(cleanStr);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  },

  /**
   * Validate test JSON schema
   */
  validateTest(data) {
    if (!data || typeof data !== 'object') {
      throw new Error("Тест должен быть JSON-объектом.");
    }
    if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
      throw new Error("Отсутствует обязательное строковое поле 'title'.");
    }
    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error("Тест должен содержать массив 'questions' минимум с одним вопросом.");
    }

    data.questions.forEach((q, idx) => {
      const qNum = idx + 1;
      if (!q.text || typeof q.text !== 'string' || !q.text.trim()) {
        throw new Error(`Вопрос #${qNum}: отсутствует текст вопроса ('text').`);
      }
      if (q.type !== 'choice' && q.type !== 'input') {
        throw new Error(`Вопрос #${qNum}: поле 'type' должно быть 'choice' или 'input'.`);
      }
      if (q.type === 'choice') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          throw new Error(`Вопрос #${qNum} (choice): должен содержать массив 'options' минимум из 2 вариантов.`);
        }
        if (!Array.isArray(q.correct) || q.correct.length === 0) {
          throw new Error(`Вопрос #${qNum} (choice): 'correct' должен быть непустым массивом индексов правильных ответов.`);
        }
        q.correct.forEach(cIdx => {
          if (typeof cIdx !== 'number' || cIdx < 0 || cIdx >= q.options.length) {
            throw new Error(`Вопрос #${qNum} (choice): индекс правильного ответа [${cIdx}] выходит за пределы options.`);
          }
        });
      } else if (q.type === 'input') {
        if (!Array.isArray(q.correct) || q.correct.length === 0) {
          if (typeof q.correct === 'string' && q.correct.trim()) {
            q.correct = [q.correct.trim()];
          } else {
            throw new Error(`Вопрос #${qNum} (input): 'correct' должен содержать допустимые варианты ответа.`);
          }
        }
      }
    });

    // Default fields normalization
    if (!data.id) {
      data.id = data.title.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '-').slice(0, 32) || `test-${Date.now()}`;
    }
    if (!Array.isArray(data.tags)) {
      data.tags = [];
    }
    data.default_timer_minutes = Number(data.default_timer_minutes) || 0;

    return data;
  },

  /**
   * Parse import string: automatically detects plain JSON or Base64
   * Returns: { format: 'json' | 'base64', data: validatedTestData }
   */
  parseImport(rawInput) {
    const raw = (rawInput || '').trim();
    if (!raw) {
      throw new Error("Входная строка пуста. Вставьте чистый JSON теста или Base64-ключ.");
    }

    // Check if raw input looks like direct JSON or starts with { or [
    const looksLikeJson = raw.startsWith('{') || raw.startsWith('[') || raw.includes('"title"') || raw.includes('"questions"');

    if (looksLikeJson) {
      try {
        const parsed = JSON.parse(raw);
        const validated = this.validateTest(parsed);
        return { format: 'json', data: validated };
      } catch (jsonErr) {
        if (raw.startsWith('{')) {
          throw new Error(`Ошибка в синтаксисе JSON: ${jsonErr.message}`);
        }
      }
    }

    // Try parsing as direct JSON anyway
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const validated = this.validateTest(parsed);
        return { format: 'json', data: validated };
      }
    } catch (_) {}

    // Try decoding as Base64 UTF-8
    try {
      const decodedJsonStr = this.decodeBase64(raw);
      const parsed = JSON.parse(decodedJsonStr);
      const validated = this.validateTest(parsed);
      return { format: 'base64', data: validated };
    } catch (b64Err) {
      if (looksLikeJson) {
        throw new Error(`Не удалось разобрать JSON теста: ${b64Err.message}`);
      }
      throw new Error("Не удалось распознать формат. Поддерживаются чистый JSON ({...}) и Base64-ключ.");
    }
  },

  /**
   * Export test object to clean formatted JSON string
   */
  exportJson(testObj, pretty = true) {
    return JSON.stringify(testObj, null, pretty ? 2 : undefined);
  },

  /**
   * Export test object to Base64 UTF-8 string
   */
  exportBase64(testObj) {
    const jsonStr = JSON.stringify(testObj, null, 2);
    return this.encodeBase64(jsonStr);
  },

  /**
   * Trigger browser file download
   */
  downloadFile(filename, content, mimeType = 'application/json;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }
};

// Backwards compatibility alias for Base64Util
const Base64Util = {
  encode(s) { return TestCodec.encodeBase64(s); },
  decode(s) { return TestCodec.decodeBase64(s); },
  validateTest(d) { return TestCodec.validateTest(d); },
  parseImport(s) { return TestCodec.parseImport(s); },
  exportJson(t, p) { return TestCodec.exportJson(t, p); },
  exportBase64(t) { return TestCodec.exportBase64(t); },
  downloadFile(f, c, m) { return TestCodec.downloadFile(f, c, m); }
};

// ==============================================================================
// 3. APPLICATION STATE
// ==============================================================================
const AppState = {
  storageMode: 'server', // 'server' or 'local'
  tests: [],
  history: [],
  currentScreen: 'dashboard', // 'dashboard', 'builder', 'test', 'results'
  activeModal: null, // null, 'import_spec', 'prestart', 'history', 'delete_confirm'
  theme: 'light',
  searchQuery: '',
  selectedTag: 'all',

  // Active Test Run State
  testRun: {
    test: null,
    timerMode: 'none', // 'none', 'test', 'question'
    timerTotalMinutes: 10,
    timerSecondsPerQ: 45,
    shuffle: false,
    questions: [],
    currentIndex: 0,
    userAnswers: {}, // index -> { raw, selectedIndices, inputText, isCorrect }
    startTime: 0,
    endTime: 0,
    timeRemaining: 0,
    timerInterval: null,
    isQuestionSubmitted: false,
    isFailedRetry: false
  },

  // Builder State
  builder: {
    editingId: null,
    title: '',
    tags: '',
    defaultTimerMinutes: 5,
    questions: []
  },

  // Pending Modal Action Payload
  pendingDeleteTestId: null,
  pendingPrestartTestId: null
};

// ==============================================================================
// 4. STORAGE & API LAYER (Server-First with LocalStorage Fallback)
// ==============================================================================
const DataStore = {
  async init() {
    // Check theme
    const savedTheme = localStorage.getItem('recaller_theme');
    if (savedTheme) {
      AppState.theme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      AppState.theme = 'dark';
    }
    this.applyTheme();

    // Check backend API connectivity (Seamless fallback for file:// and offline prototype)
    if (window.location.protocol === 'file:' || window.location.protocol === 'about:') {
      AppState.storageMode = 'local';
      this.loadLocalTests();
    } else {
      try {
        const res = await fetch('/api/tests');
        if (res.ok) {
          const tests = await res.json();
          AppState.storageMode = 'server';
          AppState.tests = tests;
          localStorage.setItem('recaller_cached_tests', JSON.stringify(tests));
        } else {
          throw new Error('API response not ok');
        }
      } catch (e) {
        AppState.storageMode = 'local';
        this.loadLocalTests();
      }
    }

    await this.loadHistory();
    this.renderStorageBadge();
  },

  applyTheme() {
    if (AppState.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('recaller_theme', AppState.theme);
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.innerHTML = AppState.theme === 'dark'
        ? `<svg class="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`
        : `<svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
    }
  },

  toggleTheme() {
    AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme();
  },

  loadLocalTests() {
    const raw = localStorage.getItem('recaller_tests');
    if (raw) {
      try {
        AppState.tests = JSON.parse(raw);
      } catch (e) {
        AppState.tests = DEFAULT_DEMO_TESTS;
      }
    } else {
      AppState.tests = DEFAULT_DEMO_TESTS;
      localStorage.setItem('recaller_tests', JSON.stringify(DEFAULT_DEMO_TESTS));
    }
  },

  async loadHistory() {
    if (AppState.storageMode === 'server') {
      try {
        const res = await fetch('/api/history');
        if (res.ok) {
          AppState.history = await res.json();
          localStorage.setItem('recaller_cached_history', JSON.stringify(AppState.history));
          return;
        }
      } catch (e) {
        console.warn('Failed to fetch history from server:', e);
      }
    }
    const raw = localStorage.getItem('recaller_history');
    AppState.history = raw ? JSON.parse(raw) : [];
  },

  async saveTest(testData) {
    const validated = Base64Util.validateTest(testData);

    if (AppState.storageMode === 'server') {
      try {
        const res = await fetch('/api/tests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validated)
        });
        if (res.ok) {
          // Update in-memory list
          const idx = AppState.tests.findIndex(t => t.id === validated.id);
          if (idx >= 0) AppState.tests[idx] = validated;
          else AppState.tests.unshift(validated);
          showToast("Тест успешно сохранен на сервере!");
          return validated;
        }
      } catch (e) {
        console.warn('Save test to server failed, falling back to local:', e);
      }
    }

    // Local fallback
    const idx = AppState.tests.findIndex(t => t.id === validated.id);
    if (idx >= 0) AppState.tests[idx] = validated;
    else AppState.tests.unshift(validated);
    localStorage.setItem('recaller_tests', JSON.stringify(AppState.tests));
    showToast("Тест сохранен в локальном хранилище.");
    return validated;
  },

  async deleteTest(testId) {
    if (AppState.storageMode === 'server') {
      try {
        const res = await fetch(`/api/tests/${encodeURIComponent(testId)}`, { method: 'DELETE' });
        if (res.ok) {
          AppState.tests = AppState.tests.filter(t => t.id !== testId);
          showToast("Тест удален.");
          return;
        }
      } catch (e) {
        console.warn('Server delete failed:', e);
      }
    }

    AppState.tests = AppState.tests.filter(t => t.id !== testId);
    localStorage.setItem('recaller_tests', JSON.stringify(AppState.tests));
    showToast("Тест удален из локального хранилища.");
  },

  async recordAttempt(attemptData) {
    AppState.history.unshift(attemptData);

    if (AppState.storageMode === 'server') {
      try {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attemptData)
        });
      } catch (e) {
        console.warn('Server history record failed:', e);
      }
    }

    localStorage.setItem('recaller_history', JSON.stringify(AppState.history));
  },

  async clearAllHistory() {
    AppState.history = [];
    if (AppState.storageMode === 'server') {
      try {
        await fetch('/api/history', { method: 'DELETE' });
      } catch (e) { }
    }
    localStorage.removeItem('recaller_history');
    showToast("История прохождений очищена.");
  },

  renderStorageBadge() {
    const badge = document.getElementById('storage-mode-indicator');
    if (!badge) return;
    if (AppState.storageMode === 'server') {
      badge.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#F5F5F5] dark:bg-[#1F1F1F] text-[#171717] dark:text-[#EDEDED] border border-[#E5E5E5] dark:border-[#262626]" title="Данные сохраняются в data/tests/ и data/history/">
          <span class="w-1.5 h-1.5 rounded-full bg-[#171717] dark:bg-[#EDEDED]"></span>
          Сервер: data/tests/
        </span>
      `;
    } else {
      badge.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#F5F5F5] dark:bg-[#1F1F1F] text-[#737373] dark:text-[#A3A3A3] border border-[#E5E5E5] dark:border-[#262626]" title="Автономный режим работы без активного бэкенда">
          <span class="w-1.5 h-1.5 rounded-full bg-[#737373] dark:bg-[#A3A3A3]"></span>
          Автономный: LocalStorage
        </span>
      `;
    }
  }
};

// ==============================================================================
// 5. HELPER FUNCTIONS
// ==============================================================================
function showToast(message, isError = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-enter flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-all pointer-events-auto ${isError
      ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] dark:bg-[#450A0A] dark:text-[#F87171] dark:border-[#7F1D1D]'
      : 'bg-[#171717] text-[#FAFAFA] border-[#262626] dark:bg-[#EDEDED] dark:text-[#171717] dark:border-[#E5E5E5]'
    }`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, -10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format markdown inline code (`code`) into styled HTML
 */
function renderMarkdownText(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  // Replace `inline code` with <code>...</code>
  return escaped.replace(/`([^`]+)`/g, '<code class="code-inline">$1</code>');
}

function formatSeconds(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getBestAttempt(testId) {
  const attempts = AppState.history.filter(h => h.test_id === testId);
  if (!attempts.length) return null;
  attempts.sort((a, b) => b.score_percent - a.score_percent);
  return attempts[0];
}

// ==============================================================================
// 6. SCREEN CONTROLLERS & ROUTING
// ==============================================================================
const Router = {
  navigate(screenName) {
    AppState.currentScreen = screenName;
    document.querySelectorAll('.screen-view').forEach(el => el.classList.add('hidden'));

    const target = document.getElementById(`screen-${screenName}`);
    if (target) {
      target.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    if (screenName === 'dashboard') {
      DashboardView.render();
    } else if (screenName === 'builder') {
      BuilderView.render();
    } else if (screenName === 'test') {
      TestRunView.render();
    } else if (screenName === 'results') {
      ResultsView.render();
    }
  },

  openModal(modalName, payload = null) {
    AppState.activeModal = modalName;
    const modalBackdrop = document.getElementById('modal-backdrop');
    if (modalBackdrop) modalBackdrop.classList.remove('hidden');

    document.querySelectorAll('.app-modal').forEach(m => m.classList.add('hidden'));
    const modalEl = document.getElementById(`modal-${modalName}`);
    if (modalEl) modalEl.classList.remove('hidden');

    if (modalName === 'import_spec') {
      ImportSpecModal.init();
    } else if (modalName === 'export') {
      ExportModal.init(payload);
    } else if (modalName === 'prestart') {
      PrestartModal.init(payload);
    } else if (modalName === 'history') {
      HistoryModal.render();
    } else if (modalName === 'delete_confirm') {
      AppState.pendingDeleteTestId = payload;
    }
  },

  closeModal() {
    AppState.activeModal = null;
    const modalBackdrop = document.getElementById('modal-backdrop');
    if (modalBackdrop) modalBackdrop.classList.add('hidden');
    document.querySelectorAll('.app-modal').forEach(m => m.classList.add('hidden'));
  }
};

// ==============================================================================
// 7. DASHBOARD VIEW (Screen 1)
// ==============================================================================
const DashboardView = {
  render() {
    const listEl = document.getElementById('tests-grid');
    const emptyEl = document.getElementById('tests-empty-state');
    const tagsContainer = document.getElementById('tag-filters-container');
    const countBadge = document.getElementById('tests-total-count');

    // Collect all tags
    const allTags = new Set();
    AppState.tests.forEach(t => {
      (t.tags || []).forEach(tag => allTags.add(tag));
    });

    // Render tag chips
    let tagsHtml = `
      <button onclick="DashboardView.selectTag('all')" class="px-3 py-1 text-xs rounded-md font-medium transition-colors ${AppState.selectedTag === 'all'
        ? 'bg-[#171717] text-[#FAFAFA] dark:bg-[#EDEDED] dark:text-[#171717]'
        : 'bg-[#FFFFFF] dark:bg-[#141414] text-[#525252] dark:text-[#A3A3A3] hover:bg-[#F5F5F5] dark:hover:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#262626]'
      }">Все</button>
    `;
    Array.from(allTags).sort().forEach(tag => {
      const isSel = AppState.selectedTag === tag;
      tagsHtml += `
        <button onclick="DashboardView.selectTag('${escapeHtml(tag)}')" class="px-3 py-1 text-xs rounded-md font-medium transition-colors ${isSel
          ? 'bg-[#171717] text-[#FAFAFA] dark:bg-[#EDEDED] dark:text-[#171717]'
          : 'bg-[#FFFFFF] dark:bg-[#141414] text-[#525252] dark:text-[#A3A3A3] hover:bg-[#F5F5F5] dark:hover:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#262626]'
        }">#${escapeHtml(tag)}</button>
      `;
    });
    if (tagsContainer) tagsContainer.innerHTML = tagsHtml;

    // Filter tests
    const filtered = AppState.tests.filter(t => {
      const q = AppState.searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        t.title.toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q));
      const matchesTag = AppState.selectedTag === 'all' ||
        (t.tags || []).includes(AppState.selectedTag);
      return matchesSearch && matchesTag;
    });

    if (countBadge) {
      countBadge.textContent = `${filtered.length} из ${AppState.tests.length}`;
    }

    if (!filtered.length) {
      if (listEl) listEl.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');

    // Render test cards
    if (listEl) {
      listEl.innerHTML = filtered.map(test => {
        const best = getBestAttempt(test.id);
        const qCount = (test.questions || []).length;
        const defaultTimer = test.default_timer_minutes || 0;

        let bestBadge = `<span class="text-xs text-[#A3A3A3]">Не пройден</span>`;
        if (best) {
          const colorClass = best.score_percent >= 75
            ? 'bg-[#F0FDF4] text-[#15803D] dark:bg-[#052E16] dark:text-[#4ADE80] border border-[#BBF7D0] dark:border-[#166534]'
            : (best.score_percent >= 50
              ? 'bg-[#FFFBEB] text-[#B45309] dark:bg-[#451A03] dark:text-[#FBBF24] border border-[#FDE68A] dark:border-[#78350F]'
              : 'bg-[#FEF2F2] text-[#B91C1C] dark:bg-[#450A0A] dark:text-[#F87171] border border-[#FECACA] dark:border-[#7F1D1D]');
          const dateStr = new Date(best.timestamp * 1000).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
          bestBadge = `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${colorClass}">
              Лучший: ${best.score_percent}% (${dateStr})
            </span>
          `;
        }

        const tagsList = (test.tags || []).map(t =>
          `<span class="px-2 py-0.5 rounded bg-[#F5F5F5] text-[#525252] dark:bg-[#1F1F1F] dark:text-[#A3A3A3] text-[10px] font-mono border border-[#E5E5E5] dark:border-[#262626]">#${escapeHtml(t)}</span>`
        ).join(' ');

        return `
          <div class="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#262626] rounded-xl p-5 hover:border-[#A3A3A3] dark:hover:border-[#525252] transition-colors flex flex-col justify-between">
            <div>
              <div class="flex items-start justify-between gap-3 mb-2">
                <h3 class="font-semibold text-base text-[#171717] dark:text-[#EDEDED] leading-snug line-clamp-2">
                  ${escapeHtml(test.title)}
                </h3>
                ${defaultTimer > 0
            ? `<span class="shrink-0 inline-flex items-center gap-1 text-[11px] text-[#737373] dark:text-[#A3A3A3] bg-[#F5F5F5] dark:bg-[#1F1F1F] px-2 py-0.5 rounded font-mono border border-[#E5E5E5] dark:border-[#262626]">
                      ⏱️ ${defaultTimer}м
                     </span>`
            : `<span class="shrink-0 inline-flex items-center text-[11px] text-[#A3A3A3] bg-[#FAFAFA] dark:bg-[#141414] px-2 py-0.5 rounded border border-[#E5E5E5] dark:border-[#262626]">Без таймера</span>`
          }
              </div>

              <div class="flex flex-wrap gap-1.5 mb-4">
                ${tagsList || '<span class="text-xs text-[#A3A3A3]">Без тегов</span>'}
              </div>

              <div class="flex items-center justify-between py-2 border-y border-[#E5E5E5] dark:border-[#262626] mb-4 text-xs">
                <span class="text-[#737373] dark:text-[#A3A3A3] font-normal">Вопросов: <strong class="text-[#171717] dark:text-[#EDEDED] font-medium">${qCount}</strong></span>
                <div>${bestBadge}</div>
              </div>
            </div>

            <!-- Card Actions -->
            <div class="flex flex-col gap-2 pt-1">
              <button 
                onclick="Router.openModal('prestart', '${escapeHtml(test.id)}')" 
                class="w-full flex items-center justify-center gap-2 bg-[#171717] hover:bg-[#262626] active:bg-black dark:bg-[#EDEDED] dark:hover:bg-[#FFFFFF] dark:text-[#171717] text-[#FAFAFA] font-medium py-2 px-4 rounded-lg transition-colors text-xs"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Начать
              </button>

              <div class="grid grid-cols-3 gap-1.5 text-xs font-medium">
                <button 
                  onclick="BuilderView.startEdit('${escapeHtml(test.id)}')" 
                  class="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[#F5F5F5] hover:bg-[#E5E5E5] text-[#171717] dark:bg-[#1F1F1F] dark:hover:bg-[#262626] dark:text-[#EDEDED] border border-[#E5E5E5] dark:border-[#262626] transition-colors"
                  title="Редактировать вопросы и параметры"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  Править
                </button>

                <button 
                  onclick="Router.openModal('export', '${escapeHtml(test.id)}')" 
                  class="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[#F5F5F5] hover:bg-[#E5E5E5] text-[#171717] dark:bg-[#1F1F1F] dark:hover:bg-[#262626] dark:text-[#EDEDED] border border-[#E5E5E5] dark:border-[#262626] transition-colors"
                  title="Экспорт теста: чистый JSON или Base64"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                  Экспорт
                </button>

                <button 
                  onclick="Router.openModal('delete_confirm', '${escapeHtml(test.id)}')" 
                  class="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] dark:bg-[#450A0A]/40 dark:hover:bg-[#450A0A] dark:text-[#F87171] border border-[#FECACA] dark:border-[#7F1D1D] transition-colors"
                  title="Удалить тест"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  Удалить
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  },

  selectTag(tag) {
    AppState.selectedTag = tag;
    this.render();
  },

  handleSearch(query) {
    AppState.searchQuery = query;
    this.render();
  },

  exportBase64(testId) {
    Router.openModal('export', testId);
  },

  openExport(testId) {
    Router.openModal('export', testId);
  },

  confirmDelete() {
    if (AppState.pendingDeleteTestId) {
      DataStore.deleteTest(AppState.pendingDeleteTestId);
      AppState.pendingDeleteTestId = null;
      Router.closeModal();
      this.render();
    }
  },

  restoreDemoTests() {
    DEFAULT_DEMO_TESTS.forEach(t => {
      DataStore.saveTest(t);
    });
    this.render();
    showToast("Демо-тесты восстановлены.");
  }
};

// ==============================================================================
// 8. TEST IMPORT & SPECIFICATION MODAL (Screen 2)
// ==============================================================================
const ImportSpecModal = {
  currentTab: 'import', // 'import' or 'spec'

  init() {
    this.currentTab = 'import';
    this.renderTabs();
    const input = document.getElementById('base64-import-input');
    if (input) input.value = '';
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) fileInput.value = '';
    const preview = document.getElementById('import-preview-box');
    if (preview) preview.classList.add('hidden');
    const errBox = document.getElementById('import-error-box');
    if (errBox) errBox.classList.add('hidden');
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.renderTabs();
  },

  renderTabs() {
    const btnImport = document.getElementById('tab-btn-import');
    const btnSpec = document.getElementById('tab-btn-spec');
    const panelImport = document.getElementById('tab-panel-import');
    const panelSpec = document.getElementById('tab-panel-spec');

    if (this.currentTab === 'import') {
      btnImport.className = "flex-1 py-2.5 text-xs sm:text-sm font-semibold border-b-2 border-[#171717] dark:border-[#EDEDED] text-[#171717] dark:text-[#EDEDED] transition-colors";
      btnSpec.className = "flex-1 py-2.5 text-xs sm:text-sm font-medium text-[#737373] hover:text-[#171717] dark:text-[#A3A3A3] dark:hover:text-[#EDEDED] border-b-2 border-transparent transition-colors";
      panelImport.classList.remove('hidden');
      panelSpec.classList.add('hidden');
    } else {
      btnSpec.className = "flex-1 py-2.5 text-xs sm:text-sm font-semibold border-b-2 border-[#171717] dark:border-[#EDEDED] text-[#171717] dark:text-[#EDEDED] transition-colors";
      btnImport.className = "flex-1 py-2.5 text-xs sm:text-sm font-medium text-[#737373] hover:text-[#171717] dark:text-[#A3A3A3] dark:hover:text-[#EDEDED] border-b-2 border-transparent transition-colors";
      panelSpec.classList.remove('hidden');
      panelImport.classList.add('hidden');
    }
  },

  onFileInputChange(event) {
    const file = event.target.files && event.target.files[0];
    if (file) {
      this.handleFile(file);
    }
  },

  handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const inputEl = document.getElementById('base64-import-input');
      if (inputEl) {
        inputEl.value = text;
      }
      showToast(`Файл «${file.name}» загружен`);
      this.previewInput();
    };
    reader.onerror = () => {
      showToast("Ошибка при чтении файла", true);
    };
    reader.readAsText(file, 'utf-8');
  },

  onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('import-drop-zone');
    if (dropZone) dropZone.classList.add('border-[#171717]', 'dark:border-[#EDEDED]', 'bg-[#F5F5F5]', 'dark:bg-[#1A1A1A]');
  },

  onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('import-drop-zone');
    if (dropZone) dropZone.classList.remove('border-[#171717]', 'dark:border-[#EDEDED]', 'bg-[#F5F5F5]', 'dark:bg-[#1A1A1A]');
  },

  onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('import-drop-zone');
    if (dropZone) dropZone.classList.remove('border-[#171717]', 'dark:border-[#EDEDED]', 'bg-[#F5F5F5]', 'dark:bg-[#1A1A1A]');

    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  },

  previewInput() {
    const inputEl = document.getElementById('base64-import-input');
    const errBox = document.getElementById('import-error-box');
    const previewBox = document.getElementById('import-preview-box');
    const rawValue = (inputEl ? inputEl.value : '').trim();

    if (!rawValue) {
      if (errBox) errBox.classList.add('hidden');
      if (previewBox) previewBox.classList.add('hidden');
      return;
    }

    try {
      const res = TestCodec.parseImport(rawValue);
      const validated = res.data;
      const formatBadge = res.format === 'json'
        ? '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900">Чистый JSON</span>'
        : '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-900">Base64-ключ</span>';

      if (errBox) errBox.classList.add('hidden');
      if (previewBox) {
        previewBox.innerHTML = `
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-semibold text-emerald-700 dark:text-emerald-400">✓ Формат распознан и проверен:</span>
            ${formatBadge}
          </div>
          <div class="text-sm font-bold text-[#171717] dark:text-[#EDEDED]">${escapeHtml(validated.title)}</div>
          <div class="text-xs text-[#737373] dark:text-[#A3A3A3] mt-1">
            Вопросов: <strong class="text-[#171717] dark:text-[#EDEDED]">${validated.questions.length}</strong> • 
            Теги: ${(validated.tags || []).join(', ') || 'нет'} • 
            ID: <code class="font-mono text-[11px]">${escapeHtml(validated.id)}</code>
          </div>
        `;
        previewBox.classList.remove('hidden');
      }
    } catch (err) {
      if (previewBox) previewBox.classList.add('hidden');
      if (errBox) {
        errBox.textContent = "Ошибка проверки: " + err.message;
        errBox.classList.remove('hidden');
      }
    }
  },

  processInput() {
    const inputEl = document.getElementById('base64-import-input');
    const errBox = document.getElementById('import-error-box');
    const previewBox = document.getElementById('import-preview-box');
    const rawValue = (inputEl ? inputEl.value : '').trim();

    errBox.classList.add('hidden');
    previewBox.classList.add('hidden');

    if (!rawValue) {
      errBox.textContent = "Пожалуйста, вставьте чистый JSON или Base64-строку теста.";
      errBox.classList.remove('hidden');
      return;
    }

    try {
      const res = TestCodec.parseImport(rawValue);
      const validated = res.data;
      const formatTitle = res.format === 'json' ? 'чистого JSON' : 'Base64';

      // Save to store
      DataStore.saveTest(validated).then(() => {
        Router.closeModal();
        DashboardView.render();
        showToast(`Тест «${validated.title}» успешно импортирован (${formatTitle})!`);
      });
    } catch (err) {
      errBox.textContent = "Ошибка импорта: " + err.message;
      errBox.classList.remove('hidden');
    }
  },

  copySpecification() {
    const specText = `# Спецификация JSON-схемы теста Recaller

Форматы импорта и экспорта:
1. Чистый JSON (файлы .json или текстовый JSON)
2. Строка Base64 (в кодировке UTF-8)

Обязательные поля:
- "id": уникальный идентификатор теста (строка slug или uuid, опционально).
- "title": название темы или теста (строка).
- "tags": массив тегов (строки).
- "default_timer_minutes": рекомендуемое время в минутах (число, 0 — без ограничений).
- "questions": массив вопросов (минимум 1).

Формат вопросов:
1. Вопрос с вариантами ("type": "choice"):
   - "options": массив строк с вариантами ответов (минимум 2).
   - "correct": массив числовых индексов правильных ответов (например [0] или [0, 2]).
   - "explanation": подробное объяснение (строка, поддерживает \`inline code\`).

2. Вопрос с текстовым вводом ("type": "input"):
   - "correct": массив допустимых строковых ответов (регистр и пробелы игнорируются).
   - "explanation": подробное пояснение правильного ответа.

Пример чистого JSON-шаблона:
{
  "id": "linux-basics",
  "title": "Основы Linux",
  "tags": ["linux", "cli"],
  "default_timer_minutes": 10,
  "questions": [
    {
      "id": 1,
      "type": "choice",
      "text": "Какой сигнал посылает команда \`kill -9 <PID>\`?",
      "options": ["SIGTERM", "SIGKILL", "SIGINT"],
      "correct": [1],
      "explanation": "Сигнал 9 — это SIGKILL."
    },
    {
      "id": 2,
      "type": "input",
      "text": "Команда для просмотра сокетов:",
      "correct": ["ss", "netstat"],
      "explanation": "Утилиты ss и netstat используются для вывода сокетов."
    }
  ]
}`;
    navigator.clipboard.writeText(specText).then(() => {
      showToast("Спецификация скопирована в буфер обмена!");
    }).catch(() => {
      showToast("Не удалось скопировать спецификацию.", true);
    });
  },

  copyDemoJson() {
    const sample = DEFAULT_DEMO_TESTS[0];
    const jsonStr = TestCodec.exportJson(sample, true);
    navigator.clipboard.writeText(jsonStr).then(() => {
      showToast("Демо-тест в чистом JSON скопирован и вставлен в поле!");
    }).catch(() => {});
    const input = document.getElementById('base64-import-input');
    if (input) {
      input.value = jsonStr;
      this.previewInput();
    }
  },

  copyDemoBase64Key() {
    const sample = DEFAULT_DEMO_TESTS[0];
    const b64 = TestCodec.exportBase64(sample);
    navigator.clipboard.writeText(b64).then(() => {
      showToast("Демо-ключ Base64 скопирован и вставлен в поле!");
    }).catch(() => {});
    const input = document.getElementById('base64-import-input');
    if (input) {
      input.value = b64;
      this.previewInput();
    }
  }
};

// ==============================================================================
// 8B. TEST EXPORT MODAL
// ==============================================================================
const ExportModal = {
  currentTestId: null,
  currentFormat: 'json', // 'json' or 'base64'

  init(testId) {
    this.currentTestId = testId;
    this.currentFormat = 'json';
    const test = AppState.tests.find(t => t.id === testId);
    if (!test) {
      showToast("Тест не найден", true);
      Router.closeModal();
      return;
    }

    const titleEl = document.getElementById('export-modal-test-title');
    if (titleEl) titleEl.textContent = test.title || test.id;

    const subtitleEl = document.getElementById('export-modal-test-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = `Вопросов: ${test.questions ? test.questions.length : 0} • Теги: ${(test.tags || []).join(', ') || 'нет'} • ID: ${test.id}`;
    }

    this.switchFormat('json');
  },

  switchFormat(format) {
    this.currentFormat = format;
    const test = AppState.tests.find(t => t.id === this.currentTestId);
    if (!test) return;

    const btnJson = document.getElementById('export-tab-btn-json');
    const btnB64 = document.getElementById('export-tab-btn-base64');
    const previewEl = document.getElementById('export-preview-content');
    const btnCopy = document.getElementById('export-action-copy-btn');
    const btnDownload = document.getElementById('export-action-download-btn');

    if (format === 'json') {
      if (btnJson) btnJson.className = "flex-1 py-2 text-xs sm:text-sm font-semibold border-b-2 border-[#171717] dark:border-[#EDEDED] text-[#171717] dark:text-[#EDEDED] transition-colors";
      if (btnB64) btnB64.className = "flex-1 py-2 text-xs sm:text-sm font-medium text-[#737373] hover:text-[#171717] dark:text-[#A3A3A3] dark:hover:text-[#EDEDED] border-b-2 border-transparent transition-colors";
      if (previewEl) {
        previewEl.value = TestCodec.exportJson(test, true);
      }
      if (btnCopy) btnCopy.textContent = "Скопировать JSON";
      if (btnDownload) btnDownload.textContent = "Скачать .json файл";
    } else {
      if (btnB64) btnB64.className = "flex-1 py-2 text-xs sm:text-sm font-semibold border-b-2 border-[#171717] dark:border-[#EDEDED] text-[#171717] dark:text-[#EDEDED] transition-colors";
      if (btnJson) btnJson.className = "flex-1 py-2 text-xs sm:text-sm font-medium text-[#737373] hover:text-[#171717] dark:text-[#A3A3A3] dark:hover:text-[#EDEDED] border-b-2 border-transparent transition-colors";
      if (previewEl) {
        previewEl.value = TestCodec.exportBase64(test);
      }
      if (btnCopy) btnCopy.textContent = "Скопировать Base64";
      if (btnDownload) btnDownload.textContent = "Скачать .txt файл";
    }
  },

  copyCurrent() {
    const test = AppState.tests.find(t => t.id === this.currentTestId);
    if (!test) return;

    if (this.currentFormat === 'json') {
      const jsonText = TestCodec.exportJson(test, true);
      navigator.clipboard.writeText(jsonText).then(() => {
        showToast("Чистый JSON скопирован в буфер обмена!");
      }).catch(() => {
        prompt("Скопируйте JSON:", jsonText);
      });
    } else {
      const b64Text = TestCodec.exportBase64(test);
      navigator.clipboard.writeText(b64Text).then(() => {
        showToast("Base64-ключ скопирован в буфер обмена!");
      }).catch(() => {
        prompt("Скопируйте Base64-ключ:", b64Text);
      });
    }
  },

  downloadCurrent() {
    const test = AppState.tests.find(t => t.id === this.currentTestId);
    if (!test) return;

    const safeFilename = (test.id || 'test').replace(/[^a-z0-9а-яё_-]/gi, '_');

    if (this.currentFormat === 'json') {
      const jsonText = TestCodec.exportJson(test, true);
      TestCodec.downloadFile(`${safeFilename}.json`, jsonText, 'application/json;charset=utf-8');
      showToast(`Файл ${safeFilename}.json скачивается...`);
    } else {
      const b64Text = TestCodec.exportBase64(test);
      TestCodec.downloadFile(`${safeFilename}_base64.txt`, b64Text, 'text/plain;charset=utf-8');
      showToast(`Файл ${safeFilename}_base64.txt скачивается...`);
    }
  }
};

// ==============================================================================
// 9. MANUAL TEST BUILDER (Screen 3)
// ==============================================================================
const BuilderView = {
  startNew() {
    AppState.builder = {
      editingId: null,
      title: '',
      tags: '',
      defaultTimerMinutes: 5,
      questions: [
        {
          id: 1,
          type: 'choice',
          text: '',
          options: ['', ''],
          correct: [0],
          explanation: ''
        }
      ]
    };
    Router.navigate('builder');
  },

  startEdit(testId) {
    const test = AppState.tests.find(t => t.id === testId);
    if (!test) return;

    AppState.builder = {
      editingId: test.id,
      title: test.title || '',
      tags: (test.tags || []).join(', '),
      defaultTimerMinutes: Number(test.default_timer_minutes) || 0,
      questions: JSON.parse(JSON.stringify(test.questions || []))
    };
    if (AppState.builder.questions.length === 0) {
      AppState.builder.questions.push({
        id: 1,
        type: 'choice',
        text: '',
        options: ['', ''],
        correct: [0],
        explanation: ''
      });
    }
    Router.navigate('builder');
  },

  render() {
    const titleHeader = document.getElementById('builder-header-title');
    const inputTitle = document.getElementById('builder-title');
    const inputTags = document.getElementById('builder-tags');
    const inputTimer = document.getElementById('builder-timer');
    const questionsContainer = document.getElementById('builder-questions-list');

    if (titleHeader) {
      titleHeader.textContent = AppState.builder.editingId
        ? "Редактирование теста"
        : "Создание нового теста";
    }

    if (inputTitle) inputTitle.value = AppState.builder.title;
    if (inputTags) inputTags.value = AppState.builder.tags;
    if (inputTimer) inputTimer.value = AppState.builder.defaultTimerMinutes;

    if (!questionsContainer) return;

    questionsContainer.innerHTML = AppState.builder.questions.map((q, qIndex) => {
      const isChoice = q.type === 'choice';

      let dynamicFields = '';
      if (isChoice) {
        const optionsHtml = (q.options || []).map((opt, optIdx) => {
          const isCorrect = (q.correct || []).includes(optIdx);
          return `
            <div class="flex items-center gap-2 mb-2">
              <input 
                type="checkbox" 
                title="Отметить как правильный вариант"
                ${isCorrect ? 'checked' : ''} 
                onchange="BuilderView.toggleCorrectOption(${qIndex}, ${optIdx})" 
                class="w-4 h-4 accent-[#171717] dark:accent-[#EDEDED] rounded cursor-pointer"
              />
              <span class="text-xs font-mono text-[#737373] w-5 text-center">${optIdx + 1}.</span>
              <input 
                type="text" 
                value="${escapeHtml(opt)}" 
                placeholder="Вариант ответа ${optIdx + 1}" 
                oninput="BuilderView.updateOptionText(${qIndex}, ${optIdx}, this.value)" 
                class="flex-1 px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#0A0A0A] text-[#171717] dark:text-[#EDEDED] placeholder-[#A3A3A3] focus:outline-none focus:border-[#171717] dark:focus:border-[#EDEDED] focus:ring-1 focus:ring-[#171717] dark:focus:ring-[#EDEDED]"
              />
              ${(q.options || []).length > 2 ? `
                <button 
                  type="button" 
                  onclick="BuilderView.removeOption(${qIndex}, ${optIdx})" 
                  class="p-1.5 text-[#DC2626] hover:text-red-700 text-xs rounded hover:bg-[#FEF2F2] dark:hover:bg-[#450A0A]" 
                  title="Удалить вариант"
                >✕</button>
              ` : ''}
            </div>
          `;
        }).join('');

        dynamicFields = `
          <div class="mt-3">
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-medium text-[#525252] dark:text-[#A3A3A3]">Варианты ответов (отметьте галочкой правильные):</label>
              <button 
                type="button" 
                onclick="BuilderView.addOption(${qIndex})" 
                class="text-xs text-[#171717] dark:text-[#EDEDED] hover:underline font-medium"
              >+ Добавить вариант</button>
            </div>
            ${optionsHtml}
          </div>
        `;
      } else {
        // Input type
        const correctAnswers = Array.isArray(q.correct) ? q.correct.join(', ') : (q.correct || '');
        dynamicFields = `
          <div class="mt-3">
            <label class="block text-xs font-medium text-[#525252] dark:text-[#A3A3A3] mb-1">
              Правильные варианты ответа (через запятую):
            </label>
            <input 
              type="text" 
              value="${escapeHtml(correctAnswers)}" 
              placeholder="Например: ss, netstat" 
              oninput="BuilderView.updateInputCorrect(${qIndex}, this.value)" 
              class="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#0A0A0A] text-[#171717] dark:text-[#EDEDED] placeholder-[#A3A3A3] focus:outline-none focus:border-[#171717] dark:focus:border-[#EDEDED] focus:ring-1 focus:ring-[#171717] dark:focus:ring-[#EDEDED]"
            />
            <p class="text-[11px] text-[#737373] dark:text-[#A3A3A3] mt-1">
              При проверке регистр букв и лишние пробелы игнорируются. Любое точное совпадение с одним из вариантов засчитывается.
            </p>
          </div>
        `;
      }

      return `
        <div class="p-4 border border-[#E5E5E5] dark:border-[#262626] rounded-xl bg-[#FAFAFA] dark:bg-[#121212] mb-4">
          <div class="flex items-center justify-between gap-3 mb-3">
            <div class="flex items-center gap-2">
              <span class="w-5 h-5 rounded-md bg-[#171717] dark:bg-[#EDEDED] text-[#FAFAFA] dark:text-[#171717] text-xs font-mono font-medium flex items-center justify-center">
                ${qIndex + 1}
              </span>
              <span class="text-xs font-medium text-[#525252] dark:text-[#A3A3A3]">Тип:</span>
              <select 
                onchange="BuilderView.changeQuestionType(${qIndex}, this.value)" 
                class="text-xs font-medium px-2.5 py-1 rounded-lg border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] text-[#171717] dark:text-[#EDEDED]"
              >
                <option value="choice" ${q.type === 'choice' ? 'selected' : ''}>Варианты выбора (choice)</option>
                <option value="input" ${q.type === 'input' ? 'selected' : ''}>Текстовый ввод (input)</option>
              </select>
            </div>

            ${AppState.builder.questions.length > 1 ? `
              <button 
                type="button" 
                onclick="BuilderView.removeQuestion(${qIndex})" 
                class="text-xs text-[#DC2626] hover:underline"
              >Удалить вопрос</button>
            ` : ''}
          </div>

          <!-- Question Text -->
          <div class="mb-3">
            <label class="block text-xs font-medium text-[#525252] dark:text-[#A3A3A3] mb-1">
              Текст вопроса (поддерживает \`inline code\`):
            </label>
            <textarea 
              rows="2" 
              placeholder="Введите формулировку вопроса..." 
              oninput="BuilderView.updateQuestionText(${qIndex}, this.value)" 
              class="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#0A0A0A] text-[#171717] dark:text-[#EDEDED] placeholder-[#A3A3A3] focus:outline-none focus:border-[#171717] dark:focus:border-[#EDEDED] focus:ring-1 focus:ring-[#171717] dark:focus:ring-[#EDEDED]"
            >${escapeHtml(q.text)}</textarea>
          </div>

          ${dynamicFields}

          <!-- Explanation -->
          <div class="mt-3">
            <label class="block text-xs font-medium text-[#525252] dark:text-[#A3A3A3] mb-1">
              Пояснение к правильному ответу (для экрана результатов):
            </label>
            <textarea 
              rows="2" 
              placeholder="Почему этот ответ правильный..." 
              oninput="BuilderView.updateExplanation(${qIndex}, this.value)" 
              class="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#0A0A0A] text-[#171717] dark:text-[#EDEDED] placeholder-[#A3A3A3] focus:outline-none focus:border-[#171717] dark:focus:border-[#EDEDED] focus:ring-1 focus:ring-[#171717] dark:focus:ring-[#EDEDED]"
            >${escapeHtml(q.explanation || '')}</textarea>
          </div>
        </div>
      `;
    }).join('');
  },

  addQuestion(type = 'choice') {
    AppState.builder.questions.push({
      id: AppState.builder.questions.length + 1,
      type: type,
      text: '',
      options: type === 'choice' ? ['', ''] : [],
      correct: type === 'choice' ? [0] : [],
      explanation: ''
    });
    this.render();
  },

  removeQuestion(idx) {
    if (AppState.builder.questions.length <= 1) return;
    AppState.builder.questions.splice(idx, 1);
    this.render();
  },

  changeQuestionType(qIdx, newType) {
    const q = AppState.builder.questions[qIdx];
    if (!q) return;
    q.type = newType;
    if (newType === 'choice') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        q.options = ['', ''];
      }
      q.correct = [0];
    } else {
      q.correct = [];
    }
    this.render();
  },

  updateQuestionText(qIdx, val) {
    if (AppState.builder.questions[qIdx]) {
      AppState.builder.questions[qIdx].text = val;
    }
  },

  updateExplanation(qIdx, val) {
    if (AppState.builder.questions[qIdx]) {
      AppState.builder.questions[qIdx].explanation = val;
    }
  },

  addOption(qIdx) {
    const q = AppState.builder.questions[qIdx];
    if (q && Array.isArray(q.options)) {
      q.options.push('');
      this.render();
    }
  },

  removeOption(qIdx, optIdx) {
    const q = AppState.builder.questions[qIdx];
    if (q && Array.isArray(q.options) && q.options.length > 2) {
      q.options.splice(optIdx, 1);
      q.correct = (q.correct || []).filter(c => c !== optIdx).map(c => c > optIdx ? c - 1 : c);
      if (q.correct.length === 0) q.correct = [0];
      this.render();
    }
  },

  updateOptionText(qIdx, optIdx, val) {
    const q = AppState.builder.questions[qIdx];
    if (q && q.options && q.options[optIdx] !== undefined) {
      q.options[optIdx] = val;
    }
  },

  toggleCorrectOption(qIdx, optIdx) {
    const q = AppState.builder.questions[qIdx];
    if (!q) return;
    q.correct = q.correct || [];
    if (q.correct.includes(optIdx)) {
      q.correct = q.correct.filter(c => c !== optIdx);
    } else {
      q.correct.push(optIdx);
    }
    this.render();
  },

  updateInputCorrect(qIdx, val) {
    const q = AppState.builder.questions[qIdx];
    if (!q) return;
    const items = val.split(',').map(s => s.trim()).filter(Boolean);
    q.correct = items;
  },

  save() {
    const title = (document.getElementById('builder-title')?.value || '').trim();
    const tagsRaw = (document.getElementById('builder-tags')?.value || '').trim();
    const timerVal = Number(document.getElementById('builder-timer')?.value) || 0;

    if (!title) {
      showToast("Укажите название теста!", true);
      return;
    }

    const tags = tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

    // Validate questions
    for (let i = 0; i < AppState.builder.questions.length; i++) {
      const q = AppState.builder.questions[i];
      if (!q.text.trim()) {
        showToast(`Заполните текст вопроса #${i + 1}`, true);
        return;
      }
      if (q.type === 'choice') {
        const validOptions = (q.options || []).filter(o => o.trim());
        if (validOptions.length < 2) {
          showToast(`Вопрос #${i + 1}: добавьте минимум 2 варианта ответа`, true);
          return;
        }
        if (!q.correct || q.correct.length === 0) {
          showToast(`Вопрос #${i + 1}: отметьте хотя бы один правильный вариант`, true);
          return;
        }
      } else if (q.type === 'input') {
        if (!q.correct || q.correct.length === 0) {
          showToast(`Вопрос #${i + 1}: укажите хотя бы один верный вариант ответа`, true);
          return;
        }
      }
    }

    const testId = AppState.builder.editingId ||
      title.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '-').slice(0, 32) || `test-${Date.now()}`;

    const testPayload = {
      id: testId,
      title: title,
      tags: tags,
      default_timer_minutes: timerVal,
      questions: AppState.builder.questions.map((q, idx) => ({
        id: idx + 1,
        type: q.type,
        text: q.text.trim(),
        options: q.type === 'choice' ? q.options.map(o => o.trim()) : undefined,
        correct: q.correct,
        explanation: (q.explanation || '').trim()
      }))
    };

    DataStore.saveTest(testPayload).then(() => {
      Router.navigate('dashboard');
    });
  },

  exportCurrentJson() {
    const title = (document.getElementById('builder-title')?.value || '').trim();
    if (!title) {
      showToast("Укажите хотя бы название теста для экспорта!", true);
      return;
    }
    const tagsRaw = (document.getElementById('builder-tags')?.value || '').trim();
    const timerVal = Number(document.getElementById('builder-timer')?.value) || 0;
    const tags = tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

    const testId = AppState.builder.editingId ||
      title.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '-').slice(0, 32) || `test-${Date.now()}`;

    const testPayload = {
      id: testId,
      title: title,
      tags: tags,
      default_timer_minutes: timerVal,
      questions: AppState.builder.questions.map((q, idx) => ({
        id: idx + 1,
        type: q.type,
        text: (q.text || '').trim(),
        options: q.type === 'choice' ? (q.options || []).map(o => (o || '').trim()) : undefined,
        correct: q.correct,
        explanation: (q.explanation || '').trim()
      }))
    };

    const jsonStr = TestCodec.exportJson(testPayload, true);
    TestCodec.downloadFile(`${testId}.json`, jsonStr);
    showToast(`Файл ${testId}.json экспортирован и скачивается!`);
  }
};

// ==============================================================================
// 10. PRE-START SETUP MODAL
// ==============================================================================
const PrestartModal = {
  currentTest: null,

  init(testId) {
    const test = AppState.tests.find(t => t.id === testId);
    if (!test) return;
    this.currentTest = test;

    const titleEl = document.getElementById('prestart-test-title');
    const qCountEl = document.getElementById('prestart-question-count');
    const timerInput = document.getElementById('prestart-timer-minutes');
    const perQInput = document.getElementById('prestart-timer-per-q');

    if (titleEl) titleEl.textContent = test.title;
    if (qCountEl) qCountEl.textContent = `${(test.questions || []).length} вопросов`;

    const defTimer = test.default_timer_minutes || 0;
    if (timerInput) timerInput.value = defTimer > 0 ? defTimer : 5;
    if (perQInput) perQInput.value = 30;

    // Set initial radio
    if (defTimer > 0) {
      document.querySelector('input[name="timer_mode"][value="test"]').checked = true;
    } else {
      document.querySelector('input[name="timer_mode"][value="none"]').checked = true;
    }
  },

  start() {
    if (!this.currentTest) return;

    const timerMode = document.querySelector('input[name="timer_mode"]:checked')?.value || 'none';
    const timerMinutes = Number(document.getElementById('prestart-timer-minutes')?.value) || 5;
    const timerPerQ = Number(document.getElementById('prestart-timer-per-q')?.value) || 30;
    const shuffle = document.getElementById('prestart-shuffle-checkbox')?.checked || false;

    Router.closeModal();

    TestRunView.startSession({
      test: this.currentTest,
      timerMode: timerMode,
      timerMinutes: timerMinutes,
      timerSecondsPerQ: timerPerQ,
      shuffle: shuffle,
      isFailedRetry: false
    });
  }
};

// ==============================================================================
// 11. ACTIVE TEST RUN VIEW (Screen 4)
// ==============================================================================
const TestRunView = {
  startSession({ test, timerMode, timerMinutes, timerSecondsPerQ, shuffle, isFailedRetry, customQuestions }) {
    let questions = customQuestions
      ? JSON.parse(JSON.stringify(customQuestions))
      : JSON.parse(JSON.stringify(test.questions || []));

    if (shuffle) {
      // Shuffle questions
      questions.sort(() => Math.random() - 0.5);
      // For choice questions, optionally shuffle options while updating correct indices
      questions.forEach(q => {
        if (q.type === 'choice' && Array.isArray(q.options)) {
          const mapped = q.options.map((opt, idx) => ({
            text: opt,
            isCorrect: (q.correct || []).includes(idx)
          }));
          mapped.sort(() => Math.random() - 0.5);
          q.options = mapped.map(m => m.text);
          q.correct = mapped.map((m, idx) => m.isCorrect ? idx : null).filter(idx => idx !== null);
        }
      });
    }

    let initialTimeRemaining = 0;
    if (timerMode === 'test') {
      initialTimeRemaining = timerMinutes * 60;
    } else if (timerMode === 'question') {
      initialTimeRemaining = timerSecondsPerQ;
    }

    AppState.testRun = {
      test: test,
      timerMode: timerMode,
      timerTotalMinutes: timerMinutes,
      timerSecondsPerQ: timerSecondsPerQ,
      shuffle: shuffle,
      questions: questions,
      currentIndex: 0,
      userAnswers: {},
      startTime: Date.now(),
      endTime: 0,
      timeRemaining: initialTimeRemaining,
      timerInterval: null,
      isQuestionSubmitted: false,
      isFailedRetry: isFailedRetry
    };

    Router.navigate('test');
    this.startTimerIfNeeded();
  },

  startTimerIfNeeded() {
    if (AppState.testRun.timerInterval) {
      clearInterval(AppState.testRun.timerInterval);
      AppState.testRun.timerInterval = null;
    }

    if (AppState.testRun.timerMode === 'none') return;

    AppState.testRun.timerInterval = setInterval(() => {
      if (AppState.testRun.timeRemaining <= 1) {
        AppState.testRun.timeRemaining = 0;
        this.updateTimerDisplay();
        this.handleTimerExpired();
      } else {
        AppState.testRun.timeRemaining -= 1;
        this.updateTimerDisplay();
      }
    }, 1000);

    this.updateTimerDisplay();
  },

  handleTimerExpired() {
    if (AppState.testRun.timerMode === 'question') {
      showToast("Время на текущий вопрос истекло!", true);
      this.submitOrNext();
    } else if (AppState.testRun.timerMode === 'test') {
      if (AppState.testRun.timerInterval) clearInterval(AppState.testRun.timerInterval);
      showToast("Общее время тестирования истекло!", true);
      this.finishTest();
    }
  },

  updateTimerDisplay() {
    const timerBadge = document.getElementById('test-timer-badge');
    if (!timerBadge) return;

    if (AppState.testRun.timerMode === 'none') {
      timerBadge.innerHTML = `<span class="text-xs text-slate-400">Без ограничения времени</span>`;
      return;
    }

    const timeRem = AppState.testRun.timeRemaining;
    const isCritical = timeRem <= 10 || (AppState.testRun.timerMode === 'test' && timeRem <= 60);

    timerBadge.innerHTML = `
      <div class="flex items-center gap-1.5 font-mono font-medium text-xs px-2.5 py-1 rounded-lg border ${isCritical
        ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA] dark:bg-[#450A0A]/60 dark:text-[#F87171] dark:border-[#7F1D1D] timer-critical'
        : 'bg-[#FFFFFF] text-[#171717] border-[#E5E5E5] dark:bg-[#141414] dark:text-[#EDEDED] dark:border-[#262626]'
      }">
        <span>⏱️</span>
        <span>${formatSeconds(timeRem)}</span>
      </div>
    `;
  },

  render() {
    const run = AppState.testRun;
    const totalQ = run.questions.length;
    const currIdx = run.currentIndex;
    const currentQ = run.questions[currIdx];

    if (!currentQ) {
      this.finishTest();
      return;
    }

    // Top progress
    const titleEl = document.getElementById('test-running-title');
    const counterEl = document.getElementById('test-question-counter');
    const progressFill = document.getElementById('test-progress-bar-fill');

    if (titleEl) titleEl.textContent = run.test.title + (run.isFailedRetry ? ' (Работа над ошибками)' : '');
    if (counterEl) counterEl.textContent = `Вопрос ${currIdx + 1} из ${totalQ}`;
    if (progressFill) {
      const pct = Math.round(((currIdx + 1) / totalQ) * 100);
      progressFill.style.width = `${pct}%`;
    }

    this.updateTimerDisplay();

    // Render Question Text
    const qTextEl = document.getElementById('test-question-text');
    if (qTextEl) {
      qTextEl.innerHTML = renderMarkdownText(currentQ.text);
    }

    // Render Interactive Inputs
    const answersContainer = document.getElementById('test-answers-container');
    if (!answersContainer) return;

    const savedAnswer = run.userAnswers[currIdx] || { selectedIndices: [], inputText: '' };

    if (currentQ.type === 'choice') {
      const isMulti = (currentQ.correct || []).length > 1;
      answersContainer.innerHTML = `
        <div class="mb-2 text-xs text-[#737373] dark:text-[#A3A3A3] font-medium">
          ${isMulti ? 'Выберите один или несколько вариантов:' : 'Выберите один правильный вариант:'}
        </div>
        <div class="grid grid-cols-1 gap-2.5">
          ${(currentQ.options || []).map((opt, optIdx) => {
        const isSelected = savedAnswer.selectedIndices.includes(optIdx);
        return `
              <button 
                type="button" 
                onclick="TestRunView.selectOption(${optIdx})" 
                class="option-btn text-left p-3.5 sm:p-4 rounded-lg border font-medium text-sm flex items-start gap-3 transition-colors ${isSelected
            ? 'border-[#171717] dark:border-[#EDEDED] bg-[#F5F5F5] dark:bg-[#1F1F1F] text-[#171717] dark:text-[#EDEDED] ring-1 ring-[#171717] dark:ring-[#EDEDED]'
            : 'border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] text-[#171717] dark:text-[#EDEDED] hover:border-[#A3A3A3] dark:hover:border-[#525252]'
          }"
              >
                <span class="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-mono font-medium ${isSelected
            ? 'bg-[#171717] text-white dark:bg-[#EDEDED] dark:text-[#171717]'
            : 'bg-[#F5F5F5] text-[#737373] dark:bg-[#262626] dark:text-[#A3A3A3] border border-[#E5E5E5] dark:border-[#333333]'
          }">
                  ${optIdx + 1}
                </span>
                <span class="flex-1 question-content leading-relaxed font-normal">${renderMarkdownText(opt)}</span>
              </button>
            `;
      }).join('')}
        </div>
      `;
    } else {
      // Input type
      answersContainer.innerHTML = `
        <div class="mb-2 text-xs text-[#737373] dark:text-[#A3A3A3] font-medium">
          Введите ваш ответ и нажмите Enter:
        </div>
        <div class="relative">
          <input 
            type="text" 
            id="test-input-answer" 
            value="${escapeHtml(savedAnswer.inputText || '')}" 
            placeholder="Введите ответ..." 
            autocomplete="off" 
            autocorrect="off" 
            autocapitalize="off" 
            spellcheck="false" 
            oninput="TestRunView.updateInputAnswer(this.value)" 
            onkeydown="if(event.key === 'Enter') { event.preventDefault(); }"
            class="w-full px-3.5 py-2.5 sm:py-3 text-sm rounded-lg border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#0A0A0A] text-[#171717] dark:text-[#EDEDED] placeholder-[#A3A3A3] focus:outline-none focus:border-[#171717] dark:focus:border-[#EDEDED] focus:ring-1 focus:ring-[#171717] dark:focus:ring-[#EDEDED] transition-colors"
          />
        </div>
      `;
      // Auto-focus input
      setTimeout(() => {
        const inp = document.getElementById('test-input-answer');
        if (inp) inp.focus();
      }, 50);
    }

    // Action button text
    const nextBtn = document.getElementById('test-next-btn');
    if (nextBtn) {
      const isLast = currIdx === totalQ - 1;
      nextBtn.innerHTML = isLast
        ? `Завершить тест <kbd class="ml-2 hidden sm:inline-flex">Enter</kbd>`
        : `Далее <kbd class="ml-2 hidden sm:inline-flex">Enter</kbd>`;
    }
  },

  selectOption(optIdx) {
    const run = AppState.testRun;
    const currQ = run.questions[run.currentIndex];
    if (!currQ) return;

    if (!run.userAnswers[run.currentIndex]) {
      run.userAnswers[run.currentIndex] = { selectedIndices: [], inputText: '' };
    }

    const ans = run.userAnswers[run.currentIndex];
    const isMulti = (currQ.correct || []).length > 1;

    if (isMulti) {
      if (ans.selectedIndices.includes(optIdx)) {
        ans.selectedIndices = ans.selectedIndices.filter(i => i !== optIdx);
      } else {
        ans.selectedIndices.push(optIdx);
      }
    } else {
      ans.selectedIndices = [optIdx];
    }

    this.render();
  },

  updateInputAnswer(val) {
    const run = AppState.testRun;
    if (!run.userAnswers[run.currentIndex]) {
      run.userAnswers[run.currentIndex] = { selectedIndices: [], inputText: '' };
    }
    run.userAnswers[run.currentIndex].inputText = val;
  },

  submitOrNext(options = {}) {
    const run = AppState.testRun;
    const currQ = run.questions[run.currentIndex];
    if (!currQ) return;

    const ans = run.userAnswers[run.currentIndex] || { selectedIndices: [], inputText: '' };

    // Prevent skipping choice questions via keyboard Enter if no option is selected yet
    if (currQ.type === 'choice' && options?.viaKeyboard) {
      if (!ans.selectedIndices || ans.selectedIndices.length === 0) {
        showToast("Выберите хотя бы один вариант ответа (клавиши 1-9)");
        return;
      }
    }

    // Evaluate correctness
    let isCorrect = false;
    if (currQ.type === 'choice') {
      const selectedSorted = [...(ans.selectedIndices || [])].sort().join(',');
      const correctSorted = [...(currQ.correct || [])].sort().join(',');
      isCorrect = selectedSorted.length > 0 && selectedSorted === correctSorted;
    } else {
      // Input: normalize strings
      const userText = (ans.inputText || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const acceptedAnswers = Array.isArray(currQ.correct) ? currQ.correct : [currQ.correct];
      isCorrect = acceptedAnswers.some(acc => {
        const normalizedAcc = String(acc || '').trim().toLowerCase().replace(/\s+/g, ' ');
        return userText === normalizedAcc;
      });
    }

    ans.isCorrect = isCorrect;
    ans.rawQuestion = currQ;
    run.userAnswers[run.currentIndex] = ans;

    if (run.currentIndex < run.questions.length - 1) {
      run.currentIndex += 1;
      if (run.timerMode === 'question') {
        run.timeRemaining = run.timerSecondsPerQ;
      }
      this.render();
    } else {
      this.finishTest();
    }
  },

  finishTest() {
    const run = AppState.testRun;
    if (run.timerInterval) {
      clearInterval(run.timerInterval);
      run.timerInterval = null;
    }
    run.endTime = Date.now();

    // Ensure all answered items are evaluated
    let correctCount = 0;
    const questionsTotal = run.questions.length;
    const errorsList = [];

    run.questions.forEach((q, idx) => {
      let ans = run.userAnswers[idx];
      if (!ans) {
        ans = { selectedIndices: [], inputText: '', isCorrect: false };
        run.userAnswers[idx] = ans;
      }
      ans.rawQuestion = q;

      if (ans.isCorrect) {
        correctCount += 1;
      } else {
        errorsList.push({
          question: q,
          userAnswer: ans
        });
      }
    });

    const scorePercent = questionsTotal > 0 ? Math.round((correctCount / questionsTotal) * 100) : 0;
    const durationSeconds = Math.max(1, Math.round((run.endTime - run.startTime) / 1000));

    const attemptRecord = {
      id: `attempt-${Date.now()}`,
      timestamp: Math.round(Date.now() / 1000),
      test_id: run.test.id,
      test_title: run.test.title,
      score_percent: scorePercent,
      correct_count: correctCount,
      total_questions: questionsTotal,
      duration_seconds: durationSeconds,
      errors_count: errorsList.length,
      is_retry: run.isFailedRetry
    };

    DataStore.recordAttempt(attemptRecord);
    Router.navigate('results');
  },

  confirmExit() {
    if (confirm("Вы уверены, что хотите прервать тестирование? Прогресс текущей попытки не сохранится.")) {
      if (AppState.testRun.timerInterval) {
        clearInterval(AppState.testRun.timerInterval);
        AppState.testRun.timerInterval = null;
      }
      Router.navigate('dashboard');
    }
  }
};

// ==============================================================================
// 12. RESULTS SCREEN (Screen 5)
// ==============================================================================
const ResultsView = {
  currentFilter: 'all', // 'all', 'wrong', 'correct'

  render() {
    const run = AppState.testRun;
    if (!run || !run.test) {
      Router.navigate('dashboard');
      return;
    }

    let correctCount = 0;
    const totalQ = run.questions.length;
    const failedQuestions = [];

    run.questions.forEach((q, idx) => {
      const ans = run.userAnswers[idx];
      if (ans && ans.isCorrect) {
        correctCount += 1;
      } else {
        failedQuestions.push(q);
      }
    });

    const scorePercent = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
    const passed = scorePercent >= 75;
    const duration = Math.max(1, Math.round((run.endTime - run.startTime) / 1000));

    // Summary Card
    const scoreValEl = document.getElementById('results-score-percent');
    const statusBadgeEl = document.getElementById('results-status-badge');
    const correctStatsEl = document.getElementById('results-correct-stats');
    const durationStatsEl = document.getElementById('results-duration-stats');
    const retryFailedBtn = document.getElementById('results-retry-failed-btn');

    if (scoreValEl) {
      scoreValEl.textContent = `${scorePercent}%`;
      scoreValEl.className = 'text-5xl font-bold tracking-tight text-[#171717] dark:text-[#EDEDED]';
    }

    if (statusBadgeEl) {
      statusBadgeEl.innerHTML = passed
        ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#F0FDF4] text-[#15803D] dark:bg-[#052E16] dark:text-[#4ADE80] border border-[#BBF7D0] dark:border-[#166534]">✓ Сдано (Отличный результат)</span>`
        : `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#FEF2F2] text-[#B91C1C] dark:bg-[#450A0A] dark:text-[#F87171] border border-[#FECACA] dark:border-[#7F1D1D]">✕ Требуется повторение</span>`;
    }

    if (correctStatsEl) {
      correctStatsEl.innerHTML = `<strong>${correctCount}</strong> из <strong>${totalQ}</strong> верно (${failedQuestions.length} ошибок)`;
    }

    if (durationStatsEl) {
      durationStatsEl.textContent = formatSeconds(duration);
    }

    if (retryFailedBtn) {
      if (failedQuestions.length > 0) {
        retryFailedBtn.classList.remove('hidden');
        retryFailedBtn.innerHTML = `
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          Работа над ошибками (${failedQuestions.length})
        `;
      } else {
        retryFailedBtn.classList.add('hidden');
      }
    }

    this.renderQuestionBreakdown();
  },

  setFilter(filter) {
    this.currentFilter = filter;
    this.renderQuestionBreakdown();
  },

  renderQuestionBreakdown() {
    const run = AppState.testRun;
    const container = document.getElementById('results-breakdown-list');
    if (!container) return;

    const items = run.questions.map((q, idx) => {
      const ans = run.userAnswers[idx] || { selectedIndices: [], inputText: '', isCorrect: false };
      return { q, ans, idx };
    }).filter(item => {
      if (this.currentFilter === 'wrong') return !item.ans.isCorrect;
      if (this.currentFilter === 'correct') return item.ans.isCorrect;
      return true;
    });

    if (!items.length) {
      container.innerHTML = `<div class="p-8 text-center text-[#A3A3A3] text-sm">Вопросов по выбранному фильтру нет.</div>`;
      return;
    }

    container.innerHTML = items.map(({ q, ans, idx }) => {
      const isCorrect = ans.isCorrect;

      let userAnswerDisplay = '';
      let correctAnswerDisplay = '';

      if (q.type === 'choice') {
        const userOpts = (ans.selectedIndices || []).map(i => q.options[i]).filter(Boolean);
        userAnswerDisplay = userOpts.length > 0
          ? userOpts.map(o => `<code>${escapeHtml(o)}</code>`).join(', ')
          : '<span class="italic text-[#A3A3A3]">Ответ не дан</span>';

        const correctOpts = (q.correct || []).map(i => q.options[i]).filter(Boolean);
        correctAnswerDisplay = correctOpts.map(o => `<code>${escapeHtml(o)}</code>`).join(', ');
      } else {
        userAnswerDisplay = ans.inputText
          ? `<code>${escapeHtml(ans.inputText)}</code>`
          : '<span class="italic text-[#A3A3A3]">Ответ не дан</span>';
        const accepted = Array.isArray(q.correct) ? q.correct : [q.correct];
        correctAnswerDisplay = accepted.map(a => `<code>${escapeHtml(a)}</code>`).join(' или ');
      }

      return `
        <div class="p-4 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] mb-3.5 transition-colors">
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="flex items-center gap-2">
              <span class="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${isCorrect
          ? 'bg-[#15803D] text-white'
          : 'bg-[#DC2626] text-white'
        }">
                ${isCorrect ? '✓' : '✕'}
              </span>
              <span class="text-xs font-mono text-[#737373] dark:text-[#A3A3A3]">Вопрос ${idx + 1}</span>
            </div>
            <span class="text-xs font-medium ${isCorrect ? 'text-[#15803D] dark:text-[#4ADE80]' : 'text-[#DC2626] dark:text-[#F87171]'}">
              ${isCorrect ? 'Верно' : 'Ошибка'}
            </span>
          </div>

          <div class="text-sm font-semibold text-[#171717] dark:text-[#EDEDED] mb-3 question-content leading-relaxed">
            ${renderMarkdownText(q.text)}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs mb-3">
            <div class="p-2.5 rounded-lg bg-[#FAFAFA] dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#262626]">
              <span class="text-[#737373] dark:text-[#A3A3A3] block mb-1">Ваш ответ:</span>
              <div class="${isCorrect ? 'text-[#15803D] dark:text-[#4ADE80]' : 'text-[#DC2626] dark:text-[#F87171]'} font-medium">
                ${userAnswerDisplay}
              </div>
            </div>
            <div class="p-2.5 rounded-lg bg-[#FAFAFA] dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#262626]">
              <span class="text-[#737373] dark:text-[#A3A3A3] block mb-1">Правильный ответ:</span>
              <div class="text-[#15803D] dark:text-[#4ADE80] font-medium">
                ${correctAnswerDisplay}
              </div>
            </div>
          </div>

          ${q.explanation ? `
            <div class="p-3 rounded-lg bg-[#F5F5F5] dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#262626] text-xs text-[#525252] dark:text-[#A3A3A3] explanation-content">
              <span class="font-medium text-[#171717] dark:text-[#EDEDED] block mb-1">💡 Пояснение:</span>
              ${renderMarkdownText(q.explanation)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  retryFailedOnly() {
    const run = AppState.testRun;
    const failedQuestions = run.questions.filter((q, idx) => {
      const ans = run.userAnswers[idx];
      return !ans || !ans.isCorrect;
    });

    if (!failedQuestions.length) {
      showToast("Ошибок не было, отличная работа!");
      return;
    }

    TestRunView.startSession({
      test: run.test,
      timerMode: 'none', // gentle pace for mistake review
      timerMinutes: 5,
      timerSecondsPerQ: 45,
      shuffle: false,
      isFailedRetry: true,
      customQuestions: failedQuestions
    });
  },

  restartAll() {
    const run = AppState.testRun;
    TestRunView.startSession({
      test: run.test,
      timerMode: run.timerMode,
      timerMinutes: run.timerTotalMinutes,
      timerSecondsPerQ: run.timerSecondsPerQ,
      shuffle: run.shuffle,
      isFailedRetry: false
    });
  }
};

// ==============================================================================
// 13. HISTORY MODAL
// ==============================================================================
const HistoryModal = {
  render() {
    const listEl = document.getElementById('history-logs-container');
    if (!listEl) return;

    if (!AppState.history.length) {
      listEl.innerHTML = `
        <div class="p-8 text-center text-slate-400 text-sm">
          История попыток пуста. Пройдите любой тест, чтобы здесь появились результаты.
        </div>
      `;
      return;
    }

    listEl.innerHTML = AppState.history.map(item => {
      const dateStr = new Date(item.timestamp * 1000).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const passed = item.score_percent >= 75;

      return `
        <div class="p-3.5 border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] rounded-lg flex items-center justify-between gap-3 text-xs sm:text-sm transition-colors">
          <div>
            <div class="font-medium text-[#171717] dark:text-[#EDEDED] flex items-center gap-2">
              <span>${escapeHtml(item.test_title)}</span>
              ${item.is_retry ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F5F5] dark:bg-[#1F1F1F] text-[#525252] dark:text-[#A3A3A3] border border-[#E5E5E5] dark:border-[#262626] font-mono">Работа над ошибками</span>' : ''}
            </div>
            <div class="text-[11px] text-[#737373] dark:text-[#A3A3A3] mt-0.5 flex items-center gap-2">
              <span>${dateStr}</span>
              <span>•</span>
              <span>Время: ${formatSeconds(item.duration_seconds || 0)}</span>
              <span>•</span>
              <span>Ошибок: ${item.errors_count || 0}</span>
            </div>
          </div>

          <div class="text-right shrink-0">
            <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium ${passed
          ? 'bg-[#F0FDF4] text-[#15803D] dark:bg-[#052E16] dark:text-[#4ADE80] border border-[#BBF7D0] dark:border-[#166534]'
          : 'bg-[#FEF2F2] text-[#B91C1C] dark:bg-[#450A0A] dark:text-[#F87171] border border-[#FECACA] dark:border-[#7F1D1D]'
        }">
              ${item.score_percent}%
            </span>
          </div>
        </div>
      `;
    }).join('');
  },

  clearHistory() {
    if (confirm("Вы действительно хотите удалить всю историю прохождений?")) {
      DataStore.clearAllHistory().then(() => {
        this.render();
      });
    }
  }
};

// ==============================================================================
// 14. GLOBAL KEYBOARD SHORTCUTS
// ==============================================================================
let isEnterKeyPressed = false;

window.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') {
    isEnterKeyPressed = false;
  }
});

window.addEventListener('keydown', (e) => {
  // If a modal is open, Escape closes it
  if (e.key === 'Escape' && AppState.activeModal) {
    Router.closeModal();
    return;
  }

  // Hotkeys during Test screen
  if (AppState.currentScreen === 'test') {
    const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);

    // Number keys 1-9 for choices (when not focused on input)
    if (!isTyping && e.key >= '1' && e.key <= '9') {
      const optIdx = parseInt(e.key, 10) - 1;
      const currQ = AppState.testRun.questions[AppState.testRun.currentIndex];
      if (currQ && currQ.type === 'choice' && currQ.options && currQ.options[optIdx] !== undefined) {
        e.preventDefault();
        TestRunView.selectOption(optIdx);
      }
    }

    // Enter key to proceed
    if (e.key === 'Enter') {
      if (isEnterKeyPressed || e.repeat) {
        e.preventDefault();
        return;
      }
      isEnterKeyPressed = true;
      e.preventDefault();
      TestRunView.submitOrNext({ viaKeyboard: true });
    }
  }
});

// ==============================================================================
// 15. INITIALIZATION
// ==============================================================================
document.addEventListener('DOMContentLoaded', () => {
  DataStore.init().then(() => {
    DashboardView.render();
  });
});
