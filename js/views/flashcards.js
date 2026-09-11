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
          
          <button class="icon-btn" title="Options" onclick="fcOpenOptions()">⚙️</button>
          <button class="icon-btn" title="Close" onclick="go('detail')">✕</button>
        </div>
      </div>
      <div class="study-body">
        <div class="study-inner">
          <div class="fc-stats">
            <div class="stat-pill stat-orange"><span class="n">${session.learning.size}</span>Still learning</div>
            <div class="stat-pill stat-green">Know<span class="n">${session.known.size}</span></div>
          </div>

          <div class="flip-card" id="flipCardEl">
            <div class="fc-head"><span>💡 Hint</span><span onclick="event.stopPropagation(); speak('${escapeAttr(session.flipped?term.definition:term.term)}', '${session.flipped?'vi-VN':'en-US'}')" title="Read aloud">🔊</span></div>
            <div class="fc-face ${session.flipped?'def':''}">${session.flipped ? escapeHtml(term.definition||'(no definition yet)') : escapeHtml(term.term)}</div>
            <div class="fc-foot">⌨️ Press <kbd>Space</kbd> or click to flip · Swipe right = Known, swipe left = Still learning</div>
          </div>

          <div class="fc-bottom-row">
            <div class="fc-controls">
              <button class="fc-circle no" title="Still learning" onclick="fcMark(false)">✕</button>
              <button class="fc-circle yes" title="Known" onclick="fcMark(true)">✓</button>
            </div>
          </div>

          <div style="text-align:center; margin-top:14px;">
            <button class="link-btn" title="Undo last review" onclick="fcUndo()" ${session.history.length===0?'disabled':''}>↺ Undo</button>
          </div>
        </div>
      </div>
      ${session.optionsOpen ? fcOptionsModalHtml() : ''}
    </div>
  `;
  fcAttachSwipe();
}

/* Swipe gesture: swipe right = Known, swipe left = Still learning */
function fcAttachSwipe(){
  const el = document.getElementById('flipCardEl');
  if(!el) return;
  const THRESHOLD = 90;
  let startX = 0, startY = 0, dx = 0, dragging = false, moved = false;

  function point(e){ return e.touches ? e.touches[0] : e; }

  function onDown(e){
    if(e.button !== undefined && e.button !== 0) return;
    dragging = true; moved = false; dx = 0;
    const p = point(e);
    startX = p.clientX; startY = p.clientY;
    el.style.transition = 'none';
  }
  function onMove(e){
    if(!dragging) return;
    const p = point(e);
    dx = p.clientX - startX;
    const dy = p.clientY - startY;
    if(Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) moved = true;
    if(!moved) return;
    el.style.transform = `translateX(${dx}px) rotate(${dx/18}deg)`;
    el.classList.toggle('swipe-yes', dx > 24);
    el.classList.toggle('swipe-no', dx < -24);
  }
  function reset(){
    el.style.transition = 'transform .2s ease';
    el.style.transform = '';
    el.classList.remove('swipe-yes','swipe-no');
  }
  function onUp(){
    if(!dragging) return;
    dragging = false;
    if(dx > THRESHOLD){
      el.style.transition = 'transform .25s ease, opacity .25s ease';
      el.style.transform = `translateX(700px) rotate(24deg)`;
      el.style.opacity = '0';
      setTimeout(()=>fcMark(true), 160);
    } else if(dx < -THRESHOLD){
      el.style.transition = 'transform .25s ease, opacity .25s ease';
      el.style.transform = `translateX(-700px) rotate(-24deg)`;
      el.style.opacity = '0';
      setTimeout(()=>fcMark(false), 160);
    } else {
      reset();
    }
  }
  function onClick(){
    if(moved){ moved = false; return; }
    fcFlip();
  }

  el.addEventListener('mousedown', onDown);
  el.addEventListener('touchstart', onDown, {passive:true});
  window.addEventListener('mousemove', onMove);
  el.addEventListener('touchmove', onMove, {passive:true});
  window.addEventListener('mouseup', onUp);
  el.addEventListener('touchend', onUp);
  el.addEventListener('click', onClick);
}

/* Keyboard marking (arrow keys) - plays the same fly-out animation as a swipe */
function fcKeyMark(known){
  const el = document.getElementById('flipCardEl');
  if(!el){ fcMark(known); return; }
  el.style.transition = 'transform .25s ease, opacity .25s ease';
  if(known){
    el.classList.add('swipe-yes');
    el.style.transform = 'translateX(700px) rotate(24deg)';
  } else {
    el.classList.add('swipe-no');
    el.style.transform = 'translateX(-700px) rotate(-24deg)';
  }
  el.style.opacity = '0';
  setTimeout(()=>fcMark(known), 160);
}

function fcOptionsModalHtml(){
  return `
    <div class="modal-overlay" onclick="fcCloseOptions()">
      <div class="modal" onclick="event.stopPropagation()" style="position:relative;">
        <button class="modal-close" onclick="fcCloseOptions()">✕</button>
        <h2>Options</h2>
        <div class="modal-row" style="cursor:pointer;" onclick="fcShuffle()">
          <span>${session.shuffleOn?'🔀':'↔️'} Shuffle</span>
          <span class="switch ${session.shuffleOn?'on':''}"><span class="knob"></span></span>
        </div>
        <div class="modal-row" style="cursor:pointer;" onclick="fcRestart()">
          <span>↻ Restart</span>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" onclick="fcCloseOptions()">Done</button>
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
