/* =========================================================
   RESULTS VIEW
========================================================= */
function renderResults(){
  const s = getSet(currentSetId);
  if(!s){ go('home'); return; }
  let title, scoreLine, stats, retryFn, reviewHtml='';
  const retryCount = Array.isArray(session.retryIds) ? session.retryIds.length : 0;
  const retryLabel = session.mode === 'flashcards'
    ? `Study ${retryCount} still-learning card${retryCount>1?'s':''} again`
    : `Learn the ${retryCount} term${retryCount>1?'s':''} you missed`;

  if(session.mode==='flashcards'){
    title = 'Flashcards complete!';
    scoreLine = `${session.known} / ${session.total} known`;
    stats = `
      <div class="rstat"><div class="n" style="color:var(--good)">${session.known}</div><div class="l">Known</div></div>
      <div class="rstat"><div class="n" style="color:var(--accent)">${session.total - session.known}</div><div class="l">Still learning</div></div>
    `;
    retryFn = "go('flashcards')";
  } else if(session.mode==='learn'){
    const pct = session.total ? Math.round(session.correct/session.total*100) : 0;
    title = 'Learn complete!';
    scoreLine = `${pct}% correct`;
    stats = `
      <div class="rstat"><div class="n" style="color:var(--good)">${session.correct}</div><div class="l">Correct answers</div></div>
      <div class="rstat"><div class="n">${session.total}</div><div class="l">Total questions</div></div>
    `;
    retryFn = "go('learn')";
  } else {
    const pct = session.total ? Math.round(session.correct/session.total*100) : 0;
    title = pct>=80 ? 'Great job!' : (pct>=50 ? 'Pretty good!' : 'Keep practicing!');
    scoreLine = `${pct}%`;
    stats = `
      <div class="rstat"><div class="n" style="color:var(--good)">${session.correct}</div><div class="l">Correct</div></div>
      <div class="rstat"><div class="n" style="color:var(--bad)">${session.total-session.correct}</div><div class="l">Wrong</div></div>
    `;
    retryFn = "go('test-setup')";
    const hasWritten = session.questions.some(q=>q.type==='written');
    reviewHtml = `
      <div class="term-list-header"><h3>Answer review</h3></div>
      ${hasWritten ? `<div class="review-note">Written answers: you decide if each one was right or wrong. Tap <strong>Right</strong> / <strong>Wrong</strong> to change it — the score updates.</div>` : ''}
      ${session.questions.map((q,i)=>{
        if(q.type==='written'){
          const prompt = q.answerWithTerm ? q.term.definition : q.term.term;
          const answer = q.answerWithTerm ? q.term.term : q.term.definition;
          return `
            <div class="test-q">
              <div class="qn">Question ${i+1}
                <span class="review-tag ${q.isCorrect?'correct':'wrong'}">${q.isCorrect?'Correct':'Wrong'}</span>
              </div>
              <div class="qterm">${escapeHtml(prompt)}</div>
              <div style="color:var(--ink-3);">Your answer: <strong style="color:var(--ink);">${escapeHtml(q.userAnswer || '(empty)')}</strong></div>
              <div style="color:var(--ink-3);">Correct answer: <strong style="color:var(--ink);">${escapeHtml(answer)}</strong></div>
              <div class="judge-actions inline">
                <button class="judge-btn bad${q.isCorrect?'':' active'}" onclick="setWrittenVerdict(${i}, false)">✗ Wrong</button>
                <button class="judge-btn ok${q.isCorrect?' active':''}" onclick="setWrittenVerdict(${i}, true)">✓ Right</button>
              </div>
            </div>
          `;
        }
        if(q.type==='matching'){
          const rows = q.terms.map(t=>{
            const userDefId = q.matches[t.id];
            const userDef = q.right.find(r=>r.id===userDefId);
            const rowCorrect = userDefId === t.id;
            return `
              <div style="margin-top:6px; padding-top:6px; border-top:1px dashed var(--rule);">
                <span style="color:var(--ink);">${escapeHtml(t.term)}</span>
                <span style="color:var(--ink-3);"> <img src="img/icon/arrow-right.png" class="theme-icon"> </span>
                <span style="color:${rowCorrect?'var(--good)':'var(--bad)'};">${escapeHtml(userDef ? userDef.text : '(not matched)')}</span>
                ${!rowCorrect ? `<div style="color:var(--ink-3);">Correct answer: <strong style="color:var(--ink);">${escapeHtml(t.definition)}</strong></div>` : ''}
              </div>
            `;
          }).join('');
          return `
            <div class="test-q">
              <div class="qn">Question ${i+1}
                <span class="review-tag ${q.isCorrect?'correct':'wrong'}">${q.isCorrect?'Correct':'Wrong'}</span>
              </div>
              <div class="qterm">Matching</div>
              ${rows}
            </div>
          `;
        }
        return `
        <div class="test-q">
          <div class="qn">Question ${i+1}
            <span class="review-tag ${q.isCorrect?'correct':'wrong'}">${q.isCorrect?'Correct':'Wrong'}</span>
          </div>
          <div class="qterm">${escapeHtml(q.term.term)}</div>
          <div style="color:var(--ink-3);">Correct answer: <strong style="color:var(--ink);">${escapeHtml(q.term.definition)}</strong></div>
        </div>
      `;
      }).join('')}
    `;
  }

  root.innerHTML = `
    ${topNav()}
    <div class="page">
      <div class="results-hero">
        <div class="big" style="font-size:24px; font-weight:800;">${title}</div>
        <div class="results-score">${scoreLine}</div>
        <div class="results-stats">${stats}</div>
        <div class="results-actions">
          <button class="btn-ghost" onclick="go('detail')">Back to set</button>
          <button class="${retryCount ? 'btn-ghost' : 'btn-primary'}" onclick="${retryFn}">Study again</button>
          ${retryCount ? `<button class="btn-primary retry-missed-btn" onclick="retryMissed()">${retryLabel}</button>` : ''}
        </div>
      </div>
      ${reviewHtml}
    </div>
  `;
}

/* Flashcards -> repeat only the "still learning" cards;
   Learn / Test -> Learn mode with only the missed terms */
function retryMissed(){
  const ids = session.retryIds || [];
  if(!ids.length) return;
  if(session.mode === 'flashcards') go('flashcards', {onlyIds: ids});
  else go('learn', {onlyIds: ids, reviewLabel: 'Missed terms'});
}

/* Test: the learner's own verdict on a written answer. Undoes the learning
   progress recorded at submit time and records the new verdict instead, then
   recomputes the score and the "missed terms" list. */
function setWrittenVerdict(i, correct){
  const q = session.questions && session.questions[i];
  if(!q || q.type !== 'written' || q.isCorrect === correct) return;
  if(q.prevSnap) restoreTermState(currentSetId, q.term.id, q.prevSnap);
  q.prevSnap = setTermMastery(currentSetId, q.term.id, correct);
  q.isCorrect = correct;
  recomputeTestResults();
  const y = window.scrollY;
  renderResults();
  window.scrollTo(0, y);
}

function recomputeTestResults(){
  let correct = 0;
  const wrong = new Set();
  session.questions.forEach(q=>{
    if(q.type === 'matching'){
      q.terms.forEach(t=>{
        if(q.matches[t.id] === t.id) correct++; else wrong.add(t.id);
      });
    } else if(q.isCorrect) correct++;
    else wrong.add(q.term.id);
  });
  session.correct = correct;
  session.retryIds = [...wrong];
}
