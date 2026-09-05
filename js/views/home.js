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
   Search + "Recent" sort + history grouped by time
========================================================= */
let homeSearchQuery = '';
let homeSortMode = 'recent'; // 'recent' | 'title'

function setCardHtml(s){
  const ms = setMasteryStats(s);
  const displayTitle = s.title && s.title.trim() ? escapeHtml(s.title) : '(Draft)';
  return `
    <div class="set-card" onclick="openSet('${s.id}')">
      <div style="flex:1;">
        <div class="name">${displayTitle}</div>
        <div class="meta">${s.terms.length} Cards ${s.terms.length ? `· by you` : ''}</div>
        ${s.terms.length ? `<div class="mini-progress"><div class="mini-progress-fill" style="width:${ms.pct}%"></div></div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button class="del" onclick="event.stopPropagation(); deleteSet('${s.id}')">Delete</button>
        <span class="arrow">›</span>
      </div>
    </div>
  `;
}

function groupSetsByRecency(sets){
  const now = Date.now();
  const drafts = sets.filter(s=>s.terms.length===0);
  const rest = sets.filter(s=>s.terms.length>0)
    .slice()
    .sort((a,b)=>(b.lastOpened||b.createdAt||0)-(a.lastOpened||a.createdAt||0));

  const groups = [];
  if(drafts.length>0){
    groups.push({
      label:'IN PROGRESS',
      sets: drafts.slice().sort((a,b)=>(b.lastOpened||b.createdAt||0)-(a.lastOpened||a.createdAt||0))
    });
  }

  const bucketIndex = {};
  rest.forEach(s=>{
    const ts = s.lastOpened || s.createdAt || now;
    const diffDays = (now - ts) / 86400000;
    let label;
    if(diffDays <= 7){
      label = 'THIS WEEK';
    } else {
      const d = new Date(ts);
      label = `IN ${d.toLocaleString('en-US',{month:'long'}).toUpperCase()} ${d.getFullYear()}`;
    }
    if(!(label in bucketIndex)){
      bucketIndex[label] = groups.length;
      groups.push({label, sets:[]});
    }
    groups[bucketIndex[label]].sets.push(s);
  });

  return groups;
}

function renderHome(){
  const streak = getStreak();
  const q = homeSearchQuery.trim().toLowerCase();
  const filtered = SETS.filter(s => !q || (s.title||'').toLowerCase().includes(q));

  let bodyHtml;
  if(SETS.length===0){
    bodyHtml = `
      <div class="empty-state">
        <div class="big">No sets yet</div>
        <div>Create your first flashcard set to get started</div>
        <div style="margin-top:20px;"><button class="btn-primary" onclick="createNewSet()">＋ Create</button></div>
      </div>
    `;
  } else if(filtered.length===0){
    bodyHtml = `
      <div class="empty-state">
        <div class="big">No results</div>
        <div>Try a different search term.</div>
      </div>
    `;
  } else if(homeSortMode==='title'){
    const sorted = filtered.slice().sort((a,b)=>(a.title||'').localeCompare(b.title||''));
    bodyHtml = `<div class="set-grid">${sorted.map(setCardHtml).join('')}</div>`;
  } else {
    const groups = groupSetsByRecency(filtered);
    bodyHtml = groups.map(g=>`
      <div class="set-group">
        <div class="set-group-label">${g.label}</div>
        <div class="set-grid">${g.sets.map(setCardHtml).join('')}</div>
      </div>
    `).join('');
  }

  root.innerHTML = `
    ${topNav()}
    <div class="page">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
        <h1 class="set-title" style="margin-bottom:0;">Your library</h1>
        ${streak.current>0 ? `<div class="streak-badge" title="Study streak">🔥 ${streak.current} day streak</div>` : ''}
      </div>

      ${SETS.length>0 ? `
        <div class="home-toolbar">
          <select class="sort-select" onchange="setSortMode(this.value)">
            <option value="recent" ${homeSortMode==='recent'?'selected':''}>Recent</option>
            <option value="title" ${homeSortMode==='title'?'selected':''}>Title (A-Z)</option>
          </select>
          <div class="search-box">
            <input type="text" id="homeSearchInput" placeholder="Search flashcards"
              value="${escapeAttr(homeSearchQuery)}" oninput="setSearchQuery(this.value)">
            <span class="search-icon">🔍</span>
          </div>
        </div>
      ` : ''}

      ${bodyHtml}
    </div>
  `;
}

function setSearchQuery(val){
  homeSearchQuery = val;
  renderHome();
  const el = document.getElementById('homeSearchInput');
  if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}

function setSortMode(val){
  homeSortMode = val;
  renderHome();
}

function createNewSet(){
  const now = Date.now();
  const newSet = { id: uid(), title: '', terms: [], createdAt: now, lastOpened: now };
  SETS.unshift(newSet);
  saveSets(SETS);
  currentSetId = newSet.id;
  go('editor', {isNew:true});
}

function openSet(id){
  currentSetId = id;
  const s = getSet(id);
  if(s){ s.lastOpened = Date.now(); saveSets(SETS); }
  go('detail');
}

function deleteSet(id){
  if(!confirm('Xóa bộ từ này? Hành động không thể hoàn tác.')) return;
  SETS = SETS.filter(s=>s.id!==id);
  saveSets(SETS);
  render();
}