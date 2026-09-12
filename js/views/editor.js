/* =========================================================
   EDITOR VIEW
========================================================= */
function renderEditor() {
  const s = getSet(currentSetId);
  if (!s) { go('home'); return; }
  if (s.terms.length === 0) s.terms.push({ id: uid(), term: '', definition: '' });

  root.innerHTML = `
    ${topNav()}
    <div class="page">
      <div class="crumb"><a onclick="go('home')">Vocabulary</a> <span>/</span> <a onclick="go('detail')">${escapeHtml(s.title)}</a></div>
      <input class="title-input" id="setTitleInput" value="${escapeAttr(s.title)}" placeholder="Enter a title">

      <button class="toggle-link" onclick="toggleImport()" id="importToggle"><img src="img/import.png" class="theme-icon"> Paste a list to import quickly</button>
      <div id="importBox" class="hidden" style="margin-top:12px;">
        <textarea class="import-box" id="importText" placeholder="accommodation - a place to live or stay
priority	high importance

One term per line, separate term and definition with a dash ( - ) or Tab."></textarea>
        <div style="display:flex; gap:10px; margin-top:10px;">
          <button class="btn-primary" onclick="applyImport()">Import list</button>
          <button class="btn-ghost" onclick="toggleImport()">Cancel</button>
        </div>
      </div>

      <div id="rowsContainer" style="margin-top:24px;">
        ${s.terms.map((t, i) => editorRowHtml(t, i)).join('')}
      </div>
      <button class="add-row-btn" onclick="addRow()">Add a card</button>

      <div class="editor-actions">
        <button class="btn-ghost" onclick="go('detail')">Cancel</button>
        <button class="btn-primary" onclick="saveEditor()">Save set</button>
      </div>
    </div>
  `;
}

function editorRowHtml(t, i) {
  return `
    <div class="editor-row" data-id="${t.id}">
      <div class="num">${i + 1}</div>
      <div class="editor-col">
        <span class="field-label">Term</span>
        <input type="text" class="term-input" value="${escapeAttr(t.term)}" placeholder="e.g. accommodation">
      </div>
      <div class="editor-col">
        <span class="field-label">Definition</span>
        <input type="text" class="def-input" value="${escapeAttr(t.definition)}" placeholder="e.g. a place to live or stay" onfocus="suggestDefinition('${t.id}')">
        <div class="def-suggestion" id="sugg-${t.id}"></div>
      </div>
      <button class="rm" onclick="removeRow('${t.id}')"><img src="img/x.png" class="theme-icon"></button>
    </div>
  `;
}

/* ---------------------------------------------------------
   Definition suggestion: translate the Term (English) into
   Vietnamese via Google Translate's public endpoint, shown as
   a clickable chip under the Definition field. Only triggers
   when the Definition field is focused and still empty, so it
   never overwrites something the user already wrote.
--------------------------------------------------------- */
const _suggestCache = {}; // term (lowercased) -> translated text

async function suggestDefinition(rowId) {
  const row = document.querySelector(`.editor-row[data-id="${rowId}"]`);
  if (!row) return;
  const termInput = row.querySelector('.term-input');
  const defInput = row.querySelector('.def-input');
  const suggBox = document.getElementById(`sugg-${rowId}`);
  if (!termInput || !defInput || !suggBox) return;

  const term = termInput.value.trim();
  if (!term || defInput.value.trim() !== '') {
    suggBox.innerHTML = '';
    return;
  }

  const cacheKey = term.toLowerCase();
  if (_suggestCache[cacheKey]) {
    renderSuggestionChip(suggBox, rowId, _suggestCache[cacheKey]);
    return;
  }

  suggBox.innerHTML = `<span class="sugg-loading">Đang dịch...</span>`;
  try {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=' + encodeURIComponent(term);
    const res = await fetch(url);
    if (!res.ok) throw new Error('translate failed');
    const data = await res.json();
    const translated = (data[0] || []).map(seg => seg[0]).join('').trim();
    if (!translated) { suggBox.innerHTML = ''; return; }
    _suggestCache[cacheKey] = translated;
    // make sure the field wasn't filled in / focus moved on while we waited
    if (document.activeElement === defInput && defInput.value.trim() === '') {
      renderSuggestionChip(suggBox, rowId, translated);
    }
  } catch (e) {
    suggBox.innerHTML = `<span class="sugg-error">Không thể gợi ý nghĩa</span>`;
  }
}

