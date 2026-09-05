/* =========================================================
   DETAIL VIEW
========================================================= */
let detailMenuOpen = false;
let hideDefinitions = false;
let editingTermId = null;
let previewIndex = 0;
let previewFlipped = false;
let previewSetId = null;

function renderDetail(){
  const s = getSet(currentSetId);
  if(!s){ go('home'); return; }
  if(previewSetId !== s.id){
    previewSetId = s.id;
    previewIndex = 0;
    previewFlipped = false;
  }
  const ms = setMasteryStats(s);

  root.innerHTML = `
    ${topNav()}
    <div class="page">
      <div class="crumb"><a onclick="go('home')">Your library</a> <span>/</span></div>
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <h1 class="set-title" style="margin-bottom:14px;">${escapeHtml(s.title)}</h1>
        <div class="icon-btn-row">
          <button class="icon-btn round-btn" title="${s.starred?'Bỏ lưu':'Lưu bộ từ'}" onclick="toggleStarSet('${s.id}')">${s.starred?'⭐':'☆'}</button>
          <button class="icon-btn round-btn" title="Chia sẻ" onclick="shareSet('${s.id}')">🔗</button>
          <div style="position:relative;">
            <button class="icon-btn round-btn" title="Thêm" onclick="toggleDetailMenu(event)">⋯</button>
            ${detailMenuOpen ? `
              <div class="dropdown-menu" onclick="event.stopPropagation()">
                <button onclick="closeDetailMenu(); go('editor')"><span>Sửa bộ từ</span></button>
                <button onclick="closeDetailMenu(); duplicateSet('${s.id}')"><span>Nhân bản</span></button>
                <button onclick="closeDetailMenu(); printSet('${s.id}')"><span>In</span></button>
                <button onclick="closeDetailMenu(); exportSetJson('${s.id}')">⬇<span>Xuất file .json</span></button>
                <button class="danger" onclick="closeDetailMenu(); deleteSetFromDetail('${s.id}')"><span>Xóa</span></button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${s.terms.length>0 ? `
        <div class="mastery-bar-wrap">
          <div class="mastery-bar-head">
            <span>${ms.mastered}/${ms.total}</span>
            <span>${ms.pct}%</span>
          </div>
          <div class="progress-track" style="margin:0;"><div class="progress-fill" style="width:${ms.pct}%; background:var(--green);"></div></div>
        </div>
      ` : ''}

      ${s.terms.length===0 ? `
        <div class="empty-state">
          <div class="big">Bộ từ này chưa có thuật ngữ nào</div>
          <div style="margin-top:16px;"><button class="btn-primary" onclick="go('editor')">Thêm thuật ngữ</button></div>
        </div>
      ` : `

        <div class="preview-card">
          <div class="preview-hint">
            <span>💡 Get a hint</span>
            <span onclick="event.stopPropagation(); speak('${escapeAttr(previewFlipped?(s.terms[previewIndex].definition||''):s.terms[previewIndex].term)}', '${previewFlipped?'vi-VN':'en-US'}')" title="Đọc to">🔊</span>
          </div>
          <div class="preview-face ${previewFlipped?'def':''}" onclick="togglePreviewFlip()">${previewFlipped ? escapeHtml(s.terms[previewIndex].definition||'(no definition)') : escapeHtml(s.terms[previewIndex].term)}</div>
          <div class="preview-footer"><span>⌨️</span> Press <kbd>Space</kbd> or click on the card to flip</div>
          <div class="preview-nav">
            <button class="fc-nav" title="Previous" onclick="previewPrev()">‹</button>
            <span class="preview-count">${previewIndex+1} / ${s.terms.length}</span>
            <button class="fc-nav" title="Next" onclick="previewNext()">›</button>
          </div>
        </div>
        <div class="mode-tabs">
          <div class="mode-tab" onclick="go('flashcards')"><span class="ic"></span> Flashcards</div>
          <div class="mode-tab" onclick="go('learn')"><span class="ic"></span> Learn</div>
          <div class="mode-tab" onclick="go('test-setup')"><span class="ic"></span> Test</div>
        </div>
        <div class="term-section">
          <div class="term-list-header sticky-bar">
            <h3>Terms in this set (${s.terms.length})</h3>
            <button class="btn-ghost" onclick="toggleHideDefinitions()">${hideDefinitions?'Show definitions':'Hide definitions'}</button>
          </div>
          ${s.terms.map(t=>termRowHtml(t)).join('')}
        </div>
      `}
    </div>
  `;
}

function toggleDetailMenu(e){
  if(e) e.stopPropagation();
  detailMenuOpen = !detailMenuOpen;
  renderDetail();
  if(detailMenuOpen){
    // close when clicking anywhere else
    setTimeout(()=>{
      document.addEventListener('click', closeDetailMenuOnce, {once:true});
    },0);
  }
}
function closeDetailMenuOnce(){ if(detailMenuOpen){ detailMenuOpen=false; renderDetail(); } }
function closeDetailMenu(){ detailMenuOpen = false; }

function toggleStarSet(id){
  const s = getSet(id);
  if(!s) return;
  s.starred = !s.starred;
  saveSets(SETS);
  renderDetail();
}

function shareSet(id){
  const s = getSet(id);
  if(!s) return;
  const payload = JSON.stringify([s], null, 2);
  if(navigator.share){
    navigator.share({title:s.title, text:`Bộ từ vựng "${s.title}" (${s.terms.length} từ)`}).catch(()=>{});
    return;
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(payload).then(()=>{
      alert('Đã sao chép dữ liệu bộ từ (định dạng JSON) vào clipboard. Bạn có thể dán gửi cho người khác.');
    }).catch(()=>{
      exportSetJson(id);
    });
  } else {
    exportSetJson(id);
  }
}

function duplicateSet(id){
  const s = getSet(id);
  if(!s) return;
  const copy = {
    id: uid(),
    title: s.title + ' (bản sao)',
    starred: false,
    terms: s.terms.map(t=>({id:uid(), term:t.term, definition:t.definition, mastered:false}))
  };
  SETS.unshift(copy);
  saveSets(SETS);
  currentSetId = copy.id;
  go('detail');
}

function printSet(id){
  const s = getSet(id);
  if(!s) return;
  const w = window.open('', '_blank');
  w.document.write(`
    <html><head><title>${escapeHtml(s.title)}</title>
    <style>
      body{font-family:sans-serif; padding:30px;}
      h1{margin-bottom:20px;}
      table{width:100%; border-collapse:collapse;}
      td{border:1px solid #ccc; padding:10px 14px; font-size:15px;}
    </style></head><body>
    <h1>${escapeHtml(s.title)}</h1>
    <table>
      ${s.terms.map(t=>`<tr><td><strong>${escapeHtml(t.term)}</strong></td><td>${escapeHtml(t.definition)}</td></tr>`).join('')}
    </table>
    </body></html>
  `);
  w.document.close();
  w.focus();
  w.print();
}

function exportSetJson(id){
  const s = getSet(id);
  if(!s) return;
  const blob = new Blob([JSON.stringify([s], null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (s.title || 'bo-tu').replace(/[^\w\-]+/g,'_') + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function deleteSetFromDetail(id){
  if(!confirm('Xóa bộ từ này? Hành động không thể hoàn tác.')) return;
  SETS = SETS.filter(s=>s.id!==id);
  saveSets(SETS);
  go('home');
}

function togglePreviewFlip(){ previewFlipped = !previewFlipped; renderDetail(); }
function previewNext(){
  const s = getSet(currentSetId);
  if(!s) return;
  if(previewIndex < s.terms.length-1){ previewIndex++; previewFlipped=false; renderDetail(); }
}
function previewPrev(){
  if(previewIndex>0){ previewIndex--; previewFlipped=false; renderDetail(); }
}

/* ---------- Per-term row: star / listen / inline edit / hide definitions ---------- */

function termRowHtml(t){
  if(editingTermId === t.id){
    return `
      <div class="term-row editing" data-term-id="${t.id}">
        <div class="term-row-content">
          <input type="text" class="term-edit-input" id="editTermInput_${t.id}" value="${escapeAttr(t.term)}" placeholder="Thuật ngữ">
          <input type="text" class="term-edit-input" id="editDefInput_${t.id}" value="${escapeAttr(t.definition)}" placeholder="Định nghĩa">
        </div>
        <div class="term-row-icons">
          <button class="icon-btn round-btn small" title="Lưu" onclick="saveInlineEdit('${t.id}')">✔️</button>
          <button class="icon-btn round-btn small" title="Hủy" onclick="cancelInlineEdit()">✕</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="term-row">
      <div class="term-row-icons">
        <button class="icon-btn round-btn small" title="${t.starred?'Bỏ đánh dấu':'Đánh dấu quan trọng'}" onclick="toggleStarTerm('${t.id}')">${t.starred?'⭐':'☆'}</button>
        <button class="icon-btn round-btn small" title="Đọc to" onclick="speak('${escapeAttr(t.term)}','en-US')">🔊</button>
        <button class="icon-btn round-btn small" title="Sửa" onclick="startInlineEdit('${t.id}')">✏️</button>
      </div>
      <div class="term-row-content">
        <div class="t">${escapeHtml(t.term)} ${t.mastered?'<span class="mastered-tag">✓ Know</span>':''}</div>
        <div class="sep"></div>
        <div class="d ${hideDefinitions?'hidden-def':''}">${escapeHtml(t.definition)}</div>
      </div>
    </div>
  `;
}

function toggleStarTerm(termId){
  const s = getSet(currentSetId);
  if(!s) return;
  const t = s.terms.find(x=>x.id===termId);
  if(!t) return;
  t.starred = !t.starred;
  saveSets(SETS);
  renderDetail();
}

function startInlineEdit(termId){
  editingTermId = termId;
  renderDetail();
  const el = document.getElementById('editTermInput_'+termId);
  if(el) el.focus();
}

function cancelInlineEdit(){
  editingTermId = null;
  renderDetail();
}

function saveInlineEdit(termId){
  const s = getSet(currentSetId);
  if(!s) return;
  const t = s.terms.find(x=>x.id===termId);
  if(!t) return;
  const termEl = document.getElementById('editTermInput_'+termId);
  const defEl = document.getElementById('editDefInput_'+termId);
  const newTerm = (termEl ? termEl.value : t.term).trim();
  const newDef = (defEl ? defEl.value : t.definition).trim();
  if(!newTerm){
    alert('Thuật ngữ không được để trống.');
    return;
  }
  t.term = newTerm;
  t.definition = newDef;
  saveSets(SETS);
  editingTermId = null;
  renderDetail();
}

function toggleHideDefinitions(){
  hideDefinitions = !hideDefinitions;
  renderDetail();
}