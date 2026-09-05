/* =========================================================
   LEARN MODE
========================================================= */
function defaultLearnSettings(){
  return {
    shuffle: true,
    studyStarred: false,
    soundEffects: false,
    multipleChoice: true,
    written: true,
    answerWith: 'definition',   // 'definition' | 'term'
    grading: 'exact',           // 'exact' | 'lenient'
    tts: false
  };
}

function learnPlayBeep(correct){
  try{
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = correct ? 880 : 220;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }catch(e){ /* ignore */ }
}

function learnNormalize(str, lenient){
  let v = (str||'').trim().toLowerCase();
  if(lenient) v = v.replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
  return v;
}

function buildLearnQuestion(s, termId){
  const term = s.terms.find(t=>t.id===termId);
  const settings = session.settings || defaultLearnSettings();
  const answerWithTerm = settings.answerWith === 'term';
  const field = answerWithTerm ? 'term' : 'definition';
  const pool = s.terms.filter(t=>t.id!==termId);
  const wrongCount = Math.min(3, pool.length);
  const wrongs = shuffle(pool).slice(0, wrongCount).map(t=>t[field]);
  const options = shuffle([term[field], ...wrongs]);
  // Decide question type based on settings, falling back sensibly if only one type enabled
  let useChoice;
  if(settings.multipleChoice && settings.written){
    useChoice = s.terms.length > 3 ? Math.random() < 0.5 : true;
    if(s.terms.length <= 3) useChoice = false; // not enough distractors, prefer written
  } else if(settings.multipleChoice){
    useChoice = true;
  } else {
    useChoice = false;
  }
  if(useChoice && s.terms.length <= 3) useChoice = false;
  return { term, options: useChoice ? options : null, correct: term[field], answerWithTerm };
}

function learnBuildQueue(s, settings){
  const pool = settings.studyStarred ? s.terms.filter(t=>t.starred) : s.terms;
  const ids = pool.length ? pool.map(t=>t.id) : s.terms.map(t=>t.id); // fall back if no starred terms
  return settings.shuffle ? shuffle(ids) : ids;
}

function renderLearn(){
  const s = getSet(currentSetId);
  if(!session.settings){
    session.settings = defaultLearnSettings();
  }
  if(!session.queue){
    session.queue = learnBuildQueue(s, session.settings);
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

  if(session.settings.tts && session._lastSpokenTermId !== q.term.id){
    session._lastSpokenTermId = q.term.id;
    setTimeout(()=>speak(q.term.term, 'en-US'), 50);
  }

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
          <span class="idx">${i+1}</span><span>${escapeHtml(opt||'(empty)')}</span>
        </button>`;
      }).join('')}
    </div>`;
  } else {
    bodyHtml = `
      <input type="text" class="written-input" id="writtenInput" placeholder="${q.answerWithTerm?'Type the term...':'Type the definition...'}" ${session.answered?'disabled':''}
        onkeydown="if(event.key==='Enter') learnSubmitWritten()">
      <div style="margin-top:14px; text-align:right;">
        ${!session.answered ? `<button class="btn-primary" onclick="learnSubmitWritten()">Check</button>` : ''}
      </div>
    `;
  }

  root.innerHTML = `
    <div class="study-screen">
      <div class="study-top">
        <div class="left">Learn</div>
        <div class="center"><span>${doneCount} / ${session.roundTotal}</span><span class="setname">${escapeHtml(s.title)}</span></div>
        <div class="right">
          <button class="icon-btn" title="Settings" onclick="learnOpenSettings()">⚙️</button>
          <button class="icon-btn" onclick="go('detail')">✕</button>
        </div>
      </div>
      <div class="study-body">
        <div class="study-inner">
          <div style="display:flex; align-items:center; margin-bottom:24px;">
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          </div>

          <div id="feedbackBanner" class="feedback-banner ${session.answered ? (session.wasCorrect?'ok show':'bad show') : ''}">
            ${session.answered ? (session.wasCorrect ? '✓ Correct!' : `✕ Incorrect — answer: ${escapeHtml(q.correct||'')}`) : ''}
          </div>

          <div class="learn-card">
            <div class="learn-label">${q.answerWithTerm?'Definition':'Term'}<span onclick="speak('${escapeAttr(q.term.term)}','en-US')" style="cursor:pointer;" title="Read aloud">🔊</span></div>
            <div class="learn-term">${escapeHtml(q.answerWithTerm ? q.term.definition : q.term.term)}</div>
            <div class="learn-label" style="margin-bottom:10px;">${q.options?'Choose an answer':(q.answerWithTerm?'Type the term':'Type the definition')}</div>
            ${bodyHtml}
          </div>

          <div class="learn-footer">
            <button class="link-btn" onclick="learnDontKnow()" ${session.answered?'disabled':''}>Don't know?</button>
            ${session.answered ? `<button class="btn-primary" onclick="learnNext()">Continue →</button>` : ''}
          </div>
        </div>
      </div>
      ${session.settingsOpen ? learnSettingsModalHtml() : ''}
    </div>
  `;
  if(!q.options){
    const el = document.getElementById('writtenInput');
    if(el) el.focus();
  }
}

