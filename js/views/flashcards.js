/* =========================================================
   FLASHCARDS MODE
========================================================= */
function renderFlashcards(){
  const s = getSet(currentSetId);
  if(!session.order){
    session.shuffleOn = false;
    session.order = s.terms.map(t=>t.id);
    session.idx = 0;
    session.flipped = false;
    session.known = new Set();
    session.learning = new Set();
    session.history = [];
  }
  const termId = session.order[session.idx];
  const term = s.terms.find(t=>t.id===termId);

  root.innerHTML = `
    <div class="study-screen">
      <div class="study-top">
        <div class="left">Flashcards</div>
        <div class="center"><span>${session.idx+1} / ${session.order.length}</span><span class="setname">${escapeHtml(s.title)}</span></div>
        <div class="right">
          <button class="icon-btn ${session.shuffleOn?'active':''}" title="${session.shuffleOn?'Trộn thẻ: Đang bật':'Trộn thẻ: Đang tắt'}" onclick="fcShuffle()">${session.shuffleOn?'🔀':'↔️'}</button>
          <button class="icon-btn" title="Tùy chọn" onclick="fcOpenOptions()">⚙️</button>
          <button class="icon-btn" title="Đóng" onclick="go('detail')">✕</button>
        </div>
      </div>
      <div class="study-body">
        <div class="study-inner">
          <div class="fc-stats">
            <div class="stat-pill stat-orange"><span class="n">${session.learning.size}</span>Still learning</div>
            <div class="stat-pill stat-green">Know<span class="n">${session.known.size}</span></div>
          </div>

          <div class="flip-card" onclick="fcFlip()" id="flipCardEl">
            <div class="fc-head"><span>💡 Gợi ý</span><span onclick="event.stopPropagation(); speak('${escapeAttr(session.flipped?term.definition:term.term)}', '${session.flipped?'vi-VN':'en-US'}')" title="Đọc to">🔊</span></div>
            <div class="fc-face ${session.flipped?'def':''}">${session.flipped ? escapeHtml(term.definition||'(chưa có định nghĩa)') : escapeHtml(term.term)}</div>
            <div class="fc-foot">⌨️ Nhấn <kbd>Space</kbd> hoặc click vào thẻ để lật</div>
          </div>

          <div class="fc-bottom-row">
            <button class="fc-nav" title="Thẻ trước" onclick="fcPrev()">‹</button>
            <div class="fc-controls">
              <button class="fc-circle no" title="Đang học" onclick="fcMark(false)">✕</button>
              <button class="fc-circle yes" title="Đã thuộc" onclick="fcMark(true)">✓</button>
            </div>
            <button class="fc-nav" title="Thẻ sau" onclick="fcNext()">›</button>
          </div>

          <div style="text-align:center; margin-top:14px;">
            <button class="link-btn" title="Hoàn tác đánh giá gần nhất" onclick="fcUndo()" ${session.history.length===0?'disabled':''}>↺ Hoàn tác</button>
          </div>
        </div>
      </div>
      ${session.optionsOpen ? fcOptionsModalHtml() : ''}
    </div>
  `;
}

function fcOptionsModalHtml(){
  return `
    <div class="modal-overlay" onclick="fcCloseOptions()">
      <div class="modal" onclick="event.stopPropagation()" style="position:relative;">
        <button class="modal-close" onclick="fcCloseOptions()">✕</button>
        <h2>Tùy chọn</h2>
        <div class="modal-row" style="cursor:pointer;" onclick="fcShuffle()">
          <span>${session.shuffleOn?'🔀':'↔️'} Trộn thẻ</span>
          <span class="switch ${session.shuffleOn?'on':''}"><span class="knob"></span></span>
        </div>
        <div class="modal-row" style="cursor:pointer;" onclick="fcRestart()">
          <span>↻ Học lại từ đầu</span>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" onclick="fcCloseOptions()">Xong</button>
        </div>
      </div>
    </div>
  `;
}
function fcOpenOptions(){ session.optionsOpen = true; renderFlashcards(); }
function fcCloseOptions(){ session.optionsOpen = false; renderFlashcards(); }

function fcFlip(){ session.flipped = !session.flipped; renderFlashcards(); }
function fcShuffle(){
  const s = getSet(currentSetId);
  session.shuffleOn = !session.shuffleOn;
  session.order = session.shuffleOn
    ? shuffle(s.terms.map(t=>t.id))
    : s.terms.map(t=>t.id);
  session.idx = 0; session.flipped = false;
  renderFlashcards();
}
function fcRestart(){
  session.idx = 0; session.flipped = false; session.optionsOpen = false;
  session.known = new Set(); session.learning = new Set(); session.history = [];
  renderFlashcards();
}
function fcAdvance(){
  if(session.idx < session.order.length-1){
    session.idx++; session.flipped = false;
  } else {
    recordStudyActivity();
    go('results', {mode:'flashcards', known:session.known.size, total:session.order.length});
    return;
  }
  renderFlashcards();
}
function fcMark(known){
  const termId = session.order[session.idx];
  const s = getSet(currentSetId);
  const t = s.terms.find(x=>x.id===termId);
  session.history.push({
    idx: session.idx,
    termId,
    wasKnown: session.known.has(termId),
    wasLearning: session.learning.has(termId),
    prevMastered: t ? !!t.mastered : false
  });
  if(known){ session.known.add(termId); session.learning.delete(termId); }
  else { session.learning.add(termId); session.known.delete(termId); }
  setTermMastery(currentSetId, termId, known);
  fcAdvance();
}
function fcUndo(){
  if(!session.history || session.history.length===0) return;
  const last = session.history.pop();
  session.idx = last.idx;
  session.flipped = false;
  session.known.delete(last.termId);
  session.learning.delete(last.termId);
  if(last.wasKnown) session.known.add(last.termId);
  if(last.wasLearning) session.learning.add(last.termId);
  setTermMastery(currentSetId, last.termId, last.prevMastered);
  renderFlashcards();
}
function fcNext(){
  if(session.idx < session.order.length-1){ session.idx++; session.flipped=false; renderFlashcards(); }
}
function fcPrev(){
  if(session.idx>0){ session.idx--; session.flipped=false; renderFlashcards(); }
}