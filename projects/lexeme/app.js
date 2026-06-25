const API_BASE = "https://personal-backend-production-0d2e.up.railway.app";
const TOKEN_KEY = "lexeme_token";

const LANGUAGE_CODES = {
  arabic: "ar",
  chinese: "zh-CN",
  danish: "da-DK",
  dutch: "nl-NL",
  english: "en-US",
  farsi: "fa-IR",
  french: "fr-FR",
  german: "de-DE",
  greek: "el-GR",
  hebrew: "he-IL",
  hindi: "hi-IN",
  italian: "it-IT",
  japanese: "ja-JP",
  korean: "ko-KR",
  mandarin: "zh-CN",
  norwegian: "nb-NO",
  persian: "fa-IR",
  polish: "pl-PL",
  portuguese: "pt-PT",
  "brazilian portuguese": "pt-BR",
  russian: "ru-RU",
  spanish: "es-ES",
  swedish: "sv-SE",
  turkish: "tr-TR",
};

const state = {
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  authMode: "login",
  lists: [],
  selectedListId: null,
  items: [],
  archivedItems: [],
  stats: null,
  activeTab: "practice",
  direction: "target_to_source",
  currentCard: null,
  editingItemId: null,
  itemView: "active",
  menuOpen: false,
  message: null,
  error: null,
  loading: false,
};

const app = document.getElementById("app");
const ttsAudioCache = new Map();
let activeAudio = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function formatDate(value) {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDay(value) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function pct(success, total) {
  if (!total) return "0%";
  return `${Math.round((success / total) * 100)}%`;
}

function directionLabel(direction) {
  return direction === "target_to_source" ? "Target to source" : "Source to target";
}

function selectedList() {
  return state.lists.find((list) => list.id === state.selectedListId) || null;
}

function statsTotals() {
  return state.stats?.totals || {};
}

function answeredCount() {
  return statsTotals().answered_count || 0;
}

function successRate() {
  return pct(statsTotals().success_count || 0, answeredCount());
}

function activeListLabel() {
  const list = selectedList();
  if (!list) return "No active list";
  return `${list.target_language || "Target"} from ${list.source_language || "source"}`;
}

function tabLabel(tab) {
  return {
    practice: "Practice",
    items: "Library",
    import: "Import",
    stats: "Analytics",
  }[tab] || tab;
}

function languageCodeFromLabel(label, fallback = "en-US") {
  const raw = String(label || "").trim();
  if (!raw) return fallback;
  if (/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(raw)) return raw.replace("_", "-");

  const normalized = raw
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9 -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (LANGUAGE_CODES[normalized]) return LANGUAGE_CODES[normalized];

  const match = Object.entries(LANGUAGE_CODES).find(([name]) => normalized.includes(name));
  return match ? match[1] : fallback;
}

async function speakText(text, languageLabel) {
  const value = String(text || "").trim();
  if (!value) return;

  const languageCode = languageCodeFromLabel(languageLabel);
  const cacheKey = `${languageCode}\n${value}`;
  let source = ttsAudioCache.get(cacheKey);

  if (!source) {
    const payload = await api("/api/lexeme/tts", {
      method: "POST",
      body: {
        text: value,
        language_code: languageCode,
      },
    });
    source = `data:${payload.mime_type || "audio/mpeg"};base64,${payload.audio_base64}`;
    ttsAudioCache.set(cacheKey, source);
  }

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
  }
  activeAudio = new Audio(source);
  await activeAudio.play();
}

function languageForSide(side) {
  const list = selectedList();
  if (!list) return "English";
  return side === "target" ? list.target_language || "Target" : list.source_language || "English";
}

function cardSideForRole(role) {
  if (role === "answer") return state.direction === "target_to_source" ? "source" : "target";
  return state.direction === "target_to_source" ? "target" : "source";
}

function setMessage(message, isError = false) {
  state.message = isError ? null : message;
  state.error = isError ? message : null;
}

