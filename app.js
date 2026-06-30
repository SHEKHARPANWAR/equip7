// Main application logic: renders the login screen and the dashboard,
// wires up CRUD actions to data.js, and handles charts/filtering.
import { supabase } from './supabase-client.js';
import { initAuth, onAuthChange, getSession, login, logout } from './auth.js';
import {
  fetchAllData, createTask, updateTask, deleteTask, bulkCreateTasks,
  resetDatabase, getFYForDate,
} from './data.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const STATUSES = ['In Progress', 'Completed', 'Delayed', 'Planned'];

let state = {
  teams: [],
  tasks: [],
  filterTeam: 'All',
  filterFY: 'All',
  filterStatus: 'All',
  search: '',
  editingTask: null,
  loading: true,
  error: null,
};

const root = document.getElementById('app');

function fmtCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// ---------------- LAMP LOGIN SCREEN ----------------
function renderLogin(errorMsg, lampAlreadyOn) {
  root.innerHTML = `
    <div class="lamp-room">
      <div class="lamp-rig">
        <div class="lamp-cord"></div>
        <button type="button" id="pullString" class="lamp-pull-zone" aria-label="Pull the cord to turn on the light">
          <span class="lamp-string"></span>
          <span class="lamp-knob"></span>
        </button>
        <div class="lamp-fixture">
          <div class="lamp-shade"></div>
          <div class="lamp-bulb"></div>
        </div>
        <div class="lamp-glow"></div>
        <div class="lamp-cone"></div>
      </div>

      <div class="login-card lamp-card" id="lampLoginCard">
        <div class="login-brand">
          <div class="login-logo">₹</div>
          <h1>Cost Saving Dashboard</h1>
          <p>Sign in with your authorized account</p>
        </div>
        <form id="loginForm" class="login-form">
          <label>Email
            <input type="email" id="loginEmail" required placeholder="you@company.com" autocomplete="username" />
          </label>
          <label>Password
            <input type="password" id="loginPassword" required placeholder="••••••••" autocomplete="current-password" />
          </label>
          ${errorMsg ? `<div class="login-error">${escapeHtml(errorMsg)}</div>` : ''}
          <button type="submit" class="btn btn-primary btn-block">Sign In</button>
        </form>
        <p class="login-footnote">Accounts are managed in Supabase Authentication. Contact your administrator if you need access.</p>
      </div>

      <p class="lamp-hint" id="lampHint">Pull the cord to turn on the light</p>
    </div>
  `;

  const roomEl = document.querySelector('.lamp-room');
  const pullBtn = document.getElementById('pullString');
  const hint = document.getElementById('lampHint');

  function turnLampOn() {
    if (roomEl.classList.contains('lamp-on')) return;
    roomEl.classList.add('lamp-on');
    if (hint) hint.style.opacity = '0';
    pullBtn.setAttribute('aria-pressed', 'true');
  }

  pullBtn.addEventListener('click', turnLampOn);
  pullBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      turnLampOn();
    }
  });

  if (lampAlreadyOn || errorMsg) {
    turnLampOn();
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    const result = await login(email, password);
    if (!result.success) {
      renderLogin(result.error || 'Invalid email or password.', true);
    }
    // on success, onAuthChange listener will trigger re-render
  });
}

// ---------------- DASHBOARD SHELL ----------------
async function loadData() {
  state.loading = true;
  state.error = null;
  renderDashboard();
  try {
    const { teams, tasks } = await fetchAllData();
    state.teams = teams;
    state.tasks = tasks;
    state.loading = false;
  } catch (err) {
    state.loading = false;
    state.error = err.message || String(err);
  }
  renderDashboard();
}

