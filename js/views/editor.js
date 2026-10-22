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
      <div class="crumb"><a onclick="go('detail')">← ${escapeHtml(s.title || 'Back')}</a></div>
      <input class="title-input" id="setTitleInput" value="${escapeAttr(s.title)}" placeholder="Enter a title">

      <button class="toggle-link" onclick="toggleImport()" id="importToggle"><img src="img/icon/import.png" class="theme-icon"> Paste a list or load a file to import quickly</button>
      <div id="importBox" class="hidden" style="margin-top:12px;">
        <textarea class="import-box" id="importText" placeholder="accommodation - chỗ ở, nơi ở
priority	sự ưu tiên	Safety is our top priority.	n.	/praɪˈɒrəti/

One term per line: term - definition (also :, =, or comma),
or Tab / CSV columns: term, definition, example, word type, phonetic."></textarea>
        <label class="import-option">
          <input type="checkbox" id="importAutoTranslate" checked> Auto-fill empty definitions (English → Vietnamese, needs Internet)
        </label>
        <div class="import-actions">
          <button class="btn-primary" onclick="applyImport()">Import list</button>
          <button class="btn-ghost" onclick="document.getElementById('importFileInput').click()">Load .txt / .csv / .tsv file…</button>
          <button class="btn-ghost" onclick="toggleImport()">Cancel</button>
          <input type="file" id="importFileInput" accept=".txt,.csv,.tsv,text/plain,text/csv" style="display:none" onchange="loadImportFile(event)">
        </div>
        <div id="importStatus" class="import-status"></div>
      </div>

      <div id="rowsContainer" style="margin-top:24px;">
        ${s.terms.map((t, i) => editorRowHtml(t, i)).join('')}
      </div>
      <button class="add-row-btn" onclick="addRow()">Add a card</button>
      <div class="editor-shortcuts">
        <span><kbd>Enter</kbd> in Term: go to Definition</span>
        <span><kbd>Enter</kbd> in Definition: use suggestion</span>
        <span><kbd>Ctrl</kbd> + <kbd>Enter</kbd> new card</span>
        <span><kbd>Ctrl</kbd> + <kbd>S</kbd> save set</span>
      </div>

      <div class="editor-actions">
        <button class="btn-ghost" onclick="go('detail')">Cancel</button>
        <button class="btn-primary" onclick="saveEditor()">Save set</button>
      </div>
    </div>
  `;
}

function editorRowHtml(t, i) {
  const hasExtra = !!(t.pos || t.phonetic || t.example);
  return `
    <div class="editor-row ${hasExtra ? 'show-extra' : ''}" data-id="${t.id}">
      <div class="num">${i + 1}</div>
      <div class="editor-fields">
        <div class="editor-main">
          <div class="editor-col">
            <span class="field-label">Term</span>
            <input type="text" class="term-input" value="${escapeAttr(t.term)}" placeholder="e.g. accommodation" onkeydown="termKeydown(event, '${t.id}')">
          </div>
          <div class="editor-col">
            <span class="field-label">Definition</span>
            <input type="text" class="def-input" value="${escapeAttr(t.definition)}" placeholder="e.g. chỗ ở" onfocus="suggestDefinition('${t.id}')" onkeydown="defKeydown(event, '${t.id}')">
            <div class="def-suggestion" id="sugg-${t.id}"></div>
          </div>
        </div>
        <button class="extra-toggle" onclick="this.closest('.editor-row').classList.add('show-extra')">+ Example, word type, phonetic</button>
        <div class="editor-extra">
          <div class="editor-col extra-small">
            <span class="field-label">Word type</span>
            <input type="text" class="pos-input" value="${escapeAttr(t.pos || '')}" placeholder="n. / v. / adj.">
          </div>
          <div class="editor-col extra-small">
            <span class="field-label">Phonetic</span>
            <input type="text" class="phonetic-input" value="${escapeAttr(t.phonetic || '')}" placeholder="/əˌkɒməˈdeɪʃn/">
          </div>
          <div class="editor-col">
            <span class="field-label">Example</span>
            <input type="text" class="example-input" value="${escapeAttr(t.example || '')}" placeholder="e.g. The price includes accommodation.">
          </div>
        </div>
      </div>
      <button class="rm" title="Remove" onclick="removeRow('${t.id}')"><img src="img/icon/x.png" class="theme-icon"></button>
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

