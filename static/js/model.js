// ── Model detail page: view, edit DGM strata, export ────────────────

let currentModel = null;

const STRATUM_FIELDS = [
    { key: 'stratum_name',       label: 'Stratum',    width: '140px' },
    { key: 'num_points',         label: 'Points',     width: '60px' },
    { key: 'top_level_min',      label: 'Min.',       width: '70px' },
    { key: 'top_level_max',      label: 'Max.',       width: '70px' },
    { key: 'bottom_level_min',   label: 'Min.',       width: '70px' },
    { key: 'bottom_level_max',   label: 'Max.',       width: '70px' },
    { key: 'top_level_design',   label: 'Design',     width: '100px' },
    { key: 'bottom_level_design', label: 'Design',    width: '100px' },
    { key: 'thickness_design',   label: 'Design',     width: '80px' },
];

// ── Load model ──────────────────────────────────────────────────────

async function loadModel() {
    const url = IS_SHARED
        ? `/api/shared/${SHARE_ID}`
        : `/api/models/${MODEL_ID}`;

    const res = await fetch(url);
    if (!res.ok) {
        document.getElementById('model-title').textContent = 'Model not found';
        return;
    }
    currentModel = await res.json();
    renderModel();
}

function renderModel() {
    const m = currentModel;
    const label = m.title ? `${m.name} \u2013 ${m.title}` : m.name;
    document.title = `${label} \u2014 DGM`;
    document.getElementById('model-title').textContent = label;

    // Info fields
    const info = document.getElementById('model-info');
    info.innerHTML = [
        infoField('Project', m.project),
        infoField('Location', m.location),
        infoField('Created by', m.created_by),
        infoField('Notes', m.notes),
    ].filter(Boolean).join('');

    // Nav actions
    const nav = document.getElementById('nav-actions');
    if (!IS_SHARED) {
        nav.innerHTML = `
            <button class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,.3)" onclick="toggleShare()">Share</button>
            <div class="btn-group">
                <button class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,.3)" onclick="exportModel('json')">JSON</button>
                <button class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,.3)" onclick="exportModel('csv')">CSV</button>
                <button class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,.3)" onclick="exportModel('pdf')">PDF</button>
                <button class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,.3)" onclick="exportModel('docx')">Word</button>
            </div>`;
    }

    // Model actions
    const actions = document.getElementById('model-actions');
    if (!IS_SHARED) {
        actions.innerHTML = `<button class="btn btn-sm btn-outline" onclick="editModelInfo()">Edit Info</button>`;
    }

    // Strata actions
    const strataActions = document.getElementById('strata-actions');
    if (!IS_SHARED) {
        strataActions.innerHTML = `<button class="btn btn-sm btn-primary" onclick="addStratum()">+ Add Stratum</button>`;
        document.getElementById('actions-col').style.display = '';
    }

    // Shared banner
    if (IS_SHARED) {
        document.getElementById('share-banner').style.display = '';
    }

    // Share card
    if (!IS_SHARED) {
        document.getElementById('share-url').value = `${window.location.origin}/shared/${m.share_id}`;
    }

    renderStrata();
    renderNotes();
    renderRationale();
}

function infoField(label, value) {
    if (!value) return '';
    return `<div class="form-group"><label>${label}</label><span>${esc(value)}</span></div>`;
}

// ── Render strata table ─────────────────────────────────────────────

function renderStrata() {
    const tbody = document.getElementById('strata-body');
    const empty = document.getElementById('empty-strata');
    const strata = currentModel.strata || [];

    if (strata.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = '';
        return;
    }
    empty.style.display = 'none';

    if (IS_SHARED) {
        tbody.innerHTML = strata.map(s => `<tr>
            ${STRATUM_FIELDS.map((f, i) => {
                const align = i === 0 ? '' : ' style="text-align:center"';
                return `<td${align}>${esc(s[f.key] || '')}</td>`;
            }).join('')}
        </tr>`).join('');
    } else {
        tbody.innerHTML = strata.map(s => `<tr data-id="${s.id}">
            ${STRATUM_FIELDS.map((f, i) => {
                const style = i === 0 ? '' : ' style="text-align:center"';
                return `<td${style}><input type="text" value="${esc(String(s[f.key] || ''))}" data-field="${f.key}" data-id="${s.id}" onchange="updateField(this)" style="width:${f.width}${i > 0 ? ';text-align:center' : ''}"></td>`;
            }).join('')}
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="editStratumNotes(${s.id})">Notes</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteStratum(${s.id})">Del</button>
                </div>
            </td>
        </tr>`).join('');
    }
}

