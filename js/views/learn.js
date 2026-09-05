/* =========================================================
   LEARN MODE
========================================================= */
function buildLearnQuestion(s, termId){
  const term = s.terms.find(t=>t.id===termId);
  const pool = s.terms.filter(t=>t.id!==termId);
  const wrongCount = Math.min(3, pool.length);
  const wrongs = shuffle(pool).slice(0, wrongCount).map(t=>t.definition);
  const options = shuffle([term.definition, ...wrongs]);
  const useChoice = s.terms.length > 3; // if too few terms, fallback to written
  return { term, options: useChoice ? options : null, correct: term.definition };
}

function renderLearn(){
  const s = getSet(currentSetId);
  if(!session.queue){
    session.queue = shuffle(s.terms.map(t=>t.id));
    session.roundTotal = session.queue.length;
    session.doneIds = new Set();
    session.answered = false;
    session.correctCount = 0;
    session.totalAnswered = 0;
  }
  if(session.queue.length===0){
    recordStudyActivity();
    go('results', {mode:'learn', correct:session.correctCount, total:session.totalAnswered});
    return;
  }
  const termId = session.queue[0];
  if(!session.currentQ || session.currentQ.term.id!==termId){
    session.currentQ = buildLearnQuestion(s, termId);
    session.answered = false;
    session.selected = null;
  }
  const q = session.currentQ;
  const doneCount = session.roundTotal - session.queue.length;
  const pct = Math.round((doneCount/session.roundTotal)*100);

  let bodyHtml = '';
  if(q.options){
    bodyHtml = `<div class="choices">
      ${q.options.map((opt,i)=>{
        let cls='choice';
        if(session.answered){
          if(opt===q.correct) cls+=' correct';
          else if(opt===session.selected) cls+=' wrong';
        }
        return `<button class="${cls}" ${session.answered?'disabled':''} onclick="learnAnswer(${JSON.stringify(opt).replace(/"/g,'&quot;')})">
          <span class="idx">${i+1}</span><span>${escapeHtml(opt||'(trống)')}</span>
        </button>`;
      }).join('')}
    </div>`;
  } else {
    bodyHtml = `
      <input type="text" class="written-input" id="writtenInput" placeholder="Nhập định nghĩa..." ${session.answered?'disabled':''}
        onkeydown="if(event.key==='Enter') learnSubmitWritten()">
      <div style="margin-top:14px; text-align:right;">
        ${!session.answered ? `<button class="btn-primary" onclick="learnSubmitWritten()">Kiểm tra</button>` : ''}
      </div>
    `;
  }

  root.innerHTML = `
    <div class="study-screen">
      <div class="study-top">
        <div class="left">Learn</div>
        <div class="center"><span>${doneCount} / ${session.roundTotal}</span><span class="setname">${escapeHtml(s.title)}</span></div>
        <div class="right"><button class="icon-btn" onclick="go('detail')">✕</button></div>
      </div>
      <div class="study-body">
        <div class="study-inner">
          <div style="display:flex; align-items:center; margin-bottom:24px;">
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          </div>

          <div id="feedbackBanner" class="feedback-banner ${session.answered ? (session.wasCorrect?'ok show':'bad show') : ''}">
            ${session.answered ? (session.wasCorrect ? '✓ Chính xác!' : `✕ Chưa đúng — đáp án: ${escapeHtml(q.correct||'')}`) : ''}
          </div>

          <div class="learn-card">
            <div class="learn-label">Term<span onclick="speak('${escapeAttr(q.term.term)}','en-US')" style="cursor:pointer;" title="Đọc to">🔊</span></div>
            <div class="learn-term">${escapeHtml(q.term.term)}</div>
            <div class="learn-label" style="margin-bottom:10px;">${q.options?'Choose an answer':'Nhập định nghĩa'}</div>
            ${bodyHtml}
          </div>

          <div class="learn-footer">
            <button class="link-btn" onclick="learnDontKnow()" ${session.answered?'disabled':''}>Don't know?</button>
            ${session.answered ? `<button class="btn-primary" onclick="learnNext()">Tiếp tục →</button>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
  if(!q.options){
    const el = document.getElementById('writtenInput');
    if(el) el.focus();
  }
}

function learnAnswer(opt){
  if(session.answered) return;
  const q = session.currentQ;
  session.selected = opt;
  session.answered = true;
  session.wasCorrect = (opt === q.correct);
  session.totalAnswered++;
  if(session.wasCorrect) session.correctCount++;
  setTermMastery(currentSetId, q.term.id, session.wasCorrect);
  renderLearn();
}

function learnSubmitWritten(){
  if(session.answered) return;
  const el = document.getElementById('writtenInput');
  const val = (el ? el.value : '').trim().toLowerCase();
  const q = session.currentQ;
  const correct = (q.correct||'').trim().toLowerCase();
  session.selected = val;
  session.answered = true;
  session.wasCorrect = val.length>0 && val === correct;
  session.totalAnswered++;
  if(session.wasCorrect) session.correctCount++;
  setTermMastery(currentSetId, q.term.id, session.wasCorrect);
  renderLearn();
}

function learnDontKnow(){
  if(session.answered) return;
  session.answered = true;
  session.wasCorrect = false;
  session.selected = null;
  session.totalAnswered++;
  setTermMastery(currentSetId, session.currentQ.term.id, false);
  renderLearn();
}

function learnNext(){
  const termId = session.queue[0];
  if(session.wasCorrect){
    session.queue.shift();
  } else {
    // move missed term to back of queue for retry
    session.queue.shift();
    session.queue.push(termId);
  }
  session.currentQ = null;
  session.answered = false;
  renderLearn();
}