async function translateToVi(term) {
  const cacheKey = term.toLowerCase();
  if (_suggestCache[cacheKey]) return _suggestCache[cacheKey];
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=' + encodeURIComponent(term);
  const res = await fetch(url);
  if (!res.ok) throw new Error('translate failed');
  const data = await res.json();
  const translated = (data[0] || []).map(seg => seg[0]).join('').trim();
  if (translated) _suggestCache[cacheKey] = translated;
  return translated;
}

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
    delete suggBox.dataset.value;
    delete suggBox.dataset.pending;
    return;
  }
  delete suggBox.dataset.value;

  if (!_suggestCache[term.toLowerCase()]) suggBox.innerHTML = `<span class="sugg-loading">Đang dịch...</span>`;
  try {
    const translated = await translateToVi(term);
    if (!translated) { suggBox.innerHTML = ''; delete suggBox.dataset.pending; return; }
    // make sure the field wasn't filled in / focus moved on while we waited
    if (document.activeElement === defInput && defInput.value.trim() === '') {
      renderSuggestionChip(suggBox, rowId, translated);
      // Enter was pressed while the translation was still loading: apply it now
      if (suggBox.dataset.pending) { delete suggBox.dataset.pending; acceptSuggestion(rowId); }
    } else {
      suggBox.innerHTML = '';
      delete suggBox.dataset.pending;
    }
  } catch (e) {
    suggBox.innerHTML = `<span class="sugg-error">Không thể gợi ý nghĩa</span>`;
    delete suggBox.dataset.pending;
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
  delete suggBox.dataset.value;
  defInput.focus();
  defInput.setSelectionRange(defInput.value.length, defInput.value.length);
}

/* Enter in the Term field: jump to the Definition field of the same card
   (focusing it also triggers the translation suggestion). Ignored during IME
   composition so confirming a word in Unikey / Telex doesn't skip the field. */
function termKeydown(e, rowId) {
  if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  if (e.isComposing || e.keyCode === 229) return;
  const row = document.querySelector(`.editor-row[data-id="${rowId}"]`);
  const defInput = row && row.querySelector('.def-input');
  if (!defInput) return;
  e.preventDefault();
  defInput.focus();
}

/* Enter in the Definition field: use the suggestion (only while the field is
   still empty, so it never overwrites typed text). Ignored during IME
   composition (Unikey / Telex) so confirming a Vietnamese word is unaffected.
   Ctrl/Cmd+Enter is handled globally in main.js (new card). */
function defKeydown(e, rowId) {
  if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  if (e.isComposing || e.keyCode === 229) return;
  const defInput = e.target;
  if (defInput.value.trim() !== '') return;
  const suggBox = document.getElementById(`sugg-${rowId}`);
  if (!suggBox) return;
  if (suggBox.querySelector('.sugg-chip') && suggBox.dataset.value) {
    e.preventDefault();
    acceptSuggestion(rowId);
  } else if (suggBox.querySelector('.sugg-loading')) {
    e.preventDefault();               // translation still loading
    suggBox.dataset.pending = '1';
  }
}

/* Read every editor row from the DOM. Fields the editor doesn't show
   (starred, mastered, spaced-repetition box/due...) are carried over
   from the existing term with the same id. */
function readEditorRows(s, trim) {
  const oldTerms = Object.fromEntries(s.terms.map(t => [t.id, t]));
  const rows = document.querySelectorAll('#rowsContainer .editor-row');
  const terms = [];
  rows.forEach(row => {
    const id = row.getAttribute('data-id');
    const val = sel => { const v = row.querySelector(sel).value; return trim ? v.trim() : v; };
    const t = Object.assign({}, oldTerms[id], {
      id,
      term: val('.term-input'),
      definition: val('.def-input'),
      pos: val('.pos-input'),
      phonetic: val('.phonetic-input'),
      example: val('.example-input')
    });
    for (const k of ['pos', 'phonetic', 'example']) if (!t[k].trim()) delete t[k];
    terms.push(t);
  });
  return { rows, terms };
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
  const { rows, terms } = readEditorRows(s, false);
  if (rows.length) s.terms = terms;
}

