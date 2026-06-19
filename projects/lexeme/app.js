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
  stats: null,
  activeTab: "practice",
  direction: "target_to_source",
  currentCard: null,
  editingItemId: null,
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
    const [itemsPayload, statsPayload] = await Promise.all([
      api(`/api/lexeme/lists/${state.selectedListId}/items`),
      api(`/api/lexeme/stats?list_id=${state.selectedListId}`),
    ]);
    state.items = itemsPayload.items;
    state.stats = statsPayload;
  } else {
    state.items = [];
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
    app.innerHTML = `<div class="auth-page"><div class="auth-card"><div class="brand"><div class="brand-lockup"><span class="brand-mark">L</span><h1>Lexeme</h1></div><p>Loading...</p></div></div></div>`;
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
      <section class="auth-card">
        <div class="brand">
          <div class="brand-lockup">
            <span class="brand-mark">L</span>
            <h1>Lexeme</h1>
          </div>
          <p>Store expressions, practice both directions, and track what sticks.</p>
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
      </section>
    </main>
  `;
}

function renderDashboard() {
  const list = selectedList();
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="topbar-inner">
          <div>
            <div class="wordmark"><span class="brand-mark small">L</span><span>Lexeme</span></div>
            <div class="muted">Private learning workspace</div>
          </div>
          <div class="userline">
            <span>${escapeHtml(state.user.username)}</span>
            <button type="button" class="ghost" data-action="logout">Log out</button>
          </div>
        </div>
      </header>
      <div class="layout">
        <aside class="sidebar">
          <div class="panel-header">
            <div>
              <h2>Lists</h2>
              <div class="muted">${state.lists.length} total</div>
            </div>
            <button type="button" data-action="refresh">Refresh</button>
          </div>
          <div>
            ${state.lists.length ? state.lists.map(renderListButton).join("") : `<p class="muted">Create your first list.</p>`}
          </div>
          <hr>
          <form id="create-list-form" class="stack">
            <h3>New list</h3>
            <label>Name <input name="name" required maxlength="120" placeholder="Spanish phrases"></label>
            <div class="grid-two">
              <label>Target <input name="target_language" maxlength="80" placeholder="Spanish"></label>
              <label>Source <input name="source_language" maxlength="80" placeholder="English"></label>
            </div>
            <label>Description <textarea name="description" maxlength="500" placeholder="Optional"></textarea></label>
            <button type="submit" class="primary">Create list</button>
          </form>
        </aside>
        <main class="content">
          ${state.error ? `<div class="message error">${escapeHtml(state.error)}</div>` : ""}
          ${state.message ? `<div class="message">${escapeHtml(state.message)}</div>` : ""}
          <section class="panel">
            <div class="panel-header">
              <div>
                <h2>${list ? escapeHtml(list.name) : "No list selected"}</h2>
                <div class="muted">${list ? `${escapeHtml(list.target_language || "Target")} from ${escapeHtml(list.source_language || "source")}` : "Create a list to begin."}</div>
              </div>
              <div class="tab-row">
                ${["practice", "items", "import", "stats"].map((tab) => `
                  <button type="button" data-action="set-tab" data-tab="${tab}" class="${state.activeTab === tab ? "segment-active" : ""}">${tab[0].toUpperCase()}${tab.slice(1)}</button>
                `).join("")}
              </div>
            </div>
            ${renderActiveTab()}
          </section>
        </main>
      </div>
    </div>
  `;
}

function renderListButton(list) {
  return `
    <button type="button" class="list-button ${list.id === state.selectedListId ? "segment-active" : ""}" data-action="select-list" data-list-id="${list.id}">
      <strong>${escapeHtml(list.name)}</strong>
      <span class="muted">${list.item_count} items</span>
    </button>
  `;
}

function renderActiveTab() {
  if (!state.selectedListId) return `<p class="muted">Create a list before adding expressions.</p>`;
  if (state.activeTab === "items") return renderItems();
  if (state.activeTab === "import") return renderImport();
  if (state.activeTab === "stats") return renderStats();
  return renderPractice();
}