function getFilteredTasks() {
  return state.tasks.filter((t) => {
    if (state.filterTeam !== 'All' && t.teamCode !== state.filterTeam) return false;
    if (state.filterFY !== 'All' && t.fy !== state.filterFY) return false;
    if (state.filterStatus !== 'All' && t.status !== state.filterStatus) return false;
    if (state.search) {
      const q = state.search.toLowerCase();
      const hay = `${t.title} ${t.member} ${t.teamName} ${t.remarks}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function computeKpis(tasks) {
  const totalSaved = tasks.reduce((sum, t) => sum + (t.costSaved || 0), 0);
  const completed = tasks.filter((t) => t.status === 'Completed').length;
  const inProgress = tasks.filter((t) => t.status === 'In Progress').length;
  const delayed = tasks.filter((t) => t.status === 'Delayed').length;
  return { totalSaved, completed, inProgress, delayed, total: tasks.length };
}

function getAllFYs() {
  const set = new Set(state.tasks.map((t) => t.fy));
  return ['All', ...Array.from(set).sort()];
}

function renderDashboard() {
  if (state.loading) {
    root.innerHTML = `<div class="center-screen"><div class="spinner"></div><p>Loading dashboard…</p></div>`;
    return;
  }
  if (state.error) {
    root.innerHTML = `
      <div class="center-screen">
        <div class="error-box">
          <h2>Couldn't load data</h2>
          <p>${escapeHtml(state.error)}</p>
          <button class="btn btn-primary" id="retryBtn">Retry</button>
        </div>
      </div>`;
    document.getElementById('retryBtn').addEventListener('click', loadData);
    return;
  }

  const filtered = getFilteredTasks();
  const kpis = computeKpis(filtered);
  const fys = getAllFYs();

  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-left">
          <div class="brand-mark">₹</div>
          <div>
            <h1>Cost Saving Dashboard</h1>
            <p class="muted">Team performance &amp; monthly savings tracker</p>
          </div>
        </div>
        <div class="topbar-right">
          <span class="user-chip">${escapeHtml(getSession()?.user?.email || '')}</span>
          <button class="btn btn-ghost" id="logoutBtn">Sign out</button>
        </div>
      </header>

      <main class="main-grid">
        <section class="kpi-row">
          <div class="kpi-card">
            <span class="kpi-label">Total Saved</span>
            <span class="kpi-value">${fmtCurrency(kpis.totalSaved)}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Tasks</span>
            <span class="kpi-value">${kpis.total}</span>
          </div>
          <div class="kpi-card accent-green">
            <span class="kpi-label">Completed</span>
            <span class="kpi-value">${kpis.completed}</span>
          </div>
          <div class="kpi-card accent-amber">
            <span class="kpi-label">In Progress</span>
            <span class="kpi-value">${kpis.inProgress}</span>
          </div>
          <div class="kpi-card accent-red">
            <span class="kpi-label">Delayed</span>
            <span class="kpi-value">${kpis.delayed}</span>
          </div>
        </section>

        <section class="team-grid">
          ${state.teams.map(renderTeamCard).join('')}
        </section>

        <section class="chart-section">
          <h2>Savings by Team</h2>
          <div id="barChart" class="bar-chart"></div>
        </section>

        <section class="toolbar">
          <input type="search" id="searchInput" placeholder="Search tasks, members, remarks…" value="${escapeHtml(state.search)}" />
          <select id="teamFilter">
            <option value="All">All Teams</option>
            ${state.teams.map((t) => `<option value="${t.code}" ${state.filterTeam === t.code ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
          </select>
          <select id="fyFilter">
            ${fys.map((fy) => `<option value="${fy}" ${state.filterFY === fy ? 'selected' : ''}>${fy === 'All' ? 'All Years' : fy}</option>`).join('')}
          </select>
          <select id="statusFilter">
            <option value="All">All Statuses</option>
            ${STATUSES.map((s) => `<option value="${s}" ${state.filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <div class="toolbar-actions">
            <button class="btn btn-secondary" id="importBtn">Import CSV</button>
            <input type="file" id="importFile" accept=".csv" hidden />
            <button class="btn btn-secondary" id="resetBtn">Reset Data</button>
            <button class="btn btn-primary" id="addTaskBtn">+ Add Task</button>
          </div>
        </section>

        <section class="table-section">
          <table class="task-table">
            <thead>
              <tr>
                <th>Title</th><th>Team</th><th>Member</th><th>Month</th><th>FY</th>
                <th>Status</th><th>Cost Saved</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0
                ? `<tr><td colspan="8" class="empty-row">No tasks match your filters.</td></tr>`
                : filtered.map(renderTaskRow).join('')}
            </tbody>
          </table>
        </section>
      </main>
    </div>

    <div id="modalRoot"></div>
  `;

  drawBarChart(state.teams);
  attachDashboardListeners();
}

function renderTeamCard(team) {
  const pct = team.targetReduction > 0
    ? Math.min(100, Math.round(((team.costSaved25_26 + team.costSaved26_27) / team.targetReduction) * 100))
    : 0;
  return `
    <div class="team-card">
      <div class="team-card-head">
        <h3>${escapeHtml(team.name)}</h3>
        <span class="team-module">${escapeHtml(team.module)}</span>
      </div>
      <p class="team-leader">${escapeHtml(team.leader)}</p>
      <div class="team-stats">
        <div><span class="muted">FY25-26</span><strong>${fmtCurrency(team.costSaved25_26)}</strong></div>
        <div><span class="muted">FY26-27</span><strong>${fmtCurrency(team.costSaved26_27)}</strong></div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="muted small">${pct}% of target (${fmtCurrency(team.targetReduction)})</span>
    </div>
  `;
}

function renderTaskRow(task) {
  const statusClass = task.status.toLowerCase().replace(/\s+/g, '-');
  return `
    <tr data-id="${task.id}">
      <td>${escapeHtml(task.title)}</td>
      <td>${escapeHtml(task.teamName)}</td>
      <td>${escapeHtml(task.member)}</td>
      <td>${escapeHtml(task.month)} ${task.year}</td>
      <td>${escapeHtml(task.fy)}</td>
      <td><span class="status-pill status-${statusClass}">${escapeHtml(task.status)}</span></td>
      <td>${fmtCurrency(task.costSaved)}</td>
      <td class="row-actions">
        <button class="icon-btn edit-task" title="Edit">✎</button>
        <button class="icon-btn delete-task" title="Delete">✕</button>
      </td>
    </tr>
  `;
}

function drawBarChart(teams) {
  const el = document.getElementById('barChart');
  if (!el) return;
  const max = Math.max(1, ...teams.map((t) => t.costSaved25_26 + t.costSaved26_27));
  el.innerHTML = teams.map((t) => {
    const total = t.costSaved25_26 + t.costSaved26_27;
    const widthPct = Math.max(2, Math.round((total / max) * 100));
    return `
      <div class="bar-row">
        <span class="bar-label">${escapeHtml(t.name)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${widthPct}%"></div></div>
        <span class="bar-value">${fmtCurrency(total)}</span>
      </div>
    `;
  }).join('');
}

function attachDashboardListeners() {
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await logout();
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderDashboard();
  });
  document.getElementById('teamFilter').addEventListener('change', (e) => {
    state.filterTeam = e.target.value;
    renderDashboard();
  });
  document.getElementById('fyFilter').addEventListener('change', (e) => {
    state.filterFY = e.target.value;
    renderDashboard();
  });
  document.getElementById('statusFilter').addEventListener('change', (e) => {
    state.filterStatus = e.target.value;
    renderDashboard();
  });

  document.getElementById('addTaskBtn').addEventListener('click', () => openTaskModal(null));
  document.querySelectorAll('.edit-task').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.target.closest('tr').dataset.id;
      const task = state.tasks.find((t) => t.id === id);
      openTaskModal(task);
    });
  });
  document.querySelectorAll('.delete-task').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.closest('tr').dataset.id;
      if (!confirm('Delete this task? This cannot be undone.')) return;
      try {
        await deleteTask(id);
        state.tasks = state.tasks.filter((t) => t.id !== id);
        renderDashboard();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  document.getElementById('resetBtn').addEventListener('click', async () => {
    if (!confirm('Reset all data back to the original seed dataset? This deletes any changes you have made.')) return;
    state.loading = true;
    renderDashboard();
    try {
      await resetDatabase();
      await loadData();
    } catch (err) {
      state.loading = false;
      state.error = err.message;
      renderDashboard();
    }
  });

  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const items = parseCsv(text);
    try {
      const imported = await bulkCreateTasks(items, state.teams);
      state.tasks = [...state.tasks, ...imported];
      renderDashboard();
      alert(`Imported ${imported.length} task(s).`);
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    e.target.value = '';
  });
}