function addRow() {
  syncEditorFieldsToModel();
  const s = getSet(currentSetId);
  s.terms.push({ id: uid(), term: '', definition: '' });
  renderEditor();
  const inputs = document.querySelectorAll('.term-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

/* Ctrl/Cmd+Enter: add a card and jump to its Term field. If the last card is
   still completely empty, just focus it instead of piling up blank cards. */
function addRowShortcut() {
  const rows = document.querySelectorAll('#rowsContainer .editor-row');
  const last = rows[rows.length - 1];
  const blank = last && ['.term-input', '.def-input', '.pos-input', '.phonetic-input', '.example-input']
    .every(sel => !last.querySelector(sel).value.trim());
  if (blank) { last.querySelector('.term-input').focus(); return; }
  addRow();
  const inputs = document.querySelectorAll('.term-input');
  if (inputs.length) inputs[inputs.length - 1].scrollIntoView({ block: 'center', behavior: 'smooth' });
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

let importIsCsv = false;
function loadImportFile(evt) {
  const file = evt.target.files[0];
  evt.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    importIsCsv = /\.csv$/i.test(file.name);
    document.getElementById('importText').value = String(reader.result).replace(/^﻿/, '');
    document.getElementById('importStatus').textContent = `Loaded ${file.name}. Check the list, then press "Import list".`;
  };
  reader.readAsText(file);
}

function applyImport() {
  const text = document.getElementById('importText').value;
  if (!text.trim()) return;
  syncEditorFieldsToModel();
  const s = getSet(currentSetId);
  const newTerms = parseImportText(text, { csv: importIsCsv }).map(t => Object.assign({ id: uid() }, t));
  importIsCsv = false;
  if (!newTerms.length) { alert('No terms found in the pasted text.'); return; }
  const autoTranslate = document.getElementById('importAutoTranslate').checked;
  // remove empty placeholder rows before merging
  s.terms = s.terms.filter(t => t.term.trim() !== '' || t.definition.trim() !== '');
  s.terms = s.terms.concat(newTerms);
  saveSets(SETS);
  renderEditor();
  const missing = newTerms.filter(t => !t.definition);
  if (autoTranslate && missing.length) autoFillDefinitions(missing.map(t => t.id));
}

/* Fill empty Definition inputs of freshly imported rows, a few at a time.
   Writes into the form only (user still presses "Save set"), and never
   touches a field the user has typed into meanwhile. */
async function autoFillDefinitions(ids) {
  const banner = document.createElement('div');
  banner.className = 'import-status floating';
  document.body.appendChild(banner);
  let done = 0, failed = 0;
  const queue = ids.slice();
  async function worker() {
    while (queue.length && view === 'editor') {
      const id = queue.shift();
      const row = document.querySelector(`.editor-row[data-id="${id}"]`);
      const termEl = row && row.querySelector('.term-input');
      const defEl = row && row.querySelector('.def-input');
      if (termEl && defEl && termEl.value.trim() && !defEl.value.trim()) {
        try {
          const tr = await translateToVi(termEl.value.trim());
          if (tr && !defEl.value.trim()) defEl.value = tr;
        } catch (e) { failed++; }
      }
      done++;
      banner.textContent = `Translating definitions… ${done}/${ids.length}`;
    }
  }
  banner.textContent = `Translating definitions… 0/${ids.length}`;
  await Promise.all([worker(), worker(), worker()]);
  banner.textContent = failed
    ? `Done. ${failed} definition(s) could not be translated (offline?). Remember to press "Save set".`
    : 'Definitions filled in. Review them, then press "Save set".';
  setTimeout(() => banner.remove(), 5000);
}

function collectEditorData() {
  const s = getSet(currentSetId);
  const { terms } = readEditorRows(s, true);
  s.title = document.getElementById('setTitleInput').value.trim() || 'Untitled set';
  s.terms = terms.filter(t => t.term || t.definition);
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
