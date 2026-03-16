// ── Index page: list, create, import ground models ──────────────────

async function loadModels() {
    const res = await fetch('/api/models');
    const models = await res.json();
    const container = document.getElementById('model-list');

    if (models.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No ground models yet. Create one to get started.</p>
                <button class="btn btn-primary" onclick="showCreateModal()">+ New Model</button>
            </div>`;
        return;
    }

    container.innerHTML = '<ul class="model-list">' + models.map(m => {
        const date = new Date(m.updated_at).toLocaleDateString();
        const strataCount = m.strata ? m.strata.length : 0;
        return `
            <li class="model-item">
                <div>
                    <a href="/model/${m.id}">${esc(m.name)}</a>
                    <div class="model-meta">
                        ${m.project ? esc(m.project) + ' &middot; ' : ''}
                        ${strataCount} strata &middot; Updated ${date}
                    </div>
                </div>
                <div class="btn-group">
                    <button class="btn btn-sm btn-danger" onclick="deleteModel(${m.id}, '${esc(m.name)}')">Delete</button>
                </div>
            </li>`;
    }).join('') + '</ul>';
}

function showCreateModal() {
    document.getElementById('create-modal').classList.add('active');
    document.getElementById('new-name').focus();
}

function showImportModal() {
    document.getElementById('import-modal').classList.add('active');
}

function hideModal(id) {
    document.getElementById(id).classList.remove('active');
}

async function createModel() {
    const name = document.getElementById('new-name').value.trim();
    if (!name) { alert('Name is required'); return; }

    const body = {
        name,
        project: document.getElementById('new-project').value.trim(),
        location: document.getElementById('new-location').value.trim(),
        created_by: document.getElementById('new-created-by').value.trim(),
        notes: document.getElementById('new-notes').value.trim(),
    };

    const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const model = await res.json();
    window.location.href = `/model/${model.id}`;
}

async function deleteModel(id, name) {
    if (!confirm(`Delete ground model "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/models/${id}`, { method: 'DELETE' });
    loadModels();
}

// ── Import via file drop ────────────────────────────────────────────

const fileDrop = document.getElementById('file-drop');
const fileInput = document.getElementById('file-input');

fileDrop.addEventListener('dragover', e => { e.preventDefault(); fileDrop.classList.add('dragover'); });
fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
fileDrop.addEventListener('drop', e => {
    e.preventDefault();
    fileDrop.classList.remove('dragover');
    if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
    if (fileInput.files.length) uploadFile(fileInput.files[0]);
});

async function uploadFile(file) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/models/import', { method: 'POST', body: form });
    if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Import failed');
        return;
    }
    const model = await res.json();
    window.location.href = `/model/${model.id}`;
}

// ── Utils ───────────────────────────────────────────────────────────

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('active'); });
});

// Enter key in create modal
document.getElementById('new-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') createModel();
});

// ── Init ────────────────────────────────────────────────────────────
loadModels();
