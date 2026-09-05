/* =========================================================
   RENDER ROOT
========================================================= */
function render(){
  if(view==='home') return renderHome();
  if(view==='detail') return renderDetail();
  if(view==='editor') return renderEditor();
  if(view==='flashcards') return renderFlashcards();
  if(view==='learn') return renderLearn();
  if(view==='test-setup') return renderTestSetup();
  if(view==='test') return renderTest();
  if(view==='results') return renderResults();
}

function fileStatusHtml(){
  if(!FS_SUPPORTED){
    return `
      <button class="btn-ghost" onclick="exportJsonFallback()" title="Tải toàn bộ dữ liệu về máy dạng .json">Tải .json</button>
      <button class="btn-ghost" onclick="importJsonFallbackTrigger()" title="Nạp dữ liệu từ 1 file .json">Nhập .json</button>
      <input type="file" id="importFileInput" accept=".json,application/json" style="display:none" onchange="importJsonFallbackChange(event)">
    `;
  }
  if(fileSyncStatus==='connected'){
    return `<button class="btn-ghost" title="Đổi sang file khác" onclick="connectExistingFile()">.json</button>`;
  }
  if(fileSyncStatus==='saving'){
    return `<button class="btn-ghost" disabled>Saving...</button>`;
  }
  if(fileSyncStatus==='needs-permission'){
    return `<button class="btn-primary" onclick="reconnectFile()">.json</button>`;
  }
  if(fileSyncStatus==='error'){
    return `<button class="btn-ghost" style="color:var(--red);" onclick="connectExistingFile()" title="Lưu file thất bại, thử lại">Lỗi lưu file</button>`;
  }
  return `
    <button class="btn-ghost" onclick="connectExistingFile()" title="Chọn 1 file .json có sẵn để lưu/đọc dữ liệu">Open file .json</button>
    <button class="btn-ghost" onclick="createNewFile()" title="Tạo file .json mới trên máy để lưu dữ liệu">New file</button>
  `;
}

function topNav(showBack){
  return `
    <div class="topnav">
      <div class="brand" onclick="go('home')">
        <span>Quizlet</span>
      </div>
      <div class="spacer"></div>
      ${fileStatusHtml()}
      <button class="icon-btn" title="Create" onclick="createNewSet()">＋</button>
    </div>
  `;
}

/* =========================================================
   HOME VIEW
========================================================= */
function renderHome(){
  const streak = getStreak();
  const items = SETS.map(s=>{
    const ms = setMasteryStats(s);
    return `
    <div class="set-card" onclick="openSet('${s.id}')">
      <div style="flex:1;">
        <div class="name">${escapeHtml(s.title)}</div>
        <div class="meta">${s.terms.length} Cards ${s.terms.length ? `- by you` : ''}</div>
        ${s.terms.length ? `<div class="mini-progress"><div class="mini-progress-fill" style="width:${ms.pct}%"></div></div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button class="del" onclick="event.stopPropagation(); deleteSet('${s.id}')">Xóa</button>
        <span class="arrow">›</span>
      </div>
    </div>
  `;}).join('');

  root.innerHTML = `
    ${topNav()}
    <div class="page">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
        <h1 class="set-title" style="margin-bottom:0;">Your library</h1>
        ${streak.current>0 ? `<div class="streak-badge" title="Chuỗi ngày học liên tiếp">🔥 ${streak.current} ngày</div>` : ''}
      </div>
      <div style="margin-bottom:24px;"></div>
      ${SETS.length===0 ? `
        <div class="empty-state">
          <div class="big">Chưa có bộ từ nào</div>
          <div>Tạo bộ từ vựng đầu tiên để bắt đầu học</div>
          <div style="margin-top:20px;">
            <button class="btn-primary" onclick="createNewSet()">＋ Create</button>
          </div>
        </div>
      ` : `
        <div style="margin-bottom:18px;">

        </div>
        <div class="set-grid">${items}</div>
      `}
    </div>
  `;
}

function createNewSet(){
  const newSet = { id: uid(), title: '', terms: [] };
  SETS.unshift(newSet);
  saveSets(SETS);
  currentSetId = newSet.id;
  go('editor', {isNew:true});
}

function openSet(id){
  currentSetId = id;
  go('detail');
}

function deleteSet(id){
  if(!confirm('Xóa bộ từ này? Hành động không thể hoàn tác.')) return;
  SETS = SETS.filter(s=>s.id!==id);
  saveSets(SETS);
  render();
}
