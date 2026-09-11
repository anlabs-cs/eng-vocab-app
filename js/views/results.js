/* =========================================================
   RESULTS VIEW
========================================================= */
function renderResults(){
  const s = getSet(currentSetId);
  let title, scoreLine, stats, retryFn, reviewHtml='';

  if(session.mode==='flashcards'){
    title = 'Flashcards complete!';
    scoreLine = `${session.known} / ${session.total} known`;
    stats = `
      <div class="rstat"><div class="n" style="color:var(--green)">${session.known}</div><div class="l">Known</div></div>
      <div class="rstat"><div class="n" style="color:var(--orange)">${session.total - session.known}</div><div class="l">Still learning</div></div>
    `;
    retryFn = "go('flashcards')";
  } else if(session.mode==='learn'){
    const pct = session.total ? Math.round(session.correct/session.total*100) : 0;
    title = 'Learn complete!';
    scoreLine = `${pct}% correct`;
    stats = `
      <div class="rstat"><div class="n" style="color:var(--green)">${session.correct}</div><div class="l">Correct answers</div></div>
      <div class="rstat"><div class="n">${session.total}</div><div class="l">Total questions</div></div>
    `;
    retryFn = "go('learn')";
  } else {
    const pct = session.total ? Math.round(session.correct/session.total*100) : 0;
    title = pct>=80 ? 'Great job!' : (pct>=50 ? 'Pretty good!' : 'Keep practicing!');
    scoreLine = `${pct}%`;
    stats = `
      <div class="rstat"><div class="n" style="color:var(--green)">${session.correct}</div><div class="l">Correct</div></div>
      <div class="rstat"><div class="n" style="color:var(--red)">${session.total-session.correct}</div><div class="l">Wrong</div></div>
    `;
    retryFn = "go('test-setup')";
    reviewHtml = `
      <div class="term-list-header"><h3>Answer review</h3></div>
      ${session.questions.map((q,i)=>{
        if(q.type==='matching'){
          const rows = q.terms.map(t=>{
            const userDefId = q.matches[t.id];
            const userDef = q.right.find(r=>r.id===userDefId);
            const rowCorrect = userDefId === t.id;
            return `
              <div style="margin-top:6px; padding-top:6px; border-top:1px dashed var(--border);">
                <span style="color:var(--text);">${escapeHtml(t.term)}</span>
                <span style="color:var(--text-dim);"> <img src="img/arrow-right.png" class="theme-icon"> </span>
                <span style="color:${rowCorrect?'var(--green)':'var(--red)'};">${escapeHtml(userDef ? userDef.text : '(not matched)')}</span>
                ${!rowCorrect ? `<div style="color:var(--text-dim);">Correct answer: <strong style="color:var(--text);">${escapeHtml(t.definition)}</strong></div>` : ''}
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
          <div style="color:var(--text-dim);">Correct answer: <strong style="color:var(--text);">${escapeHtml(q.term.definition)}</strong></div>
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
        <div style="display:flex; gap:12px; justify-content:center;">
          <button class="btn-ghost" onclick="go('detail')">Back to set</button>
          <button class="btn-primary" onclick="${retryFn}">Study again</button>
        </div>
      </div>
      ${reviewHtml}
    </div>
  `;
}
