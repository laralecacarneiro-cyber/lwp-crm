/* ============================================================
   LWP CRM — frontend SPA
   ============================================================ */

// -------- tiny helpers --------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const view = () => $('#view');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const daysSince = (s) => {
  if (!s) return null;
  const ms = Date.now() - new Date(s).getTime();
  return Math.floor(ms / (86400 * 1000));
};
const daysUntil = (s) => {
  if (!s) return null;
  const ms = new Date(s).getTime() - Date.now();
  return Math.ceil(ms / (86400 * 1000));
};

const tagClass = (kind, value) => {
  if (!value) return '';
  const slug = String(value).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `tag ${kind}-${slug}`;
};

// -------- api client --------
const api = {
  async get(path) {
    const r = await fetch(path, { credentials: 'include' });
    if (r.status === 401) { window.location.href = '/login.html'; return; }
    if (!r.ok) throw new Error((await r.json()).error || 'error');
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (r.status === 401) { window.location.href = '/login.html'; return; }
    if (!r.ok) throw new Error((await r.json()).error || 'error');
    return r.json();
  },
  async put(path, body) {
    const r = await fetch(path, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (r.status === 401) { window.location.href = '/login.html'; return; }
    if (!r.ok) throw new Error((await r.json()).error || 'error');
    return r.json();
  },
  async del(path) {
    const r = await fetch(path, { method: 'DELETE', credentials: 'include' });
    if (r.status === 401) { window.location.href = '/login.html'; return; }
    if (!r.ok) throw new Error((await r.json()).error || 'error');
    return r.json();
  },
  async upload(path, formData) {
    const r = await fetch(path, { method: 'POST', credentials: 'include', body: formData });
    if (r.status === 401) { window.location.href = '/login.html'; return; }
    if (!r.ok) throw new Error((await r.json()).error || 'error');
    return r.json();
  }
};

// -------- toast --------
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// -------- modal --------
function openModal(html, onOpen) {
  const overlay = $('#modalOverlay');
  const body = $('#modalBody');
  body.innerHTML = html;
  overlay.classList.add('open');
  if (onOpen) onOpen(body);
}
function closeModal() {
  $('#modalOverlay').classList.remove('open');
  $('#modalBody').innerHTML = '';
}
$('#modalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); closeDetail(); }
});

// -------- detail panel --------
let currentOrg = null;
function closeDetail() {
  $('#detailOverlay').classList.remove('open');
  $('#detailPanel').classList.remove('open');
  currentOrg = null;
}
$('#detailOverlay').addEventListener('click', closeDetail);

// -------- routing --------
const ROUTES = {
  dashboard: renderDashboard,
  organisations: renderOrganisations,
  search: renderSearch,
  bulk: renderBulk,
  log: renderLog,
  backup: renderBackup
};
function navTo(route) {
  window.location.hash = route;
}
function currentRoute() {
  const h = window.location.hash.replace('#', '');
  return ROUTES[h] ? h : 'dashboard';
}
async function router() {
  const r = currentRoute();
  $$('.nav-link').forEach(el => el.classList.toggle('active', el.dataset.route === r));
  view().innerHTML = '<div class="empty">Loading...</div>';
  try {
    await ROUTES[r]();
  } catch (e) {
    console.error(e);
    view().innerHTML = `<div class="banner">Error: ${esc(e.message)}</div>`;
  }
}
window.addEventListener('hashchange', router);
$$('.nav-link').forEach(el => el.addEventListener('click', () => navTo(el.dataset.route)));
$('#logoutBtn').addEventListener('click', async () => {
  await api.post('/api/logout', {});
  window.location.href = '/login.html';
});

// -------- state cache --------
let SETTINGS = {};
let FACETS = { categories: [], countries: [], priorities: [], statuses: [] };

async function loadBootstrap() {
  const [settings, facets] = await Promise.all([
    api.get('/api/settings'),
    api.get('/api/organisations/facets')
  ]);
  SETTINGS = settings;
  FACETS = facets;
  updateBackupStatus();
}
function updateBackupStatus() {
  const ts = SETTINGS.last_backup_at;
  const el = $('#backupStatus');
  if (!ts) { el.textContent = 'never'; return; }
  const days = daysSince(ts);
  el.textContent = days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
  if (days >= 7) el.style.color = 'var(--clay-2)';
}

