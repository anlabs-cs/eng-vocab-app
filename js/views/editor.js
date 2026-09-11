/* =========================================================
   EDITOR VIEW
========================================================= */
function renderEditor(){
  const s = getSet(currentSetId);
  if(!s){ go('home'); return; }
  if(s.terms.length===0) s.terms.push({id:uid(), term:'', definition:''});

  root.innerHTML = `
    ${topNav()}
    <div class="page">
      <div class="crumb"><a onclick="go('home')">Vocabulary</a> <span>/</span> <a onclick="go('detail')">${escapeHtml(s.title)}</a></div>
      <input class="title-input" id="setTitleInput" value="${escapeAttr(s.title)}" placeholder="Enter a title">

      <button class="toggle-link" onclick="toggleImport()" id="importToggle">📋 Paste a list to import quickly</button>
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
        ${s.terms.map((t,i)=>editorRowHtml(t,i)).join('')}
      </div>
      <button class="add-row-btn" onclick="addRow()">Add a card</button>

      <div class="editor-actions">
        <button class="btn-ghost" onclick="go('detail')">Cancel</button>
        <button class="btn-primary" onclick="saveEditor()">Save set</button>
      </div>
    </div>
  `;
}

function editorRowHtml(t,i){
  return `
    <div class="editor-row" data-id="${t.id}">
      <div class="num">${i+1}</div>
      <div class="editor-col">
        <span class="field-label">Term</span>
        <input type="text" class="term-input" value="${escapeAttr(t.term)}" placeholder="e.g. accommodation">
      </div>
      <div class="editor-col">
        <span class="field-label">Definition</span>
        <input type="text" class="def-input" value="${escapeAttr(t.definition)}" placeholder="e.g. a place to live or stay">
      </div>
      <button class="rm" onclick="removeRow('${t.id}')">✕</button>
    </div>
  `;
}

/* Sync whatever is currently typed in the form back into the in-memory
   model, WITHOUT filtering/defaulting anything — used before any action
   that triggers a re-render (add/remove row, import), so nothing typed
   gets lost. */
function syncEditorFieldsToModel(){
  const s = getSet(currentSetId);
  if(!s) return;
  const titleEl = document.getElementById('setTitleInput');
  if(titleEl) s.title = titleEl.value;
  const rows = document.querySelectorAll('#rowsContainer .editor-row');
  if(rows.length){
    const terms = [];
    rows.forEach(row=>{
      const id = row.getAttribute('data-id');
      const term = row.querySelector('.term-input').value;
      const def = row.querySelector('.def-input').value;
      terms.push({id, term, definition:def});
    });
    s.terms = terms;
  }
}

function addRow(){
  syncEditorFieldsToModel();
  const s = getSet(currentSetId);
  s.terms.push({id:uid(), term:'', definition:''});
  renderEditor();
  const inputs = document.querySelectorAll('.term-input');
  if(inputs.length) inputs[inputs.length-1].focus();
}

function removeRow(id){
  syncEditorFieldsToModel();
  const s = getSet(currentSetId);
  s.terms = s.terms.filter(t=>t.id!==id);
  renderEditor();
}

function toggleImport(){
  document.getElementById('importBox').classList.toggle('hidden');
}

function applyImport(){
  const text = document.getElementById('importText').value;
  if(!text.trim()) return;
  syncEditorFieldsToModel();
  const s = getSet(currentSetId);
  const newTerms = [];
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  lines.forEach(line=>{
    let parts;
    if(line.includes('\t')) parts = line.split('\t');
    else if(line.includes(' - ')) parts = line.split(' - ');
    else if(line.includes('\t')) parts = line.split('\t');
    else if(line.includes(':')) parts = line.split(':');
    else if(line.includes(',')) parts = line.split(',');
    else parts = [line, ''];
    const term = (parts[0]||'').trim();
    const def = (parts.slice(1).join(' - ')||'').trim();
    if(term) newTerms.push({id:uid(), term, definition:def});
  });
  // remove empty placeholder rows before merging
  s.terms = s.terms.filter(t=>t.term.trim()!=='' || t.definition.trim()!=='');
  s.terms = s.terms.concat(newTerms);
  saveSets(SETS);
  document.getElementById('importText').value='';
  renderEditor();
}

function collectEditorData(){
  const s = getSet(currentSetId);
  const rows = document.querySelectorAll('#rowsContainer .editor-row');
  const terms = [];
  rows.forEach(row=>{
    const id = row.getAttribute('data-id');
    const term = row.querySelector('.term-input').value.trim();
    const def = row.querySelector('.def-input').value.trim();
    if(term || def) terms.push({id, term, definition:def});
  });
  s.title = document.getElementById('setTitleInput').value.trim() || 'Untitled set';
  s.terms = terms;
}

function saveEditor(){
  collectEditorData();
  const s = getSet(currentSetId);
  if(s.terms.length===0){
    alert('Add at least one term before saving.');
    return;
  }
  saveSets(SETS);
  go('detail');
}