/* =========================================================
   DETAIL VIEW
========================================================= */
let detailMenuOpen = false;

function renderDetail(){
  const s = getSet(currentSetId);
  if(!s){ go('home'); return; }
  const firstTerm = s.terms[0];
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
            <span>${ms.mastered}/${ms.total} từ đã thuộc</span>
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
          <div class="preview-hint" onclick="go('flashcards')" style="cursor:pointer;">
            <span>💡 Nhấn để xem trước</span>
          </div>
          <div class="preview-face" onclick="go('flashcards')">${escapeHtml(firstTerm.term)}</div>
          <div class="preview-footer"><span>⌨️</span> Press <kbd>Space</kbd> or click on the card to flip </div>
        </div>
        <div class="mode-tabs">
          <div class="mode-tab" onclick="go('flashcards')"><span class="ic"></span> Flashcards</div>
          <div class="mode-tab" onclick="go('learn')"><span class="ic"></span> Learn</div>
          <div class="mode-tab" onclick="go('test-setup')"><span class="ic"></span> Test</div>
        </div>
        <div class="term-list-header">
          <h3>Terms in this set (${s.terms.length})</h3>
        </div>
        ${s.terms.map(t=>`
          <div class="term-row">
            <div class="t">${escapeHtml(t.term)} ${t.mastered?'<span class=\"mastered-tag\">✓ đã thuộc</span>':''}</div>
            <div class="d">${escapeHtml(t.definition)}</div>
          </div>
        `).join('')}
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