// Basic CSV parser expecting headers:
// teamCode,member,title,description,month,year,status,costSaved,remarks
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.trim());
    const row = {};
    headers.forEach((h, idx) => { row[h] = cells[idx]; });
    if (!row.month || !row.year) continue;
    row.fy = getFYForDate(row.month, Number(row.year));
    items.push(row);
  }
  return items;
}

// ---------------- TASK MODAL ----------------
function openTaskModal(task) {
  const isEdit = !!task;
  const modalRoot = document.getElementById('modalRoot');
  const f = task || {
    teamCode: state.teams[0]?.code || '', member: '', title: '', description: '',
    month: MONTHS[new Date().getMonth()], year: new Date().getFullYear(),
    status: 'In Progress', costSaved: 0, remarks: '', supportingDocName: '',
  };

  modalRoot.innerHTML = `
    <div class="modal-overlay">
      <div class="modal">
        <h2>${isEdit ? 'Edit Task' : 'Add Task'}</h2>
        <form id="taskForm" class="task-form">
          <label>Team
            <select name="teamCode" required>
              ${state.teams.map((t) => `<option value="${t.code}" ${f.teamCode === t.code ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
            </select>
          </label>
          <label>Member
            <input name="member" value="${escapeHtml(f.member)}" placeholder="Team member name" />
          </label>
          <label>Title
            <input name="title" required value="${escapeHtml(f.title)}" placeholder="Task title" />
          </label>
          <label>Description
            <textarea name="description" rows="2">${escapeHtml(f.description)}</textarea>
          </label>
          <div class="form-row">
            <label>Month
              <select name="month">
                ${MONTHS.map((m) => `<option value="${m}" ${f.month === m ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </label>
            <label>Year
              <input type="number" name="year" value="${f.year}" required />
            </label>
          </div>
          <div class="form-row">
            <label>Status
              <select name="status">
                ${STATUSES.map((s) => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </label>
            <label>Cost Saved (₹)
              <input type="number" step="0.01" name="costSaved" value="${f.costSaved}" required />
            </label>
          </div>
          <label>Remarks
            <textarea name="remarks" rows="2">${escapeHtml(f.remarks)}</textarea>
          </label>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="cancelModal">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Task'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('cancelModal').addEventListener('click', () => { modalRoot.innerHTML = ''; });
  document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const fields = Object.fromEntries(fd.entries());
    fields.fy = getFYForDate(fields.month, Number(fields.year));
    fields.costSaved = Number(fields.costSaved);
    fields.year = Number(fields.year);

    try {
      if (isEdit) {
        const updated = await updateTask(task.id, fields, task);
        state.tasks = state.tasks.map((t) => (t.id === task.id ? updated : t));
      } else {
        const created = await createTask(fields, state.teams);
        state.tasks = [...state.tasks, created];
      }
      modalRoot.innerHTML = '';
      renderDashboard();
    } catch (err) {
      alert(err.message);
    }
  });
}

// ---------------- BOOTSTRAP ----------------
async function start() {
  await initAuth();
  onAuthChange((session) => {
    if (session) {
      loadData();
    } else {
      renderLogin(null);
    }
  });
}

start();