function renderSuggestionChip(suggBox, rowId, text) {
  suggBox.innerHTML = `
    <span class="sugg-chip" onclick="acceptSuggestion('${rowId}')"> ${escapeHtml(text)} <em></em></span>
  `;
  suggBox.dataset.value = text;
}

function acceptSuggestion(rowId) {
  const row = document.querySelector(`.editor-row[data-id="${rowId}"]`);
  const suggBox = document.getElementById(`sugg-${rowId}`);
  if (!row || !suggBox || !suggBox.dataset.value) return;
  const defInput = row.querySelector('.def-input');
  defInput.value = suggBox.dataset.value;
  suggBox.innerHTML = '';
}

/* Sync whatever is currently typed in the form back into the in-memory
   model, WITHOUT filtering/defaulting anything — used before any action
   that triggers a re-render (add/remove row, import), so nothing typed
   gets lost. */
function syncEditorFieldsToModel() {
  const s = getSet(currentSetId);
  if (!s) return;
  const titleEl = document.getElementById('setTitleInput');
  if (titleEl) s.title = titleEl.value;
  const rows = document.querySelectorAll('#rowsContainer .editor-row');
  if (rows.length) {
    const terms = [];
    rows.forEach(row => {
      const id = row.getAttribute('data-id');
      const term = row.querySelector('.term-input').value;
      const def = row.querySelector('.def-input').value;
      terms.push({ id, term, definition: def });
    });
    s.terms = terms;
  }
}

function addRow() {
  syncEditorFieldsToModel();
  const s = getSet(currentSetId);
  s.terms.push({ id: uid(), term: '', definition: '' });
  renderEditor();
  const inputs = document.querySelectorAll('.term-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function removeRow(id) {
  syncEditorFieldsToModel();
  const s = getSet(currentSetId);
  s.terms = s.terms.filter(t => t.id !== id);
  renderEditor();
}

function toggleImport() {
  document.getElementById('importBox').classList.toggle('hidden');
}

function applyImport() {
  const text = document.getElementById('importText').value;
  if (!text.trim()) return;
  syncEditorFieldsToModel();
  const s = getSet(currentSetId);
  const newTerms = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  lines.forEach(line => {
    let parts;
    if (line.includes('\t')) parts = line.split('\t');
    else if (line.includes(' - ')) parts = line.split(' - ');
    else if (line.includes('\t')) parts = line.split('\t');
    else if (line.includes(':')) parts = line.split(':');
    else if (line.includes(',')) parts = line.split(',');
    else parts = [line, ''];
    const term = (parts[0] || '').trim();
    const def = (parts.slice(1).join(' - ') || '').trim();
    if (term) newTerms.push({ id: uid(), term, definition: def });
  });
  // remove empty placeholder rows before merging
  s.terms = s.terms.filter(t => t.term.trim() !== '' || t.definition.trim() !== '');
  s.terms = s.terms.concat(newTerms);
  saveSets(SETS);
  document.getElementById('importText').value = '';
  renderEditor();
}

function collectEditorData() {
  const s = getSet(currentSetId);
  const rows = document.querySelectorAll('#rowsContainer .editor-row');
  const terms = [];
  rows.forEach(row => {
    const id = row.getAttribute('data-id');
    const term = row.querySelector('.term-input').value.trim();
    const def = row.querySelector('.def-input').value.trim();
    if (term || def) terms.push({ id, term, definition: def });
  });
  s.title = document.getElementById('setTitleInput').value.trim() || 'Untitled set';
  s.terms = terms;
}

function saveEditor() {
  collectEditorData();
  const s = getSet(currentSetId);
  if (s.terms.length === 0) {
    alert('Add at least one term before saving.');
    return;
  }
  saveSets(SETS);
  go('detail');
}