// ============================================================
// DASHBOARD
// ============================================================
async function renderDashboard() {
  const data = await api.get('/api/dashboard');
  const tierMap = Object.fromEntries(data.by_tier.map(r => [r.priority, r.n]));
  const statusMap = Object.fromEntries(data.by_status.map(r => [r.status, r.n]));

  const backupBanner = SETTINGS.last_backup_at
    ? (daysSince(SETTINGS.last_backup_at) >= 7 ? `
      <div class="banner">
        <div class="grow">Your last backup was ${daysSince(SETTINGS.last_backup_at)} days ago. Time to export.</div>
        <button class="btn small primary" onclick="navTo('backup')">Backup now</button>
      </div>` : '')
    : `<div class="banner info">
        <div class="grow">You haven't exported a backup yet. Data lives in Supabase, but a local file is safer.</div>
        <button class="btn small primary" onclick="navTo('backup')">Backup now</button>
      </div>`;

  view().innerHTML = `
    <div class="view-header">
      <div class="eyebrow">Dashboard</div>
      <h1>${data.total} organisations, <span class="italic-clay">${(tierMap['Tier 1'] || 0)} in tier 1</span>.</h1>
      <div class="subtitle">Your priority pipeline for the coming days.</div>
    </div>

    ${backupBanner}

    <div class="grid-cards">
      <div class="stat-card"><div class="label">Total</div><div class="value">${data.total}</div></div>
      <div class="stat-card"><div class="label">Tier 1</div><div class="value"><em>${tierMap['Tier 1'] || 0}</em></div></div>
      <div class="stat-card"><div class="label">In dialogue</div><div class="value">${statusMap['In dialogue'] || 0}</div></div>
      <div class="stat-card"><div class="label">Met</div><div class="value">${statusMap['Met'] || 0}</div></div>
      <div class="stat-card"><div class="label">Partner active</div><div class="value">${statusMap['Partner active'] || 0}</div></div>
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-title">
          <div>
            <div class="eyebrow">Tier 1, not started</div>
            <h2>Priority outreach</h2>
          </div>
          <button class="btn small ghost" onclick="navTo('organisations')">See all</button>
        </div>
        ${data.tier1_not_started.length === 0 ? '<div class="empty">Nothing pending. Everyone in tier 1 has a status.</div>' : ''}
        <ul class="action-list">
          ${data.tier1_not_started.map(o => `
            <li>
              <div class="name">
                <a href="#" onclick="openDetail(${o.id}); return false;">${esc(o.name)}</a>
                <div class="sub">${esc(o.category || '')} · ${esc(o.city || o.country || '')}</div>
              </div>
              <button class="btn small clay" onclick='openEmailDrafter(${o.id})'>Draft email</button>
            </li>
          `).join('')}
        </ul>
      </div>

      <div class="card">
        <div class="card-title">
          <div>
            <div class="eyebrow">Due in the next 14 days</div>
            <h2>Next actions</h2>
          </div>
        </div>
        ${data.next_actions.length === 0 ? '<div class="empty">Nothing scheduled. Set next action dates as you plan.</div>' : ''}
        <ul class="action-list">
          ${data.next_actions.map(o => {
            const d = daysUntil(o.next_action_date);
            const cls = d < 0 ? 'overdue' : d === 0 ? 'today' : '';
            const when = d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'today' : `in ${d}d`;
            return `
              <li>
                <div class="name">
                  <a href="#" onclick="openDetail(${o.id}); return false;">${esc(o.name)}</a>
                  <div class="sub">${esc(o.next_action || '')}</div>
                </div>
                <div class="when ${cls}">${when}</div>
              </li>`;
          }).join('')}
        </ul>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <div class="card-title">
        <div>
          <div class="eyebrow">30+ days since last contact</div>
          <h2>Stale conversations</h2>
        </div>
      </div>
      ${data.stale.length === 0 ? '<div class="empty">No stale conversations. Well done.</div>' : ''}
      <ul class="action-list">
        ${data.stale.map(o => `
          <li>
            <div class="name">
              <a href="#" onclick="openDetail(${o.id}); return false;">${esc(o.name)}</a>
              <div class="sub">${esc(o.status || '')}</div>
            </div>
            <div class="when overdue">${o.days_since} days</div>
            <button class="btn small ghost" onclick='openEmailDrafter(${o.id})'>Draft</button>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

// ============================================================
// ORGANISATIONS LIST + FILTERS
// ============================================================
let orgFilterState = { search: '', category: '', priority: '', status: '', country: '' };

async function renderOrganisations() {
  const f = orgFilterState;
  const params = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
  const orgs = await api.get('/api/organisations?' + params.toString());

  const catOpts = FACETS.categories.map(c => `<option ${c === f.category ? 'selected' : ''}>${esc(c)}</option>`).join('');
  const cntOpts = FACETS.countries.map(c => `<option ${c === f.country ? 'selected' : ''}>${esc(c)}</option>`).join('');

  view().innerHTML = `
    <div class="view-header">
      <div class="eyebrow">Organisations</div>
      <h1>All the <span class="italic-cobalt">institutions and partners</span> on your radar.</h1>
    </div>

    <div class="filters">
      <input type="search" id="fSearch" placeholder="Search name, contact, notes..." value="${esc(f.search)}">
      <select id="fCategory"><option value="">Any category</option>${catOpts}</select>
      <select id="fPriority">
        <option value="">Any priority</option>
        <option ${f.priority === 'Tier 1' ? 'selected' : ''}>Tier 1</option>
        <option ${f.priority === 'Tier 2' ? 'selected' : ''}>Tier 2</option>
        <option ${f.priority === 'Tier 3' ? 'selected' : ''}>Tier 3</option>
      </select>
      <select id="fStatus"><option value="">Any status</option>
        ${FACETS.statuses.map(s => `<option ${s === f.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}
      </select>
      <select id="fCountry"><option value="">Any country</option>${cntOpts}</select>
      <div class="spacer"></div>
      <span class="count">${orgs.length} shown</span>
      <button class="btn primary" onclick="openAddOrg()">+ New</button>
    </div>

    ${orgs.length === 0 ? `
      <div class="card"><div class="empty">
        No organisations match those filters.
        ${SETTINGS.excel_imported === 'true' ? '' : ' You have not imported your Excel yet. Go to Backup to import it.'}
      </div></div>
    ` : `
      <table class="org-table">
        <thead>
          <tr>
            <th>Organisation</th>
            <th>Category</th>
            <th>Country</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Next action</th>
            <th>Last contact</th>
          </tr>
        </thead>
        <tbody>
          ${orgs.map(o => `
            <tr class="clickable" data-id="${o.id}">
              <td>
                <div class="name">${esc(o.name)}</div>
                ${o.city ? `<div class="sub">${esc(o.city)}</div>` : ''}
              </td>
              <td>${esc(o.category || '')}</td>
              <td>${esc(o.country || '')}</td>
              <td>${o.priority ? `<span class="${tagClass('tier', o.priority.replace('Tier ', ''))}">${esc(o.priority)}</span>` : ''}</td>
              <td>${o.status ? `<span class="${tagClass('status', o.status)}">${esc(o.status)}</span>` : ''}</td>
              <td>${esc(o.next_action || '')}${o.next_action_date ? `<div class="sub">${fmtDate(o.next_action_date)}</div>` : ''}</td>
              <td>${o.last_contact ? fmtDate(o.last_contact) : '<span class="sub">—</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `}
  `;

  $('#fSearch').addEventListener('input', debounce((e) => { orgFilterState.search = e.target.value; renderOrganisations(); }, 250));
  $('#fCategory').addEventListener('change', (e) => { orgFilterState.category = e.target.value; renderOrganisations(); });
  $('#fPriority').addEventListener('change', (e) => { orgFilterState.priority = e.target.value; renderOrganisations(); });
  $('#fStatus').addEventListener('change', (e) => { orgFilterState.status = e.target.value; renderOrganisations(); });
  $('#fCountry').addEventListener('change', (e) => { orgFilterState.country = e.target.value; renderOrganisations(); });

  $$('.org-table tr[data-id]').forEach(tr => {
    tr.addEventListener('click', () => openDetail(parseInt(tr.dataset.id)));
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ============================================================
// ORG DETAIL PANEL
// ============================================================
async function openDetail(id) {
  const [org, logs] = await Promise.all([
    api.get(`/api/organisations/${id}`),
    api.get(`/api/log?org_id=${id}`)
  ]);
  currentOrg = org;
  const panel = $('#detailPanel');
  panel.innerHTML = renderDetailPanel(org, logs);
  $('#detailOverlay').classList.add('open');
  panel.classList.add('open');
  wireDetailPanel();
}

function renderDetailPanel(o, logs) {
  const catOpts = FACETS.categories.map(c => `<option ${c === o.category ? 'selected' : ''}>${esc(c)}</option>`).join('');
  const cntOpts = FACETS.countries.map(c => `<option ${c === o.country ? 'selected' : ''}>${esc(c)}</option>`).join('');
  return `
    <button class="detail-panel-close" onclick="closeDetail()">×</button>
    <div class="eyebrow">${esc(o.category || 'Uncategorised')}</div>
    <h2 style="margin: 6px 0 2px">${esc(o.name)}</h2>
    <div class="subtitle" style="color: var(--ink-soft); margin-bottom: 16px;">
      ${esc([o.city, o.country].filter(Boolean).join(' · '))}
      ${o.website ? ` · <a href="${esc(o.website)}" target="_blank" rel="noreferrer">Website</a>` : ''}
    </div>

    <form id="orgForm">
      <div class="field-row">
        <div class="field">
          <label>Priority</label>
          <select name="priority">
            <option value="">—</option>
            <option ${o.priority === 'Tier 1' ? 'selected' : ''}>Tier 1</option>
            <option ${o.priority === 'Tier 2' ? 'selected' : ''}>Tier 2</option>
            <option ${o.priority === 'Tier 3' ? 'selected' : ''}>Tier 3</option>
          </select>
        </div>
        <div class="field">
          <label>Status</label>
          <select name="status">
            <option value="">—</option>
            ${FACETS.statuses.map(s => `<option ${s === o.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Category</label>
          <select name="category">
            <option value="">—</option>
            ${catOpts}
            ${o.category && !FACETS.categories.includes(o.category) ? `<option selected>${esc(o.category)}</option>` : ''}
          </select>
        </div>
        <div class="field">
          <label>Country / region</label>
          <input type="text" name="country" value="${esc(o.country || '')}" list="countryList">
          <datalist id="countryList">${cntOpts}</datalist>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>City</label>
          <input type="text" name="city" value="${esc(o.city || '')}">
        </div>
        <div class="field">
          <label>Website</label>
          <input type="url" name="website" value="${esc(o.website || '')}">
        </div>
      </div>

      <div class="field">
        <label>Why relevant for LWP</label>
        <textarea name="why_relevant" rows="2">${esc(o.why_relevant || '')}</textarea>
      </div>

      <h3 style="margin-top:16px">Contact</h3>
      <div class="field-row">
        <div class="field">
          <label>Contact name</label>
          <input type="text" name="contact_name" value="${esc(o.contact_name || '')}">
        </div>
        <div class="field">
          <label>Role</label>
          <input type="text" name="contact_role" value="${esc(o.contact_role || '')}">
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Email</label>
          <input type="email" name="email" value="${esc(o.email || '')}">
        </div>
        <div class="field">
          <label>Phone</label>
          <input type="text" name="phone" value="${esc(o.phone || '')}">
        </div>
      </div>

      <h3 style="margin-top:16px">Pipeline</h3>
      <div class="field">
        <label>Source / intro path</label>
        <input type="text" name="source_intro_path" value="${esc(o.source_intro_path || '')}">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Next action</label>
          <input type="text" name="next_action" value="${esc(o.next_action || '')}">
        </div>
        <div class="field">
          <label>Next action date</label>
          <input type="date" name="next_action_date" value="${esc(o.next_action_date || '')}">
        </div>
      </div>
      <div class="field">
        <label>Last contact</label>
        <input type="date" name="last_contact" value="${esc(o.last_contact || '')}">
      </div>
      <div class="field">
        <label>Notes</label>
        <textarea name="notes" rows="3">${esc(o.notes || '')}</textarea>
      </div>

      <div class="actions-bar">
        <button type="button" class="btn danger" onclick="deleteOrg()">Delete</button>
        <div class="grow"></div>
        <button type="button" class="btn clay" onclick="openEmailDrafter(${o.id})">Draft email</button>
        <button type="submit" class="btn primary">Save</button>
      </div>
    </form>

    <h3 style="margin-top:24px">Outreach log</h3>
    <div class="hint">Every interaction with this organisation.</div>

    <form id="logAddForm" style="margin-top:12px; padding:14px; background: var(--paper-2); border-radius: var(--radius-sm);">
      <div class="field-row">
        <div class="field">
          <label>Channel</label>
          <select name="channel">
            <option value="">—</option>
            <option>Email</option><option>LinkedIn</option><option>Phone</option>
            <option>Meeting</option><option>Event</option><option>Other</option>
          </select>
        </div>
        <div class="field">
          <label>Type</label>
          <select name="entry_type">
            <option value="">—</option>
            <option>Outbound</option><option>Inbound</option><option>Follow-up</option>
            <option>Intro</option><option>Materials</option><option>Proposal</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>Summary</label>
        <input type="text" name="summary" required placeholder="Short note about this interaction">
      </div>
      <button type="submit" class="btn primary small">Add log entry</button>
    </form>

    <div class="log-list">
      ${logs.length === 0 ? '<div class="empty">No log entries yet.</div>' :
        logs.map(l => `
          <div class="log-entry">
            <div class="meta">
              ${fmtDate(l.entry_date)}${l.channel ? ' · ' + esc(l.channel) : ''}${l.entry_type ? ' · ' + esc(l.entry_type) : ''}
              <span class="del"><a href="#" onclick="deleteLog(${l.id}, ${o.id}); return false;">delete</a></span>
            </div>
            ${esc(l.summary)}
          </div>
        `).join('')
      }
    </div>
  `;
}

function wireDetailPanel() {
  const form = $('#orgForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {};
    fd.forEach((v, k) => { body[k] = v; });
    try {
      await api.put(`/api/organisations/${currentOrg.id}`, body);
      toast('Saved');
      await loadBootstrap(); // facets may have changed
      // re-open with fresh data
      openDetail(currentOrg.id);
      // if we're on the organisations view, refresh
      if (currentRoute() === 'organisations') renderOrganisations();
      if (currentRoute() === 'dashboard') renderDashboard();
    } catch (e) { toast('Error: ' + e.message); }
  });

  const logForm = $('#logAddForm');
  logForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(logForm);
    const body = { organisation_id: currentOrg.id };
    fd.forEach((v, k) => { body[k] = v; });
    if (!body.summary) return;
    try {
      await api.post('/api/log', body);
      toast('Logged');
      openDetail(currentOrg.id);
    } catch (e) { toast('Error: ' + e.message); }
  });
}

async function deleteOrg() {
  if (!currentOrg) return;
  if (!confirm(`Delete ${currentOrg.name}? This cannot be undone.`)) return;
  try {
    await api.del(`/api/organisations/${currentOrg.id}`);
    toast('Deleted');
    closeDetail();
    await loadBootstrap();
    router();
  } catch (e) { toast('Error: ' + e.message); }
}

async function deleteLog(logId, orgId) {
  if (!confirm('Delete this log entry?')) return;
  try {
    await api.del(`/api/log/${logId}`);
    toast('Deleted');
    openDetail(orgId);
  } catch (e) { toast('Error: ' + e.message); }
}

// ============================================================
// ADD NEW ORGANISATION
// ============================================================
function openAddOrg(prefill = {}) {
  const catOpts = FACETS.categories.map(c => `<option ${c === prefill.category ? 'selected' : ''}>${esc(c)}</option>`).join('');
  openModal(`
    <h2>New organisation</h2>
    <div class="subtitle">Fill in what you know. You can add more later.</div>
    <form id="addOrgForm">
      <div class="field">
        <label>Name *</label>
        <input type="text" name="name" required value="${esc(prefill.name || '')}">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Category</label>
          <select name="category">
            <option value="">—</option>
            ${catOpts}
            <option value="__new__">+ New category...</option>
          </select>
        </div>
        <div class="field">
          <label>Priority</label>
          <select name="priority">
            <option value="">—</option>
            <option>Tier 1</option><option>Tier 2</option><option>Tier 3</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Country / region</label>
          <input type="text" name="country" value="${esc(prefill.country || '')}">
        </div>
        <div class="field">
          <label>City</label>
          <input type="text" name="city" value="${esc(prefill.city || '')}">
        </div>
      </div>
      <div class="field">
        <label>Website</label>
        <input type="url" name="website" value="${esc(prefill.website || '')}">
      </div>
      <div class="field">
        <label>Why relevant for LWP</label>
        <textarea name="why_relevant" rows="2">${esc(prefill.why_relevant || '')}</textarea>
      </div>
      <div class="actions-bar">
        <button type="button" class="btn ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn primary">Add</button>
      </div>
    </form>
  `, (root) => {
    root.querySelector('select[name="category"]').addEventListener('change', (e) => {
      if (e.target.value === '__new__') {
        const val = prompt('New category name:');
        if (val) {
          const opt = document.createElement('option');
          opt.value = val; opt.textContent = val; opt.selected = true;
          e.target.insertBefore(opt, e.target.querySelector('option[value="__new__"]'));
          e.target.value = val;
        } else {
          e.target.value = '';
        }
      }
    });
    root.querySelector('#addOrgForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {};
      fd.forEach((v, k) => { body[k] = v; });
      try {
        const created = await api.post('/api/organisations', body);
        toast('Added');
        closeModal();
        await loadBootstrap();
        openDetail(created.id);
        if (currentRoute() === 'organisations') renderOrganisations();
      } catch (e) { toast('Error: ' + e.message); }
    });
  });
}

// ============================================================
// EMAIL DRAFTER
// ============================================================
let draftLanguage = 'en';

async function openEmailDrafter(orgId) {
  const [org, templates] = await Promise.all([
    api.get(`/api/organisations/${orgId}`),
    api.get(`/api/templates?lang=${draftLanguage}`)
  ]);
  showEmailDrafter(org, templates);
}

function showEmailDrafter(org, templates) {
  const purposeOpts = templates.map(t => `<option value="${t.id}">${esc(t.purpose_label)}</option>`).join('');
  openModal(`
    <div style="display:flex; align-items:center; justify-content:space-between;">
      <div>
        <div class="eyebrow">Email drafter</div>
        <h2>${esc(org.name)}</h2>
      </div>
      <div class="pt-en-toggle">
        <button class="${draftLanguage === 'en' ? 'active' : ''}" onclick="setDraftLang('en', ${org.id})">EN</button>
        <button class="${draftLanguage === 'pt' ? 'active' : ''}" onclick="setDraftLang('pt', ${org.id})">PT</button>
      </div>
    </div>
    <div class="subtitle">
      To: ${esc(org.contact_name || '(no contact)')}${org.email ? ` &lt;${esc(org.email)}&gt;` : ''}
    </div>

    <div class="field-row" style="margin-top:16px">
      <div class="field">
        <label>Purpose</label>
        <select id="purposeSel">${purposeOpts}</select>
      </div>
      <div class="field" id="introSrcField" style="display:none">
        <label>Who suggested the intro?</label>
        <input type="text" id="introSrc">
      </div>
    </div>
    <div class="field" id="referralField" style="display:none">
      <label>Type of client you're asking about</label>
      <input type="text" id="referralType" placeholder="e.g. foreign tech companies looking at Portugal">
    </div>
    <div class="field-row" id="thankYouFields" style="display:none">
      <div class="field">
        <label>Meeting recap (one line)</label>
        <input type="text" id="meetingRecap">
      </div>
      <div class="field">
        <label>Next step</label>
        <input type="text" id="nextStep">
      </div>
    </div>

    <div class="field">
      <label>Subject</label>
      <input type="text" id="draftSubject">
    </div>
    <div class="field">
      <label>Body</label>
      <textarea id="draftBody" rows="14"></textarea>
    </div>

    <div class="actions-bar">
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <div class="grow"></div>
      <button class="btn night" onclick="copyDraft()">Copy</button>
      <a class="btn primary" id="mailtoBtn" href="#" onclick="return sendDraft(${org.id})">Open in email client</a>
    </div>
  `, (root) => {
    const state = { templates, org };
    const rebuildDraft = () => {
      const purposeId = parseInt($('#purposeSel').value);
      const tpl = templates.find(t => t.id === purposeId);
      $('#introSrcField').style.display = tpl.purpose === 'first_warm' ? '' : 'none';
      $('#referralField').style.display = tpl.purpose === 'referral_request' ? '' : 'none';
      $('#thankYouFields').style.display = tpl.purpose === 'thank_you' ? '' : 'none';

      const vars = {
        contact_name: org.contact_name || (draftLanguage === 'pt' ? 'colega' : 'there'),
        org_name: org.name,
        category: org.category || '',
        why_relevant: org.why_relevant || (draftLanguage === 'pt' ? '' : ''),
        sender_name: SETTINGS.sender_name || 'Lara',
        sender_role: SETTINGS.sender_role || 'Head of Business Development',
        sender_email: SETTINGS.sender_email || 'info@leadingwithppl.com',
        intro_source: $('#introSrc') ? $('#introSrc').value : '',
        referral_type: $('#referralType') ? $('#referralType').value : '',
        meeting_recap: $('#meetingRecap') ? $('#meetingRecap').value : '',
        next_step: $('#nextStep') ? $('#nextStep').value : '',
      };
      const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || '');
      $('#draftSubject').value = fill(tpl.subject);
      $('#draftBody').value = fill(tpl.body);
    };
    $('#purposeSel').addEventListener('change', rebuildDraft);
    ['introSrc', 'referralType', 'meetingRecap', 'nextStep'].forEach(id => {
      const el = $('#' + id);
      if (el) el.addEventListener('input', rebuildDraft);
    });
    rebuildDraft();
  });
}