function renderPractice() {
  const list = selectedList();
  if (!state.items.length) {
    return `
      <div class="stack">
        <p class="muted">This list has no items yet.</p>
        <button type="button" class="primary" data-action="set-tab" data-tab="items">Add one manually</button>
      </div>
    `;
  }

  const card = state.currentCard;
  return `
    <div class="stack">
      <div class="direction-row">
        <button type="button" data-action="set-direction" data-direction="target_to_source" class="${state.direction === "target_to_source" ? "segment-active" : ""}">
          ${escapeHtml(list.target_language || "Target")} to ${escapeHtml(list.source_language || "source")}
        </button>
        <button type="button" data-action="set-direction" data-direction="source_to_target" class="${state.direction === "source_to_target" ? "segment-active" : ""}">
          ${escapeHtml(list.source_language || "Source")} to ${escapeHtml(list.target_language || "target")}
        </button>
      </div>
      <div class="practice-card">
        ${card ? `
          <div>
            <div class="muted">${directionLabel(card.direction)}</div>
            <div class="prompt">${escapeHtml(card.prompt)}</div>
            <button type="button" class="listen-button" data-action="speak-card" data-card-role="prompt" title="Play pronunciation">Listen</button>
            ${card.revealed ? `
              <div class="answer">${escapeHtml(card.answer)}</div>
              <button type="button" class="listen-button" data-action="speak-card" data-card-role="answer" title="Play pronunciation">Listen</button>
              <p class="muted">Recorded as ${escapeHtml(card.outcome)}.</p>
            ` : `<p class="muted">Decide whether you remembered the answer, then reveal it.</p>`}
          </div>
        ` : `
          <div>
            <div class="prompt">Ready</div>
            <p class="muted">Start a review from ${state.items.length} items.</p>
          </div>
        `}
      </div>
      <div class="action-row">
        ${card && !card.revealed ? `
          <button type="button" class="primary" data-action="answer-card" data-outcome="success">Got it</button>
          <button type="button" class="danger-soft" data-action="answer-card" data-outcome="fail">Missed</button>
          <button type="button" data-action="answer-card" data-outcome="skip">Skip</button>
        ` : `
          <button type="button" class="primary" data-action="next-card">${card ? "Next card" : "Start practice"}</button>
        `}
      </div>
      ${card ? `<p class="help">Selection: ${escapeHtml(card.selection_reason)}. Seen before in this direction: ${card.shown_count_before}.</p>` : ""}
    </div>
  `;
}

function renderItems() {
  return `
    <div class="stack">
      <form id="add-item-form" class="stack">
        <h3>Add expression</h3>
        <div class="grid-two">
          <label>Target language <textarea name="target_text" required maxlength="1000"></textarea></label>
          <label>Source language <textarea name="source_text" required maxlength="1000"></textarea></label>
        </div>
        <button type="submit" class="primary">Add item</button>
      </form>
      <div class="table-wrap">
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
            ${state.items.length ? state.items.map(renderItemRow).join("") : `<tr><td colspan="4" class="muted">No items yet.</td></tr>`}
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
        <div class="cell-with-action">
          <span>${escapeHtml(item.target_text)}</span>
          <button type="button" class="listen-button table-listen" data-action="speak-item" data-item-id="${item.id}" data-side="target" title="Play pronunciation">Listen</button>
        </div>
      </td>
      <td>
        <div class="cell-with-action">
          <span>${escapeHtml(item.source_text)}</span>
          <button type="button" class="listen-button table-listen" data-action="speak-item" data-item-id="${item.id}" data-side="source" title="Play pronunciation">Listen</button>
        </div>
      </td>
      <td>${formatDate(item.updated_at)}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit-item" data-item-id="${item.id}">Edit</button>
          <button type="button" class="danger" data-action="delete-item" data-item-id="${item.id}">Delete</button>
        </div>
      </td>
    </tr>
  `;
}

