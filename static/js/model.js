// ── Model detail page: view, edit strata, export ────────────────────

let currentModel = null;

const STRATUM_FIELDS = [
    { key: 'loca_id',       label: 'LOCA_ID',       type: 'text' },
    { key: 'geol_top',      label: 'GEOL_TOP',      type: 'number', step: '0.01', cls: 'depth-input' },
    { key: 'geol_base',     label: 'GEOL_BASE',     type: 'number', step: '0.01', cls: 'depth-input' },
    { key: 'geol_desc',     label: 'GEOL_DESC',     type: 'text' },
    { key: 'geol_leg',      label: 'GEOL_LEG',      type: 'text' },
    { key: 'geol_geol',     label: 'GEOL_GEOL',     type: 'text' },
    { key: 'geol_geo2',     label: 'GEOL_GEO2',     type: 'text' },
    { key: 'geol_stat',     label: 'GEOL_STAT',     type: 'text' },
    { key: 'geol_bgs',      label: 'GEOL_BGS',      type: 'text' },
    { key: 'geol_form',     label: 'GEOL_FORM',     type: 'text' },
    { key: 'material_type', label: 'Material Type', type: 'text' },
    { key: 'colour',        label: 'Colour',        type: 'text' },
    { key: 'notes',         label: 'Notes',         type: 'text' },
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
    document.title = `${m.name} — Ground Model`;
    document.getElementById('model-title').textContent = m.name;

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

    // Model actions (edit info)
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
        const shareCard = document.getElementById('share-card');
        const shareUrl = `${window.location.origin}/shared/${m.share_id}`;
        document.getElementById('share-url').value = shareUrl;
    }

    renderStrata();
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

    tbody.innerHTML = strata.map(s => {
        const thickness = (s.geol_base - s.geol_top).toFixed(2);
        if (IS_SHARED) {
            return `<tr>
                <td>${esc(s.loca_id)}</td>
                <td style="text-align:right">${Number(s.geol_top).toFixed(2)}</td>
                <td style="text-align:right">${Number(s.geol_base).toFixed(2)}</td>
                <td style="text-align:right;color:var(--text-muted)">${thickness}</td>
                <td>${esc(s.geol_desc)}</td>
                <td>${esc(s.geol_leg)}</td>
                <td>${esc(s.geol_geol)}</td>
                <td>${esc(s.geol_geo2)}</td>
                <td>${esc(s.geol_stat)}</td>
                <td>${esc(s.geol_bgs)}</td>
                <td>${esc(s.geol_form)}</td>
                <td>${esc(s.material_type)}</td>
                <td>${esc(s.colour)}</td>
                <td>${esc(s.notes)}</td>
            </tr>`;
        }
        return `<tr data-id="${s.id}">
            ${STRATUM_FIELDS.map(f => {
                if (f.key === 'geol_top' || f.key === 'geol_base') {
                    return `<td><input class="${f.cls || ''}" type="${f.type}" step="${f.step || ''}" value="${s[f.key]}" data-field="${f.key}" data-id="${s.id}" onchange="updateField(this)"></td>`;
                }
                return `<td><input type="${f.type}" value="${esc(String(s[f.key] || ''))}" data-field="${f.key}" data-id="${s.id}" onchange="updateField(this)"></td>`;
            }).join('')}
            <td style="text-align:right;color:var(--text-muted)">${thickness}</td>
            <td><button class="btn btn-sm btn-danger" onclick="deleteStratum(${s.id})">Del</button></td>
        </tr>`;
    }).join('');

    // For editable mode, reorder columns: put thickness after geol_base and add actions
    if (!IS_SHARED) {
        // Re-render with inline editing layout
        tbody.innerHTML = strata.map(s => {
            const thickness = (s.geol_base - s.geol_top).toFixed(2);
            return `<tr data-id="${s.id}">
                <td><input type="text" value="${esc(s.loca_id || '')}" data-field="loca_id" data-id="${s.id}" onchange="updateField(this)"></td>
                <td><input class="depth-input" type="number" step="0.01" value="${s.geol_top}" data-field="geol_top" data-id="${s.id}" onchange="updateField(this)"></td>
                <td><input class="depth-input" type="number" step="0.01" value="${s.geol_base}" data-field="geol_base" data-id="${s.id}" onchange="updateField(this)"></td>
                <td><span class="thickness">${thickness}</span></td>
                <td><input type="text" value="${esc(s.geol_desc || '')}" data-field="geol_desc" data-id="${s.id}" onchange="updateField(this)"></td>
                <td><input type="text" value="${esc(s.geol_leg || '')}" data-field="geol_leg" data-id="${s.id}" onchange="updateField(this)" style="width:60px"></td>
                <td><input type="text" value="${esc(s.geol_geol || '')}" data-field="geol_geol" data-id="${s.id}" onchange="updateField(this)" style="width:80px"></td>
                <td><input type="text" value="${esc(s.geol_geo2 || '')}" data-field="geol_geo2" data-id="${s.id}" onchange="updateField(this)" style="width:80px"></td>
                <td><input type="text" value="${esc(s.geol_stat || '')}" data-field="geol_stat" data-id="${s.id}" onchange="updateField(this)" style="width:60px"></td>
                <td><input type="text" value="${esc(s.geol_bgs || '')}" data-field="geol_bgs" data-id="${s.id}" onchange="updateField(this)" style="width:80px"></td>
                <td><input type="text" value="${esc(s.geol_form || '')}" data-field="geol_form" data-id="${s.id}" onchange="updateField(this)"></td>
                <td><input type="text" value="${esc(s.material_type || '')}" data-field="material_type" data-id="${s.id}" onchange="updateField(this)"></td>
                <td><input type="text" value="${esc(s.colour || '')}" data-field="colour" data-id="${s.id}" onchange="updateField(this)" style="width:70px"></td>
                <td><input type="text" value="${esc(s.notes || '')}" data-field="notes" data-id="${s.id}" onchange="updateField(this)"></td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteStratum(${s.id})">Del</button></td>
            </tr>`;
        }).join('');
    }
}

// ── Stratum CRUD ────────────────────────────────────────────────────

async function addStratum() {
    const lastStratum = currentModel.strata[currentModel.strata.length - 1];
    const nextTop = lastStratum ? lastStratum.geol_base : 0;
    const nextBase = nextTop + 1;

    const res = await fetch(`/api/models/${MODEL_ID}/strata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            geol_top: nextTop,
            geol_base: nextBase,
            geol_desc: '',
        }),
    });
    if (res.ok) {
        await loadModel();
        // Focus last row's first input
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

    // Update thickness display if depth changed
    if (field === 'geol_top' || field === 'geol_base') {
        const row = input.closest('tr');
        const topInput = row.querySelector('[data-field="geol_top"]');
        const baseInput = row.querySelector('[data-field="geol_base"]');
        const thicknessSpan = row.querySelector('.thickness');
        if (topInput && baseInput && thicknessSpan) {
            const t = (parseFloat(baseInput.value) - parseFloat(topInput.value)).toFixed(2);
            thicknessSpan.textContent = t;
        }
    }
}

async function deleteStratum(id) {
    if (!confirm('Delete this stratum?')) return;
    await fetch(`/api/strata/${id}`, { method: 'DELETE' });
    await loadModel();
}

// ── Edit model info ─────────────────────────────────────────────────

async function editModelInfo() {
    const m = currentModel;
    const name = prompt('Model name:', m.name);
    if (name === null) return;
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
        body: JSON.stringify({ name, project, location, created_by, notes }),
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