async function api(path, options = {}) {
  const headers = {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  let body;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (_) {
    payload = {};
  }

  if (!response.ok) {
    if (response.status === 401) logout(false);
    throw new Error(payload.detail || "Request failed");
  }

  return payload;
}

async function boot() {
  if (!state.token) {
    render();
    return;
  }

  try {
    state.loading = true;
    render();
    const me = await api("/api/lexeme/me");
    state.user = me.user;
    await loadWorkspace();
  } catch (error) {
    localStorage.removeItem(TOKEN_KEY);
    state.token = null;
    state.user = null;
    setMessage(error.message, true);
  } finally {
    state.loading = false;
    render();
  }
}

async function loadWorkspace() {
  const listPayload = await api("/api/lexeme/lists");
  state.lists = listPayload.lists;

  if (!state.selectedListId || !state.lists.some((list) => list.id === state.selectedListId)) {
    state.selectedListId = state.lists[0]?.id || null;
  }

  if (state.selectedListId) {
    const [itemsPayload, archivedItemsPayload, statsPayload] = await Promise.all([
      api(`/api/lexeme/lists/${state.selectedListId}/items?archived=false`),
      api(`/api/lexeme/lists/${state.selectedListId}/items?archived=true`),
      api(`/api/lexeme/stats?list_id=${state.selectedListId}`),
    ]);
    state.items = itemsPayload.items;
    state.archivedItems = archivedItemsPayload.items;
    state.stats = statsPayload;
  } else {
    state.items = [];
    state.archivedItems = [];
    state.stats = null;
  }
}

async function loadSelectedStats() {
  if (!state.selectedListId) {
    state.stats = null;
    return;
  }
  state.stats = await api(`/api/lexeme/stats?list_id=${state.selectedListId}`);
}

function render() {
  if (state.loading && !state.user) {
    app.innerHTML = `<div class="auth-page"><section class="auth-shell loading-shell"><div class="brand"><div class="brand-lockup"><span class="brand-mark">L</span><h1>Lexeme</h1></div><p>Loading your workspace...</p></div></section></div>`;
    return;
  }

  if (!state.token || !state.user) {
    renderAuth();
    bindAuth();
    return;
  }

  renderDashboard();
  bindDashboard();
}

function renderAuth() {
  const isLogin = state.authMode === "login";
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-shell">
        <div class="auth-intro">
          <div class="brand">
            <div class="brand-lockup">
              <span class="brand-mark">L</span>
              <h1>Lexeme</h1>
            </div>
            <p>Expression memory for language learners who want focused review, clear progress, and a calm workspace.</p>
          </div>
          <div class="auth-preview">
            <div class="preview-header">
              <span class="eyebrow">Today</span>
              <strong>Review queue</strong>
            </div>
            <div class="preview-row">
              <span>Active cards</span>
              <strong>128</strong>
            </div>
            <div class="preview-row">
              <span>Success rate</span>
              <strong>74%</strong>
            </div>
            <div class="preview-card">
              <span class="eyebrow">Spanish to English</span>
              <strong>dar en el clavo</strong>
              <span>to hit the nail on the head</span>
            </div>
          </div>
        </div>
        <div class="auth-card">
          <div>
            <span class="eyebrow">Private workspace</span>
            <h2>${isLogin ? "Log in" : "Create account"}</h2>
          </div>
          ${state.error ? `<div class="message error">${escapeHtml(state.error)}</div>` : ""}
          ${state.message ? `<div class="message">${escapeHtml(state.message)}</div>` : ""}
          <div class="auth-switch">
            <button type="button" data-auth-mode="login" class="${isLogin ? "segment-active" : ""}">Log in</button>
            <button type="button" data-auth-mode="register" class="${!isLogin ? "segment-active" : ""}">Create account</button>
          </div>
          <form id="auth-form" class="stack">
            <label>
              Username
              <input name="username" autocomplete="username" required minlength="3" maxlength="64">
            </label>
            <label>
              Password
              <input name="password" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" required minlength="8">
            </label>
            <button class="primary" type="submit">${isLogin ? "Log in" : "Create account"}</button>
          </form>
        </div>
      </section>
    </main>
  `;
}

function renderDashboard() {
  const list = selectedList();
  const totals = statsTotals();
  const answered = answeredCount();
  const shown = totals.shown_count || 0;
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="topbar-inner">
          <div class="topbar-left">
            <button type="button" class="menu-button" data-action="toggle-menu" aria-label="Open menu" aria-expanded="${state.menuOpen}">
              <span class="hamburger-lines" aria-hidden="true"></span>
            </button>
            <div>
              <div class="wordmark"><span class="brand-mark small">L</span><span>Lexeme</span></div>
              <div class="topbar-subtitle">${escapeHtml(activeListLabel())}</div>
            </div>
          </div>
          <div class="userline">
            <span>${escapeHtml(state.user.username)}</span>
            <button type="button" class="ghost" data-action="logout">Log out</button>
          </div>
        </div>
      </header>
      ${state.menuOpen ? `<div class="menu-backdrop" data-action="close-menu"></div>` : ""}
      ${renderMenuDrawer()}
      <main class="workspace">
        ${state.error ? `<div class="message error">${escapeHtml(state.error)}</div>` : ""}
        ${state.message ? `<div class="message">${escapeHtml(state.message)}</div>` : ""}
        <section class="workspace-hero">
          <div class="hero-copy">
            <span class="eyebrow">Study workspace</span>
            <h2>${list ? escapeHtml(list.name) : "Create a learning list"}</h2>
            <p>${list ? escapeHtml(list.description || activeListLabel()) : "Use the menu to create the first collection."}</p>
            <div class="hero-actions">
              <button type="button" class="primary" data-action="${list ? "set-tab" : "toggle-menu"}" ${list ? 'data-tab="practice"' : ""}>${list ? "Practice" : "Create list"}</button>
              ${list ? `<button type="button" data-action="set-tab" data-tab="items">Manage library</button>` : ""}
            </div>
          </div>
          <div class="hero-ledger">
            <div class="ledger-card">
              <span>Active</span>
              <strong>${state.items.length}</strong>
            </div>
            <div class="ledger-card">
              <span>Archived</span>
              <strong>${state.archivedItems.length}</strong>
            </div>
            <div class="ledger-card">
              <span>Shown</span>
              <strong>${shown}</strong>
            </div>
            <div class="ledger-card">
              <span>Success</span>
              <strong>${answered ? successRate() : "0%"}</strong>
            </div>
          </div>
        </section>
        <nav class="product-tabs" aria-label="Workspace sections">
          ${["practice", "items", "import", "stats"].map((tab) => `
            <button type="button" data-action="set-tab" data-tab="${tab}" class="${state.activeTab === tab ? "segment-active" : ""}">
              <span>${tabLabel(tab)}</span>
            </button>
          `).join("")}
        </nav>
        <section class="product-stage ${state.activeTab}-stage">
          ${renderActiveTab()}
        </section>
      </main>
    </div>
  `;
}

function renderMenuDrawer() {
  return `
    <aside class="menu-drawer ${state.menuOpen ? "open" : ""}" aria-hidden="${!state.menuOpen}">
      <div class="drawer-brand">
        <div class="wordmark"><span class="brand-mark small">L</span><span>Lexeme</span></div>
        <button type="button" class="ghost" data-action="close-menu">Close</button>
      </div>
      <div class="drawer-panel">
        <div class="drawer-section-title">
          <div>
            <span class="eyebrow">Collections</span>
            <h2>${state.lists.length} lists</h2>
          </div>
          <button type="button" data-action="refresh">Refresh</button>
        </div>
        <div class="list-stack">
          ${state.lists.length ? state.lists.map(renderListButton).join("") : `<p class="muted">No lists yet.</p>`}
        </div>
      </div>
      <form id="create-list-form" class="drawer-panel stack">
        <div>
          <span class="eyebrow">New collection</span>
          <h3>Create list</h3>
        </div>
        <label>Name <input name="name" required maxlength="120" placeholder="Spanish phrases"></label>
        <div class="grid-two compact">
          <label>Target <input name="target_language" maxlength="80" placeholder="Spanish"></label>
          <label>Source <input name="source_language" maxlength="80" placeholder="English"></label>
        </div>
        <label>Description <textarea name="description" maxlength="500" placeholder="Optional"></textarea></label>
        <button type="submit" class="primary">Create list</button>
      </form>
    </aside>
  `;
}

function renderListButton(list) {
  const archivedCount = list.archived_count || 0;
  return `
    <button type="button" class="list-button ${list.id === state.selectedListId ? "segment-active" : ""}" data-action="select-list" data-list-id="${list.id}">
      <span>
        <strong>${escapeHtml(list.name)}</strong>
        <small>${escapeHtml(list.target_language || "Target")} / ${escapeHtml(list.source_language || "Source")}</small>
      </span>
      <span class="list-count">${list.item_count}${archivedCount ? ` +${archivedCount}` : ""}</span>
    </button>
  `;
}

function renderActiveTab() {
  if (!state.selectedListId) {
    return `
      <div class="empty-state">
        <span class="eyebrow">No collection</span>
        <h3>Create a list to start</h3>
        <p class="muted">Lists keep each language, class, or theme separate.</p>
        <button type="button" class="primary" data-action="toggle-menu">Open menu</button>
      </div>
    `;
  }
  if (state.activeTab === "items") return renderItems();
  if (state.activeTab === "import") return renderImport();
  if (state.activeTab === "stats") return renderStats();
  return renderPractice();
}

function renderPractice() {
  const list = selectedList();
  const totals = statsTotals();
  const answered = answeredCount();
  if (!state.items.length) {
    return `
      <div class="empty-state">
        <span class="eyebrow">Practice</span>
        <h3>No active cards</h3>
        <p class="muted">${state.archivedItems.length ? "Archived cards are available in Items." : "Add expressions to begin practicing."}</p>
        <div class="action-row centered">
          <button type="button" class="primary" data-action="set-tab" data-tab="items">${state.archivedItems.length ? "Manage items" : "Add one manually"}</button>
        </div>
      </div>
    `;
  }

  const card = state.currentCard;
  return `
    <div class="practice-layout">
      <section class="study-console">
        <div class="console-head">
          <div>
            <span class="eyebrow">Practice mode</span>
            <h3>${directionLabel(state.direction)}</h3>
          </div>
          <div class="direction-row">
            <button type="button" data-action="set-direction" data-direction="target_to_source" class="${state.direction === "target_to_source" ? "segment-active" : ""}">
              ${escapeHtml(list.target_language || "Target")} to ${escapeHtml(list.source_language || "source")}
            </button>
            <button type="button" data-action="set-direction" data-direction="source_to_target" class="${state.direction === "source_to_target" ? "segment-active" : ""}">
              ${escapeHtml(list.source_language || "Source")} to ${escapeHtml(list.target_language || "target")}
            </button>
          </div>
        </div>
        <div class="practice-card">
          ${card ? `
            <div class="practice-card-inner">
              <div class="card-meta">
                <span>${directionLabel(card.direction)}</span>
                <span>Seen ${card.shown_count_before} times</span>
              </div>
              <div class="prompt">${escapeHtml(card.prompt)}</div>
              <button type="button" class="listen-button" data-action="speak-card" data-card-role="prompt" title="Play pronunciation">Listen</button>
              ${card.revealed ? `
                <div class="answer-panel">
                  <span class="eyebrow">Answer</span>
                  <div class="answer">${escapeHtml(card.answer)}</div>
                  <button type="button" class="listen-button" data-action="speak-card" data-card-role="answer" title="Play pronunciation">Listen</button>
                  <span class="outcome-chip ${escapeHtml(card.outcome)}">${escapeHtml(card.outcome)}</span>
                </div>
              ` : `<p class="muted">Mark your recall, then the answer appears here.</p>`}
            </div>
          ` : `
            <div class="practice-card-inner ready-state">
              <span class="eyebrow">Queue ready</span>
              <div class="prompt">Start review</div>
              <p class="muted">${state.items.length} active expressions available.</p>
            </div>
          `}
        </div>
        <div class="review-controls">
          ${card && !card.revealed ? `
            <button type="button" class="primary" data-action="answer-card" data-outcome="success">Got it</button>
            <button type="button" class="danger-soft" data-action="answer-card" data-outcome="fail">Missed</button>
            <button type="button" data-action="answer-card" data-outcome="skip">Skip</button>
            <button type="button" data-action="archive-current">Archive</button>
          ` : `
            <button type="button" class="primary" data-action="next-card">${card ? "Next card" : "Start practice"}</button>
            ${card ? `<button type="button" data-action="archive-current">Archive</button>` : ""}
          `}
        </div>
        ${card ? `<p class="help">Selection: ${escapeHtml(card.selection_reason)}.</p>` : ""}
      </section>
      <aside class="session-panel">
        <span class="eyebrow">Session context</span>
        <dl class="session-stats">
          <div><dt>Active cards</dt><dd>${state.items.length}</dd></div>
          <div><dt>Total shown</dt><dd>${totals.shown_count || 0}</dd></div>
          <div><dt>Answered</dt><dd>${answered}</dd></div>
          <div><dt>Success</dt><dd>${answered ? successRate() : "0%"}</dd></div>
        </dl>
        <div class="session-note">
          <strong>Archive</strong>
          <span>Archived cards leave the practice queue but remain restorable from the library.</span>
        </div>
      </aside>
    </div>
  `;
}

function renderItems() {
  const visibleItems = state.itemView === "archived" ? state.archivedItems : state.items;
  const emptyText = state.itemView === "archived" ? "No archived items." : "No active items yet.";

  return `
    <div class="library-layout">
      <section class="library-toolbar">
        <div>
          <span class="eyebrow">Library</span>
          <h3>${state.itemView === "archived" ? "Archived expressions" : "Active expressions"}</h3>
          <p class="muted">${visibleItems.length} visible in this view.</p>
        </div>
        <div class="item-view-row">
          <button type="button" data-action="set-item-view" data-item-view="active" class="${state.itemView === "active" ? "segment-active" : ""}">Active ${state.items.length}</button>
          <button type="button" data-action="set-item-view" data-item-view="archived" class="${state.itemView === "archived" ? "segment-active" : ""}">Archived ${state.archivedItems.length}</button>
        </div>
      </section>
      ${state.itemView === "active" ? `
      <form id="add-item-form" class="editor-panel stack">
        <div>
          <span class="eyebrow">Manual entry</span>
          <h3>Add expression</h3>
        </div>
        <div class="grid-two">
          <label>Target language <textarea name="target_text" required maxlength="1000"></textarea></label>
          <label>Source language <textarea name="source_text" required maxlength="1000"></textarea></label>
        </div>
        <div class="action-row">
          <button type="submit" class="primary">Add item</button>
          <button type="button" data-action="set-tab" data-tab="import">Import file</button>
        </div>
      </form>
      ` : ""}
      <div class="data-panel">
        <table>
          <thead>
            <tr>
              <th>Target</th>
              <th>Source</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${visibleItems.length ? visibleItems.map(renderItemRow).join("") : `<tr><td colspan="4" class="muted">${emptyText}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderItemRow(item) {
  if (state.editingItemId === item.id) {
    return `
      <tr>
        <td colspan="4">
          <form class="edit-item-form stack" data-item-id="${item.id}">
            <div class="grid-two">
              <label>Target <textarea name="target_text" required maxlength="1000">${escapeHtml(item.target_text)}</textarea></label>
              <label>Source <textarea name="source_text" required maxlength="1000">${escapeHtml(item.source_text)}</textarea></label>
            </div>
            <div class="row-actions">
              <button type="submit" class="primary">Save</button>
              <button type="button" data-action="cancel-edit">Cancel</button>
            </div>
          </form>
        </td>
      </tr>
    `;
  }

  return `
    <tr>
      <td>
        <div class="phrase-cell">
          <strong>${escapeHtml(item.target_text)}</strong>
          <button type="button" class="listen-button table-listen" data-action="speak-item" data-item-id="${item.id}" data-side="target" title="Play pronunciation">Listen</button>
        </div>
      </td>
      <td>
        <div class="phrase-cell">
          <span>${escapeHtml(item.source_text)}</span>
          <button type="button" class="listen-button table-listen" data-action="speak-item" data-item-id="${item.id}" data-side="source" title="Play pronunciation">Listen</button>
        </div>
      </td>
      <td>${formatDate(item.updated_at)}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit-item" data-item-id="${item.id}">Edit</button>
          ${item.archived_at ? `
            <button type="button" class="primary-soft" data-action="restore-item" data-item-id="${item.id}">Restore</button>
          ` : `
            <button type="button" data-action="archive-item" data-item-id="${item.id}">Archive</button>
          `}
          <button type="button" class="danger" data-action="delete-item" data-item-id="${item.id}">Delete</button>
        </div>
      </td>
    </tr>
  `;
}

function renderImport() {
  return `
    <div class="import-layout">
      <form id="import-form" class="editor-panel stack">
        <div>
          <span class="eyebrow">Bulk upload</span>
          <h3>Import CSV or XLSX</h3>
          <p class="muted">Column one becomes the target expression. Column two becomes the source translation.</p>
        </div>
        <label>
          File
          <input name="file" type="file" accept=".csv,.xlsx,.xlsm" required>
        </label>
        <button type="submit" class="primary">Import into selected list</button>
      </form>
      <aside class="import-spec">
        <span class="eyebrow">File shape</span>
        <div class="spec-row"><strong>A</strong><span>Target expression</span></div>
        <div class="spec-row"><strong>B</strong><span>Source translation</span></div>
        <div class="spec-row muted"><strong>C+</strong><span>Ignored for now</span></div>
      </aside>
    </div>
  `;
}

function renderStats() {
  const stats = state.stats;
  if (!stats) return `<p class="muted">No statistics yet.</p>`;

  const totals = stats.totals || {};
  const answered = totals.answered_count || 0;
  const maxDaily = Math.max(1, ...stats.daily.map((row) => row.shown_count));

  return `
    <div class="analytics-layout">
      <div class="grid-four">
        <div class="metric"><span>Items</span><strong>${totals.item_count || 0}</strong></div>
        <div class="metric"><span>Shown</span><strong>${totals.shown_count || 0}</strong></div>
        <div class="metric"><span>Answered</span><strong>${answered}</strong></div>
        <div class="metric"><span>Success rate</span><strong>${pct(totals.success_count || 0, answered)}</strong></div>
      </div>
      <div class="direction-grid">
        ${["target_to_source", "source_to_target"].map((direction) => {
          const row = stats.directions[direction] || {};
          const total = row.success_count || 0;
          const missed = row.fail_count || 0;
          const skipped = row.skip_count || 0;
          const answeredDirection = total + missed + skipped;
          return `
            <div class="direction-card">
              <strong>${directionLabel(direction)}</strong>
              <div class="direction-meta">
                <span>${row.shown_count || 0} shown</span>
                <span>${pct(total, answeredDirection)} success</span>
              </div>
              <div class="mini-breakdown">
                <span style="width: ${answeredDirection ? (total / answeredDirection) * 100 : 0}%"></span>
                <span style="width: ${answeredDirection ? (missed / answeredDirection) * 100 : 0}%"></span>
                <span style="width: ${answeredDirection ? (skipped / answeredDirection) * 100 : 0}%"></span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
      <section class="chart-panel">
        <div class="section-heading">
          <span class="eyebrow">Last 30 days</span>
          <h3>Review activity</h3>
        </div>
        <div class="daily-bars">
          ${stats.daily.length ? stats.daily.map((row) => `
            <div class="daily-row">
              <span>${formatDay(row.day)}</span>
              <span class="bar-track"><span class="bar-fill" style="width: ${(row.shown_count / maxDaily) * 100}%"></span></span>
              <span>${row.shown_count}</span>
            </div>
          `).join("") : `<p class="muted">No reviews yet.</p>`}
        </div>
      </section>
      <section class="data-panel">
        <div class="section-heading table-heading">
          <span class="eyebrow">Per expression</span>
          <h3>Item statistics</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Expression</th>
              <th>Target to source</th>
              <th>Source to target</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            ${stats.items.length ? stats.items.map((item) => `
              <tr>
                <td><strong>${escapeHtml(item.target_text)}</strong><br><span class="muted">${escapeHtml(item.source_text)}</span></td>
                <td>${item.target_to_source_shown} shown · ${item.target_to_source_success} right · ${item.target_to_source_fail} missed</td>
                <td>${item.source_to_target_shown} shown · ${item.source_to_target_success} right · ${item.source_to_target_fail} missed</td>
                <td>${formatDate(item.last_seen_at)}</td>
              </tr>
            `).join("") : `<tr><td colspan="4" class="muted">No items yet.</td></tr>`}
          </tbody>
        </table>
      </section>
    </div>
  `;
}

function bindAuth() {
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authMode = button.dataset.authMode;
      state.error = null;
      state.message = null;
      render();
    });
  });

  document.getElementById("auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      username: form.get("username"),
      password: form.get("password"),
    };

    try {
      state.loading = true;
      render();
      const payload = await api(`/api/lexeme/auth/${state.authMode === "login" ? "login" : "register"}`, {
        method: "POST",
        body,
      });
      state.token = payload.token;
      state.user = payload.user;
      localStorage.setItem(TOKEN_KEY, state.token);
      setMessage("Signed in.");
      await loadWorkspace();
    } catch (error) {
      setMessage(error.message, true);
    } finally {
      state.loading = false;
      render();
    }
  });
}

function bindDashboard() {
  document.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", handleAction);
  });

  document.getElementById("create-list-form")?.addEventListener("submit", handleCreateList);
  document.getElementById("add-item-form")?.addEventListener("submit", handleAddItem);
  document.getElementById("import-form")?.addEventListener("submit", handleImport);
  document.querySelectorAll(".edit-item-form").forEach((form) => {
    form.addEventListener("submit", handleEditItem);
  });
}

async function handleAction(event) {
  const action = event.currentTarget.dataset.action;
  try {
    if (action === "toggle-menu") return toggleMenu();
    if (action === "close-menu") return closeMenu();
    if (action === "logout") return logout();
    if (action === "refresh") return await refresh();
    if (action === "select-list") return await selectList(event.currentTarget.dataset.listId);
    if (action === "set-tab") return await setTab(event.currentTarget.dataset.tab);
    if (action === "set-item-view") return setItemView(event.currentTarget.dataset.itemView);
    if (action === "set-direction") return setDirection(event.currentTarget.dataset.direction);
    if (action === "next-card") return await loadNextCard();
    if (action === "answer-card") return await answerCard(event.currentTarget.dataset.outcome);
    if (action === "archive-current") return await archiveCurrentCard();
    if (action === "archive-item") return await archiveItem(event.currentTarget.dataset.itemId);
    if (action === "restore-item") return await restoreItem(event.currentTarget.dataset.itemId);
    if (action === "speak-card") return await speakCard(event.currentTarget.dataset.cardRole);
    if (action === "speak-item") return await speakItem(event.currentTarget.dataset.itemId, event.currentTarget.dataset.side);
    if (action === "edit-item") return editItem(event.currentTarget.dataset.itemId);
    if (action === "cancel-edit") return cancelEdit();
    if (action === "delete-item") return await deleteItem(event.currentTarget.dataset.itemId);
  } catch (error) {
    setMessage(error.message, true);
    render();
  }
}

function toggleMenu() {
  state.menuOpen = !state.menuOpen;
  render();
}

function closeMenu() {
  state.menuOpen = false;
  render();
}

async function speakCard(role) {
  if (!state.currentCard) return;
  const side = cardSideForRole(role);
  const text = role === "answer" ? state.currentCard.answer : state.currentCard.prompt;
  await speakText(text, languageForSide(side));
}

async function speakItem(itemId, side) {
  const item = [...state.items, ...state.archivedItems].find((row) => row.id === itemId);
  if (!item) return;
  await speakText(side === "target" ? item.target_text : item.source_text, languageForSide(side));
}

async function refresh() {
  setMessage("Refreshed.");
  await loadWorkspace();
  render();
}

function logout(shouldRender = true) {
  localStorage.removeItem(TOKEN_KEY);
  state.token = null;
  state.user = null;
  state.lists = [];
  state.items = [];
  state.archivedItems = [];
  state.stats = null;
  state.currentCard = null;
  state.menuOpen = false;
  if (shouldRender) render();
}

async function selectList(listId) {
  state.selectedListId = listId;
  state.currentCard = null;
  state.editingItemId = null;
  state.itemView = "active";
  state.menuOpen = false;
  await loadWorkspace();
  render();
}

async function setTab(tab) {
  state.activeTab = tab;
  if (tab === "stats") await loadWorkspace();
  render();
}

function setDirection(direction) {
  state.direction = direction;
  state.currentCard = null;
  render();
}

function setItemView(itemView) {
  state.itemView = itemView === "archived" ? "archived" : "active";
  state.editingItemId = null;
  render();
}

async function handleCreateList(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api("/api/lexeme/lists", {
      method: "POST",
      body: {
        name: form.get("name"),
        description: form.get("description"),
        target_language: form.get("target_language"),
        source_language: form.get("source_language"),
      },
    });
    setMessage("List created.");
    await loadWorkspace();
    state.menuOpen = false;
    render();
  } catch (error) {
    setMessage(error.message, true);
    render();
  }
}

async function handleAddItem(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api(`/api/lexeme/lists/${state.selectedListId}/items`, {
      method: "POST",
      body: {
        target_text: form.get("target_text"),
        source_text: form.get("source_text"),
      },
    });
    setMessage("Item added.");
    state.itemView = "active";
    await loadWorkspace();
    render();
  } catch (error) {
    setMessage(error.message, true);
    render();
  }
}

async function handleImport(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const payload = await api(`/api/lexeme/lists/${state.selectedListId}/import`, {
      method: "POST",
      formData: form,
    });
    setMessage(`Imported ${payload.imported} rows. Skipped ${payload.skipped}.`);
    await loadWorkspace();
    render();
  } catch (error) {
    setMessage(error.message, true);
    render();
  }
}

function editItem(itemId) {
  state.editingItemId = itemId;
  render();
}

function cancelEdit() {
  state.editingItemId = null;
  render();
}

async function handleEditItem(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api(`/api/lexeme/items/${event.currentTarget.dataset.itemId}`, {
      method: "PATCH",
      body: {
        target_text: form.get("target_text"),
        source_text: form.get("source_text"),
      },
    });
    state.editingItemId = null;
    setMessage("Item updated.");
    await loadWorkspace();
    render();
  } catch (error) {
    setMessage(error.message, true);
    render();
  }
}

async function archiveCurrentCard() {
  if (!state.currentCard) return;
  await archiveItem(state.currentCard.item_id, true);
}

async function archiveItem(itemId, fromPractice = false) {
  await api(`/api/lexeme/items/${itemId}/archive`, { method: "POST" });
  if (state.currentCard?.item_id === itemId) state.currentCard = null;
  setMessage(fromPractice ? "Card archived." : "Item archived.");
  await loadWorkspace();
  render();
}

async function restoreItem(itemId) {
  await api(`/api/lexeme/items/${itemId}/restore`, { method: "POST" });
  setMessage("Item restored.");
  await loadWorkspace();
  render();
}

async function deleteItem(itemId) {
  if (!confirm("Delete this item? Its past review events will remain in the database.")) return;

  const previousItems = state.items;
  const previousArchivedItems = state.archivedItems;
  const previousLists = state.lists;
  const item = [...state.items, ...state.archivedItems].find((row) => row.id === itemId);
  const wasArchived = Boolean(item?.archived_at);

  state.items = state.items.filter((item) => item.id !== itemId);
  state.archivedItems = state.archivedItems.filter((item) => item.id !== itemId);
  state.lists = state.lists.map((list) => (
    list.id === state.selectedListId
      ? {
        ...list,
        item_count: wasArchived ? list.item_count : Math.max(0, list.item_count - 1),
        archived_count: wasArchived ? Math.max(0, (list.archived_count || 0) - 1) : list.archived_count || 0,
      }
      : list
  ));
  if (state.currentCard?.item_id === itemId) state.currentCard = null;
  setMessage("Item deleted.");
  render();

  try {
    await api(`/api/lexeme/items/${itemId}`, { method: "DELETE" });
    await loadWorkspace();
    render();
  } catch (error) {
    state.items = previousItems;
    state.archivedItems = previousArchivedItems;
    state.lists = previousLists;
    setMessage(error.message, true);
    render();
  }
}

async function loadNextCard() {
  const payload = await api(`/api/lexeme/lists/${state.selectedListId}/practice/next?direction=${state.direction}`, {
    method: "POST",
  });
  state.currentCard = { ...payload, revealed: false, outcome: null };
  setMessage(null);
  render();
}

async function answerCard(outcome) {
  if (!state.currentCard) return;

  state.currentCard = { ...state.currentCard, revealed: true, outcome };
  render();

  await api(`/api/lexeme/review-events/${state.currentCard.event_id}/answer`, {
    method: "POST",
    body: { outcome },
  });
  await loadSelectedStats();
  render();
}

boot();