// ── Render notes table ──────────────────────────────────────────────

function renderNotes() {
    const strata = (currentModel.strata || []).filter(s => s.ref_number || s.stratum_notes);
    const card = document.getElementById('notes-card');
    const tbody = document.getElementById('notes-body');

    if (strata.length === 0) {
        card.style.display = 'none';
        return;
    }
    card.style.display = '';
    tbody.innerHTML = strata.map(s => {
        const cleanName = (s.stratum_name || '').split('[')[0].trim();
        return `<tr>
            <td>${esc(s.ref_number)}</td>
            <td><strong>${esc(cleanName)}</strong></td>
            <td style="white-space:pre-wrap">${esc(s.stratum_notes)}</td>
        </tr>`;
    }).join('');
}

// ── Render rationale ────────────────────────────────────────────────

function renderRationale() {
    const card = document.getElementById('rationale-card');
    const text = document.getElementById('rationale-text');
    const btn = document.getElementById('edit-rationale-btn');

    if (!currentModel.rationale && IS_SHARED) {
        card.style.display = 'none';
        return;
    }
    card.style.display = '';
    text.textContent = currentModel.rationale || '(No rationale provided)';
    if (!IS_SHARED) btn.style.display = '';
}

// ── Stratum CRUD ────────────────────────────────────────────────────

async function addStratum() {
    const strata = currentModel.strata || [];
    const nextRef = `[${strata.length + 1}]`;

    const res = await fetch(`/api/models/${MODEL_ID}/strata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            stratum_name: '',
            ref_number: nextRef,
        }),
    });
    if (res.ok) {
        await loadModel();
        const rows = document.querySelectorAll('#strata-body tr');
        const lastRow = rows[rows.length - 1];
        if (lastRow) lastRow.querySelector('input')?.focus();
    }
}

async function updateField(input) {
    const id = input.dataset.id;
    const field = input.dataset.field;
    const value = input.value;

    await fetch(`/api/strata/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
    });
}

async function editStratumNotes(id) {
    const s = currentModel.strata.find(s => s.id === id);
    if (!s) return;

    const refNumber = prompt('Reference number (e.g. [1]):', s.ref_number);
    if (refNumber === null) return;

    const notes = prompt('Stratum notes/rationale:', s.stratum_notes);
    if (notes === null) return;

    await fetch(`/api/strata/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref_number: refNumber, stratum_notes: notes }),
    });
    await loadModel();
}

async function deleteStratum(id) {
    if (!confirm('Delete this stratum?')) return;
    await fetch(`/api/strata/${id}`, { method: 'DELETE' });
    await loadModel();
}

// ── Edit model info ─────────────────────────────────────────────────

async function editModelInfo() {
    const m = currentModel;
    const name = prompt('DGM Reference:', m.name);
    if (name === null) return;
    const title = prompt('Title:', m.title);
    if (title === null) return;
    const project = prompt('Project:', m.project);
    if (project === null) return;
    const location = prompt('Location:', m.location);
    if (location === null) return;
    const created_by = prompt('Created by:', m.created_by);
    if (created_by === null) return;
    const notes = prompt('Notes:', m.notes);
    if (notes === null) return;

    await fetch(`/api/models/${MODEL_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, title, project, location, created_by, notes }),
    });
    await loadModel();
}

async function editRationale() {
    const rationale = prompt('Design Ground Model Rationale:', currentModel.rationale);
    if (rationale === null) return;

    await fetch(`/api/models/${MODEL_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rationale }),
    });
    await loadModel();
}

// ── Share ────────────────────────────────────────────────────────────

function toggleShare() {
    const card = document.getElementById('share-card');
    card.style.display = card.style.display === 'none' ? '' : 'none';
}

function copyShareLink() {
    const input = document.getElementById('share-url');
    input.select();
    navigator.clipboard.writeText(input.value);
    const btn = input.parentElement.querySelector('.btn');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy Link', 2000);
}

// ── Export ───────────────────────────────────────────────────────────

function exportModel(format) {
    window.location.href = `/api/models/${MODEL_ID}/export/${format}`;
}

// ── Utils ───────────────────────────────────────────────────────────

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// ── Init ────────────────────────────────────────────────────────────
loadModel();