function setDraftLang(lang, orgId) {
  draftLanguage = lang;
  closeModal();
  openEmailDrafter(orgId);
}

async function copyDraft() {
  const subject = $('#draftSubject').value;
  const body = $('#draftBody').value;
  const text = `Subject: ${subject}\n\n${body}`;
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  } catch (e) {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Copied');
  }
}

async function sendDraft(orgId) {
  const org = currentOrg && currentOrg.id === orgId ? currentOrg : await api.get(`/api/organisations/${orgId}`);
  const subject = $('#draftSubject').value;
  const body = $('#draftBody').value;
  const url = `mailto:${encodeURIComponent(org.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  // auto-log
  try {
    await api.post('/api/log', {
      organisation_id: orgId,
      channel: 'Email',
      entry_type: 'Outbound',
      summary: `Draft sent: ${subject}`
    });
  } catch (e) { /* non-fatal */ }
  window.location.href = url;
  setTimeout(closeModal, 200);
  return false;
}

// ============================================================
// BULK EMAIL PREP
// ============================================================
let bulkSelection = new Set();
let bulkFilterState = { search: '', category: '', priority: '', status: '' };

async function renderBulk() {
  const f = bulkFilterState;
  const params = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
  const orgs = await api.get('/api/organisations?' + params.toString());

  view().innerHTML = `
    <div class="view-header">
      <div class="eyebrow">Bulk email</div>
      <h1>Pick a batch, <span class="italic-clay">generate drafts</span>.</h1>
      <div class="subtitle">Select multiple organisations, pick a single purpose and language, then step through each draft.</div>
    </div>

    <div class="filters">
      <input type="search" id="bfSearch" placeholder="Search..." value="${esc(f.search)}">
      <select id="bfCategory"><option value="">Any category</option>${FACETS.categories.map(c => `<option ${c === f.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <select id="bfPriority"><option value="">Any priority</option>
        <option ${f.priority === 'Tier 1' ? 'selected' : ''}>Tier 1</option>
        <option ${f.priority === 'Tier 2' ? 'selected' : ''}>Tier 2</option>
        <option ${f.priority === 'Tier 3' ? 'selected' : ''}>Tier 3</option>
      </select>
      <select id="bfStatus"><option value="">Any status</option>
        ${FACETS.statuses.map(s => `<option ${s === f.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}
      </select>
      <div class="spacer"></div>
      <span class="count"><span id="bulkCount">${bulkSelection.size}</span> selected</span>
      <button class="btn ghost small" onclick="bulkSelectAll()">Select all visible</button>
      <button class="btn ghost small" onclick="bulkClear()">Clear</button>
      <button class="btn clay" id="bulkStartBtn" onclick="startBulkDraft()">Draft selected</button>
    </div>

    ${orgs.length === 0 ? '<div class="card"><div class="empty">No organisations match.</div></div>' : `
      <table class="org-table">
        <thead>
          <tr>
            <th style="width:32px"></th>
            <th>Organisation</th>
            <th>Category</th>
            <th>Email</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${orgs.map(o => `
            <tr>
              <td><input type="checkbox" data-id="${o.id}" ${bulkSelection.has(o.id) ? 'checked' : ''} ${!o.email ? 'disabled' : ''}></td>
              <td><div class="name">${esc(o.name)}</div>${o.contact_name ? `<div class="sub">${esc(o.contact_name)}</div>` : ''}</td>
              <td>${esc(o.category || '')}</td>
              <td>${o.email ? esc(o.email) : '<span class="sub">no email</span>'}</td>
              <td>${o.status ? `<span class="${tagClass('status', o.status)}">${esc(o.status)}</span>` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `}
  `;

  $('#bfSearch').addEventListener('input', debounce((e) => { bulkFilterState.search = e.target.value; renderBulk(); }, 250));
  $('#bfCategory').addEventListener('change', (e) => { bulkFilterState.category = e.target.value; renderBulk(); });
  $('#bfPriority').addEventListener('change', (e) => { bulkFilterState.priority = e.target.value; renderBulk(); });
  $('#bfStatus').addEventListener('change', (e) => { bulkFilterState.status = e.target.value; renderBulk(); });
  $$('input[type="checkbox"][data-id]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = parseInt(cb.dataset.id);
      if (cb.checked) bulkSelection.add(id); else bulkSelection.delete(id);
      $('#bulkCount').textContent = bulkSelection.size;
    });
  });
}

function bulkSelectAll() {
  $$('input[type="checkbox"][data-id]:not(:disabled)').forEach(cb => {
    cb.checked = true;
    bulkSelection.add(parseInt(cb.dataset.id));
  });
  $('#bulkCount').textContent = bulkSelection.size;
}
function bulkClear() {
  bulkSelection.clear();
  $$('input[type="checkbox"][data-id]').forEach(cb => cb.checked = false);
  $('#bulkCount').textContent = 0;
}

async function startBulkDraft() {
  if (bulkSelection.size === 0) { toast('Nothing selected'); return; }
  const templates = await api.get(`/api/templates?lang=${draftLanguage}`);
  const purposeOpts = templates.map(t => `<option value="${t.id}">${esc(t.purpose_label)}</option>`).join('');
  openModal(`
    <div class="eyebrow">Bulk draft</div>
    <h2>Draft ${bulkSelection.size} emails</h2>
    <div class="subtitle">Same purpose, same language for all. You will step through each draft, copy and send individually.</div>

    <div class="field-row">
      <div class="field">
        <label>Purpose</label>
        <select id="bulkPurpose">${purposeOpts}</select>
      </div>
      <div class="field">
        <label>Language</label>
        <select id="bulkLang">
          <option value="en" ${draftLanguage === 'en' ? 'selected' : ''}>English</option>
          <option value="pt" ${draftLanguage === 'pt' ? 'selected' : ''}>Português</option>
        </select>
      </div>
    </div>
    <div class="actions-bar">
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn primary" onclick="runBulkDraft()">Start</button>
    </div>
  `);
}

async function runBulkDraft() {
  const purposeId = parseInt($('#bulkPurpose').value);
  const lang = $('#bulkLang').value;
  draftLanguage = lang;
  const ids = Array.from(bulkSelection);
  closeModal();

  // step through
  await stepBulkDraft(ids, 0, purposeId, lang);
}

async function stepBulkDraft(ids, index, purposeId, lang) {
  if (index >= ids.length) {
    toast(`Done. ${ids.length} drafts.`);
    bulkClear();
    renderBulk();
    return;
  }
  const [org, templates] = await Promise.all([
    api.get(`/api/organisations/${ids[index]}`),
    api.get(`/api/templates?lang=${lang}`)
  ]);
  const tpl = templates.find(t => t.id === purposeId);
  const vars = {
    contact_name: org.contact_name || (lang === 'pt' ? 'colega' : 'there'),
    org_name: org.name,
    category: org.category || '',
    why_relevant: org.why_relevant || '',
    sender_name: SETTINGS.sender_name,
    sender_role: SETTINGS.sender_role,
    sender_email: SETTINGS.sender_email,
    intro_source: '',
    referral_type: '',
    meeting_recap: '',
    next_step: '',
  };
  const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || '');
  const subject = fill(tpl.subject);
  const body = fill(tpl.body);

  openModal(`
    <div style="display:flex; align-items:center; justify-content:space-between;">
      <div>
        <div class="eyebrow">Bulk draft · ${index + 1} of ${ids.length}</div>
        <h2>${esc(org.name)}</h2>
      </div>
    </div>
    <div class="subtitle">To: ${esc(org.contact_name || '')} &lt;${esc(org.email || '')}&gt;</div>

    <div class="field">
      <label>Subject</label>
      <input type="text" id="draftSubject" value="${esc(subject)}">
    </div>
    <div class="field">
      <label>Body</label>
      <textarea id="draftBody" rows="12">${esc(body)}</textarea>
    </div>

    <div class="actions-bar">
      <button class="btn ghost" onclick="closeModal()">Stop</button>
      <div class="grow"></div>
      <button class="btn night" onclick="copyDraft()">Copy</button>
      <button class="btn ghost" onclick="stepBulkDraft(${JSON.stringify(ids)}, ${index + 1}, ${purposeId}, '${lang}')">Skip</button>
      <button class="btn primary" onclick='bulkSendAndNext(${JSON.stringify(ids)}, ${index}, ${purposeId}, "${lang}", ${org.id}, "${encodeURIComponent(org.email || '')}")'>Open &amp; next</button>
    </div>
  `);
}

