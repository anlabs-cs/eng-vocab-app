/* =========================================================
   HOME VIEW
   Search + "Recent" sort + history grouped by time
========================================================= */
let homeSearchQuery = '';
let homeSortMode = 'recent'; // 'recent' | 'title'

function setCardHtml(s){
  const ms = setMasteryStats(s);
  const due = dueTermIds(s).length;
  const displayTitle = s.title && s.title.trim() ? escapeHtml(s.title) : '(Draft)';
  return `
    <div class="set-card" onclick="openSet('${s.id}')">
      <div class="set-card-main">
        <div class="name">${displayTitle}</div>
        <div class="meta">${s.terms.length} term${s.terms.length===1?'':'s'}${s.terms.length ? ` · ${ms.pct}% known` : ''}${due ? ` · <span class="due-tag">${due} to review</span>` : ''}</div>
        ${s.terms.length ? `<div class="mini-progress"><div class="mini-progress-fill" style="width:${ms.pct}%"></div></div>` : ''}
      </div>
      <button class="del" title="Delete set" aria-label="Delete set" onclick="event.stopPropagation(); deleteSet('${s.id}')"><img src="img/icon/x.png" class="theme-icon" alt=""></button>
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
  const dueTotal = totalDueCount();
  const q = homeSearchQuery.trim().toLowerCase();
  const filtered = SETS.filter(s => !q || (s.title||'').toLowerCase().includes(q));

  let bodyHtml;
  if(SETS.length===0){
    bodyHtml = `
      <div class="empty-state">
        <div class="big">No sets yet</div>
        <div>Create a set, or import one from Data.</div>
        <div style="margin-top:20px;"><button class="btn-primary" onclick="createNewSet()">Create a set</button></div>
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
      ${SETS.length>0 ? todayHtml(streak, dueTotal) : ''}

      <div class="section-head">
        <h2 class="section-title">Sets</h2>
        <button class="btn-ghost" onclick="createNewSet()"><img src="img/icon/plus.png" class="theme-icon"> New</button>
      </div>

      ${SETS.length>1 ? `
        <div class="home-toolbar">
          <div class="search-box">
            <img src="img/icon/search.png" class="theme-icon search-icon" alt="">
            <input type="text" id="homeSearchInput" placeholder="Search sets"
              value="${escapeAttr(homeSearchQuery)}" oninput="setSearchQuery(this.value)">
          </div>
          <select class="sort-select" onchange="setSortMode(this.value)" aria-label="Sort sets">
            <option value="recent" ${homeSortMode==='recent'?'selected':''}>Recent</option>
            <option value="title" ${homeSortMode==='title'?'selected':''}>A–Z</option>
          </select>
        </div>
      ` : ''}

      ${bodyHtml}
    </div>
  `;
}

/* "Today" block: what to review now, across all sets */
function todayHtml(streak, dueTotal){
  const dueSets = SETS.map(s=>({s, n:dueTermIds(s).length})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n);
  const streakText = streak.current>0
    ? `${streak.current}-day streak${streak.longest>streak.current ? ` · best ${streak.longest}` : ''}`
    : 'Study today to start a streak';
  return `
    <section class="today">
      <div class="today-head">
        <h1 class="today-title">Today</h1>
        <span class="today-streak">${streakText}</span>
      </div>
      ${dueTotal>0 ? `
        <p class="today-lead"><strong>${dueTotal}</strong> review.</p>
        <ul class="today-list">
          ${dueSets.map(({s,n})=>`
            <li>
              <button class="today-row" onclick="reviewSet('${s.id}')">
                <span class="today-set">${escapeHtml(s.title || '(Untitled)')}</span>
                <span class="today-count">${n}</span>
                <span class="today-go">Review →</span>
              </button>
            </li>`).join('')}
        </ul>
      ` : `<p class="today-lead">Nothing to review right now. Learn something new below.</p>`}
    </section>
  `;
}

function reviewSet(id){
  const s = getSet(id);
  if(!s) return;
  currentSetId = id;
  go('learn', {onlyIds: dueTermIds(s), reviewLabel: 'Review'});
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
  if(!confirm('Delete this set? This action cannot be undone.')) return;
  SETS = SETS.filter(s=>s.id!==id);
  render(); // vanish first, persist after
  saveSets(SETS);
  if(typeof driveSyncNow === 'function') driveSyncNow(); // push the deletion to Drive right away
}