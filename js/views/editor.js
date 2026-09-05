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
      <div class="crumb"><a onclick="go('home')">Bộ từ vựng</a> <span>/</span> <a onclick="go('detail')">${escapeHtml(s.title)}</a></div>
      <input class="title-input" id="setTitleInput" value="${escapeAttr(s.title)}" placeholder="Enter a title">

      <button class="toggle-link" onclick="toggleImport()" id="importToggle">📋 Dán danh sách để nhập nhanh</button>
      <div id="importBox" class="hidden" style="margin-top:12px;">
        <textarea class="import-box" id="importText" placeholder="accommodation - chỗ ở
priority	ưu tiên

Mỗi dòng 1 từ, phân cách thuật ngữ và định nghĩa bằng dấu gạch ngang ( - ) hoặc Tab."></textarea>
        <div style="display:flex; gap:10px; margin-top:10px;">
          <button class="btn-primary" onclick="applyImport()">Nhập danh sách</button>
          <button class="btn-ghost" onclick="toggleImport()">Hủy</button>
        </div>
      </div>

      <div id="rowsContainer" style="margin-top:24px;">
        ${s.terms.map((t,i)=>editorRowHtml(t,i)).join('')}
      </div>
      <button class="add-row-btn" onclick="addRow()">Add a card</button>

      <div class="editor-actions">
        <button class="btn-ghost" onclick="go('detail')">Hủy</button>
        <button class="btn-primary" onclick="saveEditor()">Lưu bộ từ</button>
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
        <input type="text" class="term-input" value="${escapeAttr(t.term)}" placeholder="vd: accommodation">
      </div>
      <div class="editor-col">
        <span class="field-label">Definition</span>
        <input type="text" class="def-input" value="${escapeAttr(t.definition)}" placeholder="vd: chỗ ở">
      </div>
      <button class="rm" onclick="removeRow('${t.id}')">✕</button>
    </div>
  `;
}

function addRow(){
  const s = getSet(currentSetId);
  s.terms.push({id:uid(), term:'', definition:''});
  renderEditor();
  const inputs = document.querySelectorAll('.term-input');
  if(inputs.length) inputs[inputs.length-1].focus();
}

function removeRow(id){
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
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  const s = getSet(currentSetId);
  const newTerms = [];
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
  s.title = document.getElementById('setTitleInput').value.trim() || 'Bộ từ chưa đặt tên';
  s.terms = terms;
}

function saveEditor(){
  collectEditorData();
  const s = getSet(currentSetId);
  if(s.terms.length===0){
    alert('Thêm ít nhất 1 thuật ngữ trước khi lưu.');
    return;
  }
  saveSets(SETS);
  go('detail');
}