async function bulkSendAndNext(ids, index, purposeId, lang, orgId, emailEnc) {
  const subject = $('#draftSubject').value;
  const body = $('#draftBody').value;
  try {
    await api.post('/api/log', {
      organisation_id: orgId, channel: 'Email', entry_type: 'Outbound',
      summary: `Bulk draft sent: ${subject}`
    });
  } catch (e) { /* non-fatal */ }
  const email = decodeURIComponent(emailEnc);
  window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  setTimeout(() => stepBulkDraft(ids, index + 1, purposeId, lang), 300);
}

// ============================================================
// SEARCH (find new institutions)
// ============================================================
async function renderSearch() {
  view().innerHTML = `
    <div class="view-header">
      <div class="eyebrow">Find new</div>
      <h1>Look for <span class="italic-cobalt">institutions and partners</span> to add.</h1>
      <div class="subtitle">Uses free Wikipedia and DuckDuckGo. Type an organisation name, sector, or a phrase like "German chamber Portugal".</div>
    </div>
    <div class="search-bar">
      <input type="search" id="searchQ" placeholder="e.g. Câmara de Comércio Angola Portugal" autofocus>
      <button class="btn primary" onclick="runSearch()">Search</button>
    </div>
    <div id="searchResults"></div>
  `;
  $('#searchQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
}
async function runSearch() {
  const q = $('#searchQ').value.trim();
  if (!q) return;
  const wrap = $('#searchResults');
  wrap.innerHTML = '<div class="empty">Searching...</div>';
  try {
    const { results } = await api.get('/api/search?q=' + encodeURIComponent(q));
    if (!results.length) {
      wrap.innerHTML = '<div class="card"><div class="empty">No matches. Try a broader search or add manually via + New on the Organisations page.</div></div>';
      return;
    }
    wrap.innerHTML = results.map(r => `
      <div class="search-result">
        <div class="source-tag">${esc(r.source)}</div>
        <h3>${esc(r.title)}</h3>
        <p>${esc(r.description || '')}</p>
        <div class="actions">
          ${r.url ? `<a class="btn small ghost" href="${esc(r.url)}" target="_blank" rel="noreferrer">Open source</a>` : ''}
          <button class="btn small clay" onclick='addFromSearch(${JSON.stringify(r.title)}, ${JSON.stringify(r.url || "")}, ${JSON.stringify(r.description || "")})'>Add to CRM</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    wrap.innerHTML = `<div class="banner">Search failed: ${esc(e.message)}</div>`;
  }
}
function addFromSearch(name, website, why) {
  openAddOrg({ name, website, why_relevant: why });
}

// ============================================================
// LOG
// ============================================================
async function renderLog() {
  const logs = await api.get('/api/log');
  view().innerHTML = `
    <div class="view-header">
      <div class="eyebrow">Outreach log</div>
      <h1>Everything <span class="italic-clay">you've done</span>, in one feed.</h1>
      <div class="subtitle">Chronological across all organisations. Last 200 entries.</div>
    </div>

    <div class="card">
      ${logs.length === 0 ? '<div class="empty">No entries yet. Log an interaction by opening any organisation.</div>' : `
        <table class="org-table" style="box-shadow:none">
          <thead>
            <tr><th>Date</th><th>Organisation</th><th>Channel</th><th>Type</th><th>Summary</th></tr>
          </thead>
          <tbody>
            ${logs.map(l => `
              <tr class="clickable" onclick="openDetail(${l.organisation_id})">
                <td>${fmtDate(l.entry_date)}</td>
                <td><div class="name">${esc(l.org_name)}</div></td>
                <td>${esc(l.channel || '')}</td>
                <td>${esc(l.entry_type || '')}</td>
                <td>${esc(l.summary)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

// ============================================================
// BACKUP
// ============================================================
async function renderBackup() {
  const lastBackup = SETTINGS.last_backup_at;
  const days = lastBackup ? daysSince(lastBackup) : null;
  view().innerHTML = `
    <div class="view-header">
      <div class="eyebrow">Backup</div>
      <h1>Keep a copy <span class="italic-clay">on your own machine</span>.</h1>
      <div class="subtitle">Your data lives in Supabase. A downloaded backup adds a second layer of safety.</div>
    </div>

    ${lastBackup ? `
      <div class="banner ${days >= 7 ? '' : 'info'}">
        <div class="grow">Last backup: ${fmtDate(lastBackup)}${days !== null ? ' (' + (days === 0 ? 'today' : days + ' days ago') + ')' : ''}.</div>
      </div>
    ` : `
      <div class="banner">
        <div class="grow">No backup on record. Download one now.</div>
      </div>
    `}

    <div class="two-col">
      <div class="card">
        <h3>Excel export</h3>
        <p style="color:var(--ink-soft)">A spreadsheet you can open in Excel, Numbers or Sheets. One sheet per category, plus an outreach log sheet.</p>
        <a class="btn primary" href="/api/backup/xlsx" download>Download Excel</a>
      </div>
      <div class="card">
        <h3>JSON backup</h3>
        <p style="color:var(--ink-soft)">Complete backup including templates and settings. Use this to restore or move to another database.</p>
        <a class="btn primary" href="/api/backup/json" download>Download JSON</a>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <h3>Import your Excel CRM</h3>
      <p style="color:var(--ink-soft)">
        First-time setup: upload the <code>LWP_Outreach_CRM.xlsx</code> file to load the 57 organisations we already mapped.
        Existing organisations with the same name will be skipped, not overwritten.
      </p>
      <form id="importForm" enctype="multipart/form-data">
        <input type="file" name="file" accept=".xlsx" required style="margin-bottom:10px">
        <br>
        <button class="btn primary" type="submit">Import</button>
      </form>
      <div id="importResult" style="margin-top:10px"></div>
    </div>

    <div class="card" style="margin-top:20px">
      <h3>Restore from JSON</h3>
      <p style="color:var(--ink-soft)">
        <strong>Warning:</strong> This replaces all current organisations and log entries with what's in the JSON file.
        Download a fresh JSON backup first if in doubt.
      </p>
      <form id="restoreForm">
        <input type="file" id="restoreFile" accept=".json" required style="margin-bottom:10px">
        <br>
        <button class="btn danger" type="submit">Restore</button>
      </form>
    </div>
  `;

  $('#importForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const result = await api.upload('/api/import/xlsx', fd);
      $('#importResult').innerHTML = `<div class="banner info">Imported ${result.inserted} organisations. Skipped ${result.skipped} duplicates and ${result.placeholders_skipped} placeholder rows.</div>`;
      await loadBootstrap();
    } catch (err) {
      $('#importResult').innerHTML = `<div class="banner">Error: ${esc(err.message)}</div>`;
    }
  });
  $('#restoreForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = $('#restoreFile').files[0];
    if (!file) return;
    if (!confirm('This replaces all current data. Continue?')) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      const result = await api.post('/api/backup/json/restore', data);
      toast(`Restored ${result.restored} organisations`);
      await loadBootstrap();
      router();
    } catch (err) {
      toast('Error: ' + err.message);
    }
  });
}

// ============================================================
// BOOT
// ============================================================
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadBootstrap();
    router();
  } catch (e) {
    console.error(e);
    view().innerHTML = `<div class="banner">Startup failed: ${esc(e.message)}</div>`;
  }
});

// Expose helpers used in inline onclick handlers
window.openDetail = openDetail;
window.closeDetail = closeDetail;
window.openEmailDrafter = openEmailDrafter;
window.openAddOrg = openAddOrg;
window.setDraftLang = setDraftLang;
window.copyDraft = copyDraft;
window.sendDraft = sendDraft;
window.deleteOrg = deleteOrg;
window.deleteLog = deleteLog;
window.addFromSearch = addFromSearch;
window.bulkSelectAll = bulkSelectAll;
window.bulkClear = bulkClear;
window.startBulkDraft = startBulkDraft;
window.runBulkDraft = runBulkDraft;
window.stepBulkDraft = stepBulkDraft;
window.bulkSendAndNext = bulkSendAndNext;
window.navTo = navTo;
window.runSearch = runSearch;
window.closeModal = closeModal;