/* ---------- Settings modal (Options) ---------- */

function learnOpenSettings(){
  session.settingsDraft = Object.assign({}, session.settings || defaultLearnSettings());
  session.learnAccordion = { questionTypes:false, answerWith:false, grading:false };
  session.settingsOpen = true;
  renderLearn();
}
function learnCloseSettings(){
  session.settingsOpen = false;
  session.settingsDraft = null;
  renderLearn();
}

function learnSettingsModalHtml(){
  const s = getSet(currentSetId);
  const draft = session.settingsDraft || defaultLearnSettings();
  const acc = session.learnAccordion || {};
  const hasStarred = s.terms.some(t=>t.starred);

  return `
    <div class="modal-overlay" onclick="learnCloseSettings()">
      <div class="modal" onclick="event.stopPropagation()" style="position:relative;">
        <button class="modal-close" onclick="learnCloseSettings()">✕</button>
        <h2>Options</h2>

        <div class="pill-row">
          <button class="pill-toggle ${draft.shuffle?'on':''}" onclick="learnDraftToggle('shuffle')">🔀 Shuffle</button>
          <button class="pill-toggle ${draft.studyStarred?'on':''} ${hasStarred?'':'disabled'}" ${hasStarred?'':'disabled'} onclick="learnDraftToggle('studyStarred')">☆ Study starred</button>
          <button class="pill-toggle ${draft.soundEffects?'on':''}" onclick="learnDraftToggle('soundEffects')">🔊 Sound effects</button>
        </div>

        <div class="accordion-row" onclick="learnToggleAccordion('questionTypes')">
          <span>Question types</span>
          <span class="chev ${acc.questionTypes?'open':''}">⌄</span>
        </div>
        ${acc.questionTypes ? `
          <div class="accordion-panel">
            <div class="modal-row">
              <span>Multiple choice</span>
              <button class="switch ${draft.multipleChoice?'on':''}" onclick="learnDraftToggleQuestionType('multipleChoice')"><span class="knob"></span></button>
            </div>
            <div class="modal-row">
              <span>Written</span>
              <button class="switch ${draft.written?'on':''}" onclick="learnDraftToggleQuestionType('written')"><span class="knob"></span></button>
            </div>
          </div>
        ` : ''}

        <div class="accordion-row" onclick="learnToggleAccordion('answerWith')">
          <span>Answer with</span>
          <span class="chev ${acc.answerWith?'open':''}">⌄</span>
        </div>
        ${acc.answerWith ? `
          <div class="accordion-panel">
            <div class="modal-row">
              <span>Show</span>
              <select class="select-input" onchange="learnDraftSet('answerWith', this.value)">
                <option value="definition" ${draft.answerWith==='definition'?'selected':''}>Term → Definition</option>
                <option value="term" ${draft.answerWith==='term'?'selected':''}>Definition → Term</option>
              </select>
            </div>
          </div>
        ` : ''}

        <div class="accordion-row" onclick="learnToggleAccordion('grading')">
          <span>Grading options</span>
          <span class="chev ${acc.grading?'open':''}">⌄</span>
        </div>
        ${acc.grading ? `
          <div class="accordion-panel">
            <div class="modal-row">
              <span>Written answers</span>
              <select class="select-input" onchange="learnDraftSet('grading', this.value)">
                <option value="exact" ${draft.grading==='exact'?'selected':''}>Exact match</option>
                <option value="lenient" ${draft.grading==='lenient'?'selected':''}>Lenient (ignore case/typos)</option>
              </select>
            </div>
          </div>
        ` : ''}

        <div class="modal-row">
          <span>Text to speech</span>
          <button class="switch ${draft.tts?'on':''}" onclick="learnDraftToggle('tts')"><span class="knob"></span></button>
        </div>

        <div class="modal-row" style="cursor:pointer;" onclick="learnQuickStart('multipleChoice')">
          <span>Multiple choice mode</span>
          <span class="modal-row-link">Start <span>›</span></span>
        </div>
        <div class="modal-row" style="cursor:pointer;" onclick="learnQuickStart('written')">
          <span>Written mode</span>
          <span class="modal-row-link">Start <span>›</span></span>
        </div>

        <div class="modal-row">
          <a class="modal-row-link" href="#" onclick="return false;">Privacy Policy</a>
        </div>

        <div class="modal-footer-row">
          <button class="link-btn" style="color:var(--red);" onclick="learnRestart()">Restart Learn</button>
          <div style="display:flex; gap:10px;">
            <button class="btn-ghost" onclick="learnCloseSettings()">Cancel</button>
            <button class="btn-primary" onclick="learnSaveSettings()">Save</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function learnToggleAccordion(key){
  if(!session.learnAccordion) session.learnAccordion = {};
  session.learnAccordion[key] = !session.learnAccordion[key];
  renderLearn();
}

function learnDraftToggle(key){
  if(!session.settingsDraft) session.settingsDraft = Object.assign({}, session.settings);
  const draft = session.settingsDraft;
  if(key === 'studyStarred'){
    const s = getSet(currentSetId);
    if(!s.terms.some(t=>t.starred)) return; // no-op if nothing starred
  }
  draft[key] = !draft[key];
  renderLearn();
}

function learnDraftToggleQuestionType(key){
  const draft = session.settingsDraft;
  const other = key === 'multipleChoice' ? 'written' : 'multipleChoice';
  if(draft[key] && !draft[other]) return; // keep at least one type enabled
  draft[key] = !draft[key];
  renderLearn();
}

function learnDraftSet(key, value){
  if(!session.settingsDraft) session.settingsDraft = Object.assign({}, session.settings);
  session.settingsDraft[key] = value;
}

function learnSaveSettings(){
  const s = getSet(currentSetId);
  const prev = session.settings || defaultLearnSettings();
  const next = session.settingsDraft || prev;
  const needsRebuild = prev.shuffle !== next.shuffle || prev.studyStarred !== next.studyStarred;
  session.settings = next;
  session.settingsOpen = false;
  session.settingsDraft = null;
  session.currentQ = null; // rebuild current question with fresh settings
  if(needsRebuild){
    session.queue = learnBuildQueue(s, session.settings);
    session.roundTotal = session.queue.length;
  }
  renderLearn();
}

function learnQuickStart(type){
  const draft = session.settingsDraft || Object.assign({}, session.settings);
  draft.multipleChoice = (type === 'multipleChoice');
  draft.written = (type === 'written');
  session.settingsDraft = draft;
  learnSaveSettings();
}

function learnRestart(){
  const s = getSet(currentSetId);
  const settings = session.settingsDraft || session.settings || defaultLearnSettings();
  session.settings = settings;
  session.queue = learnBuildQueue(s, settings);
  session.roundTotal = session.queue.length;
  session.doneIds = new Set();
  session.answered = false;
  session.correctCount = 0;
  session.totalAnswered = 0;
  session.currentQ = null;
  session.settingsOpen = false;
  session.settingsDraft = null;
  renderLearn();
}

/* ---------- Answering ---------- */

function learnAnswer(opt){
  if(session.answered) return;
  const q = session.currentQ;
  session.selected = opt;
  session.answered = true;
  session.wasCorrect = (opt === q.correct);
  session.totalAnswered++;
  if(session.wasCorrect) session.correctCount++;
  if(session.settings.soundEffects) learnPlayBeep(session.wasCorrect);
  setTermMastery(currentSetId, q.term.id, session.wasCorrect);
  renderLearn();
}

function learnSubmitWritten(){
  if(session.answered) return;
  const el = document.getElementById('writtenInput');
  const val = el ? el.value : '';
  const q = session.currentQ;
  const lenient = session.settings.grading === 'lenient';
  session.selected = val;
  session.answered = true;
  const normVal = learnNormalize(val, lenient);
  session.wasCorrect = normVal.length>0 && normVal === learnNormalize(q.correct, lenient);
  session.totalAnswered++;
  if(session.wasCorrect) session.correctCount++;
  if(session.settings.soundEffects) learnPlayBeep(session.wasCorrect);
  setTermMastery(currentSetId, q.term.id, session.wasCorrect);
  renderLearn();
}

function learnDontKnow(){
  if(session.answered) return;
  session.answered = true;
  session.wasCorrect = false;
  session.selected = null;
  session.totalAnswered++;
  if(session.settings.soundEffects) learnPlayBeep(false);
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