function renderImport() {
  return `
    <form id="import-form" class="stack">
      <h3>Import CSV or XLSX</h3>
      <p class="muted">The first column is the target expression. The second column is the source translation. Extra columns are ignored.</p>
      <label>
        File
        <input name="file" type="file" accept=".csv,.xlsx,.xlsm" required>
      </label>
      <button type="submit" class="primary">Import into selected list</button>
    </form>
  `;
}

function renderStats() {
  const stats = state.stats;
  if (!stats) return `<p class="muted">No statistics yet.</p>`;

  const totals = stats.totals || {};
  const answered = totals.answered_count || 0;
  const maxDaily = Math.max(1, ...stats.daily.map((row) => row.shown_count));

  return `
    <div class="stack">
      <div class="grid-four">
        <div class="metric"><span class="muted">Items</span><strong>${totals.item_count || 0}</strong></div>
        <div class="metric"><span class="muted">Shown</span><strong>${totals.shown_count || 0}</strong></div>
        <div class="metric"><span class="muted">Answered</span><strong>${answered}</strong></div>
        <div class="metric"><span class="muted">Success rate</span><strong>${pct(totals.success_count || 0, answered)}</strong></div>
      </div>
      <div class="grid-two">
        ${["target_to_source", "source_to_target"].map((direction) => {
          const row = stats.directions[direction] || {};
          const total = row.success_count || 0;
          const missed = row.fail_count || 0;
          const skipped = row.skip_count || 0;
          const answeredDirection = total + missed + skipped;
          return `
            <div class="metric">
              <strong>${directionLabel(direction)}</strong>
              <div class="muted">${row.shown_count || 0} shown · ${pct(total, answeredDirection)} success</div>
            </div>
          `;
        }).join("")}
      </div>
      <div>
        <h3>Last 30 days</h3>
        <div class="daily-bars">
          ${stats.daily.length ? stats.daily.map((row) => `
            <div class="daily-row">
              <span>${formatDay(row.day)}</span>
              <span class="bar-track"><span class="bar-fill" style="width: ${(row.shown_count / maxDaily) * 100}%"></span></span>
              <span>${row.shown_count}</span>
            </div>
          `).join("") : `<p class="muted">No reviews yet.</p>`}
        </div>
      </div>
      <div>
        <h3>Item statistics</h3>
        <div class="table-wrap">
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
        </div>
      </div>
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
    if (action === "logout") return logout();
    if (action === "refresh") return await refresh();
    if (action === "select-list") return await selectList(event.currentTarget.dataset.listId);
    if (action === "set-tab") return await setTab(event.currentTarget.dataset.tab);
    if (action === "set-direction") return setDirection(event.currentTarget.dataset.direction);
    if (action === "next-card") return await loadNextCard();
    if (action === "answer-card") return await answerCard(event.currentTarget.dataset.outcome);
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

async function speakCard(role) {
  if (!state.currentCard) return;
  const side = cardSideForRole(role);
  const text = role === "answer" ? state.currentCard.answer : state.currentCard.prompt;
  await speakText(text, languageForSide(side));
}

async function speakItem(itemId, side) {
  const item = state.items.find((row) => row.id === itemId);
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
  state.stats = null;
  state.currentCard = null;
  if (shouldRender) render();
}

async function selectList(listId) {
  state.selectedListId = listId;
  state.currentCard = null;
  state.editingItemId = null;
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

async function deleteItem(itemId) {
  if (!confirm("Delete this item? Its past review events will remain in the database.")) return;

  const previousItems = state.items;
  const previousLists = state.lists;

  state.items = state.items.filter((item) => item.id !== itemId);
  state.lists = state.lists.map((list) => (
    list.id === state.selectedListId
      ? { ...list, item_count: Math.max(0, list.item_count - 1) }
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
