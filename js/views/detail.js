/* =========================================================
   DETAIL VIEW
========================================================= */
let detailMenuOpen = false;
let hideDefinitions = false;
let revealedIds = new Set();
let hideStateSetId = null;
const HIDE_STATE_KEY = 'vocabapp_hide_v1';
let editingTermId = null;
let previewIndex = 0;
let previewFlipped = false;
let previewSetId = null;

function loadHideState(){
  if(hideStateSetId === currentSetId) return;
  hideStateSetId = currentSetId;
  hideDefinitions = false; revealedIds = new Set();
  try{
    const st = (JSON.parse(sessionStorage.getItem(HIDE_STATE_KEY) || '{}'))[currentSetId];
    if(st){ hideDefinitions = !!st.hide; revealedIds = new Set(st.shown || []); }
  }catch(e){}
}
function saveHideState(){
  try{
    const all = JSON.parse(sessionStorage.getItem(HIDE_STATE_KEY) || '{}');
    all[currentSetId] = { hide: hideDefinitions, shown: [...revealedIds] };
    sessionStorage.setItem(HIDE_STATE_KEY, JSON.stringify(all));
  }catch(e){}
}

function renderDetail(){
  const s = getSet(currentSetId);
  if(!s){ go('home'); return; }
  if(previewSetId !== s.id){
    previewSetId = s.id;
    previewIndex = 0;
    previewFlipped = false;
  }
  const ms = setMasteryStats(s);
  const dueIds = dueTermIds(s);
  const pt = s.terms[previewIndex];

  root.innerHTML = `
    ${topNav()}
    <div class="page">
      <div class="crumb"><a onclick="go('home')">← Library</a></div>
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <h1 class="set-title" style="margin-bottom:14px;">${escapeHtml(s.title)}</h1>
        <div class="icon-btn-row">
          <button class="icon-btn round-btn" title="${s.starred?'Unsave':'Save set'}" onclick="toggleStarSet('${s.id}')">${s.starred?'<img src="img/icon/star2.png" class="theme-icon theme-icon-color">':'<img src="img/icon/star1.png" class="theme-icon">'}</button>
          <button class="icon-btn round-btn" title="Share" onclick="shareSet('${s.id}')"><img src="img/icon/share-2.png" class="theme-icon"></button>
          <div style="position:relative;">
            <button class="icon-btn round-btn" title="More" onclick="toggleDetailMenu(event)"><img src="img/icon/menu.png" class="theme-icon"></button>
            ${detailMenuOpen ? `
              <div class="dropdown-menu" onclick="event.stopPropagation()">
                <button onclick="closeDetailMenu(); go('editor')"><span>Edit set</span></button>
                <button onclick="closeDetailMenu(); duplicateSet('${s.id}')"><span>Duplicate</span></button>
                <button onclick="closeDetailMenu(); printSet('${s.id}')"><span>Print</span></button>
                <button class="danger" onclick="closeDetailMenu(); deleteSetFromDetail('${s.id}')"><span>Delete</span></button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${s.terms.length>0 ? `
        <div class="mastery-bar-wrap">
          <div class="mastery-bar-head">
            <span>${ms.mastered} of ${ms.total} known</span>
            <span>${ms.pct}%</span>
          </div>
          <div class="progress-track" style="margin:0;"><div class="progress-fill" style="width:${ms.pct}%; background:var(--good);"></div></div>
        </div>
      ` : ''}

      ${s.terms.length===0 ? `
        <div class="empty-state">
          <div class="big">This set has no terms yet</div>
          <div style="margin-top:16px;"><button class="btn-primary" onclick="go('editor')">Add terms</button></div>
        </div>
      ` : `

        <div class="preview-card">
          <div class="preview-hint">
            <span onclick="event.stopPropagation(); speak(${jsArg(previewFlipped?(s.terms[previewIndex].definition||''):s.terms[previewIndex].term)}, 'en-US')" title="Read aloud"><img src="img/icon/volume-2.png" class="theme-icon"></span>
          </div>
          <div class="preview-face ${previewFlipped?'def':''}" onclick="togglePreviewFlip()">${previewFlipped ? backFaceHtml(pt, '(no definition)') : frontFaceHtml(pt)}</div>
          <div class="preview-footer"><kbd>Space</kbd></div>
          <div class="preview-nav">
            <button class="fc-nav" title="Previous" onclick="previewPrev()"><img src="img/icon/chevron-left.png" class="theme-icon"></button>
            <span class="preview-count">${previewIndex+1} / ${s.terms.length}</span>
            <button class="fc-nav" title="Next" onclick="previewNext()"><img src="img/icon/chevron-right.png" class="theme-icon"></button>
          </div>
        </div>
        ${dueIds.length ? `
          <button class="review-due-btn" onclick="startDueReview()">
            <span>Review (${dueIds.length})</span><span class="review-due-go">Start →</span>
          </button>` : ''}
        <div class="mode-tabs">
          <div class="mode-tab" onclick="go('flashcards')">Flashcards</div>
          <div class="mode-tab" onclick="go('learn')">Learn</div>
          <div class="mode-tab" onclick="go('test-setup')">Test</div>
        </div>
        <div class="term-section">
          <div class="term-list-header sticky-bar">
            <h3>Vocab (${s.terms.length})</h3>
            <button class="btn-ghost" onclick="toggleHideDefinitions()">${hideDefinitions?'Show':'Hide'}</button>
          </div>
          <div class="ruled">${s.terms.map(t=>termRowHtml(t)).join('')}</div>
        </div>
      `}
    </div>
  `;
}

function startDueReview(){
  const s = getSet(currentSetId);
  if(!s) return;
  go('learn', {onlyIds: dueTermIds(s), reviewLabel: 'Review'});
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

// shares the terms as "term - definition" lines, which the editor's import box reads back
function shareSet(id){
  const s = getSet(id);
  if(!s) return;
  const text = s.terms.map(t=>t.term + ' - ' + t.definition).join('\n');
  if(navigator.share){
    navigator.share({title:s.title, text}).catch(()=>{});
    return;
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(()=>{
      alert('Term list copied to clipboard. Paste it into "Import" when creating a set.');
    }).catch(()=>{
      alert('Could not copy to the clipboard.');
    });
  }
}

function duplicateSet(id){
  const s = getSet(id);
  if(!s) return;
  const copy = {
    id: uid(),
    title: s.title + ' (copy)',
    starred: false,
    createdAt: Date.now(),
    lastOpened: Date.now(),
    terms: s.terms.map(({id, mastered, box, due, lastReviewed, ...rest})=>({...rest, id:uid()}))
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

function deleteSetFromDetail(id){
  if(!confirm('Delete this set? This action cannot be undone.')) return;
  SETS = SETS.filter(s=>s.id!==id);
  saveSets(SETS);
  if(typeof driveSyncNow === 'function') driveSyncNow();
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
          <input type="text" class="term-edit-input" id="editTermInput_${t.id}" value="${escapeAttr(t.term)}" placeholder="Term">
          <input type="text" class="term-edit-input" id="editDefInput_${t.id}" value="${escapeAttr(t.definition)}" placeholder="Definition">
        </div>
        <div class="term-row-icons">
          <button class="icon-btn round-btn small" title="Save" onclick="saveInlineEdit('${t.id}')"><img src="img/icon/check.png" class="theme-icon"></button>
          <button class="icon-btn round-btn small" title="Cancel" onclick="cancelInlineEdit()"><img src="img/icon/x.png" class="theme-icon"></button>
        </div>
      </div>
    `;
  }
  return `
    <div class="term-row">
      <div class="term-row-icons">
        <button class="icon-btn round-btn small" title="${t.starred?'Unstar':'Star as important'}" onclick="toggleStarTerm('${t.id}')">${t.starred?'<img src="img/icon/star2.png" class="theme-icon theme-icon-color">':'<img src="img/icon/star1.png" class="theme-icon">'}</button>
        <button class="icon-btn round-btn small" title="Read aloud" onclick="speak(${jsArg(t.term)},'en-US')"><img src="img/icon/volume-2.png" class="theme-icon"></button>
        <button class="icon-btn round-btn small" title="Edit" onclick="startInlineEdit('${t.id}')"><img src="img/icon/pencil.png" class="theme-icon"></button>
      </div>
      <div class="term-row-content">
        <div class="t">
          <div>${escapeHtml(t.term)} ${t.mastered?'<span class="mastered-tag">✓ Know</span>':''}</div>
          ${t.pos || t.phonetic ? `<div class="t-meta">${t.pos?`<span class="pos-tag">${escapeHtml(t.pos)}</span>`:''} ${t.phonetic?`<span class="phonetic">${escapeHtml(t.phonetic)}</span>`:''}</div>` : ''}
        </div>
        <div class="sep"></div>
        <div class="d ${hideDefinitions?'revealable':''} ${hideDefinitions && !revealedIds.has(t.id)?'hidden-def':''}" ${hideDefinitions?`onclick="toggleRevealTerm('${t.id}')" title="Click to show / hide this definition"`:''}>
          <div>${escapeHtml(t.definition)}</div>
          ${t.example ? `<div class="d-example">“${escapeHtml(t.example)}”</div>` : ''}
        </div>
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
    alert('Term cannot be empty.');
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
  revealedIds.clear();
  saveHideState();
  renderDetail();
}

function toggleRevealTerm(termId){
  if(!hideDefinitions) return;
  const s = getSet(currentSetId);
  if(!s) return;
  if(revealedIds.has(termId)) revealedIds.delete(termId); else revealedIds.add(termId);
  if(s.terms.length && s.terms.every(t=>revealedIds.has(t.id))){
    hideDefinitions = false;
    revealedIds.clear();
  }
  saveHideState();
  const y = window.scrollY;
  renderDetail();
  window.scrollTo(0, y);
}