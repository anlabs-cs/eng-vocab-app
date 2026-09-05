/* =========================================================
   RESULTS VIEW
========================================================= */
function renderResults(){
  const s = getSet(currentSetId);
  let title, scoreLine, stats, retryFn, reviewHtml='';

  if(session.mode==='flashcards'){
    title = 'Hoàn thành Flashcards!';
    scoreLine = `${session.known} / ${session.total} đã thuộc`;
    stats = `
      <div class="rstat"><div class="n" style="color:var(--green)">${session.known}</div><div class="l">Đã thuộc</div></div>
      <div class="rstat"><div class="n" style="color:var(--orange)">${session.total - session.known}</div><div class="l">Đang học</div></div>
    `;
    retryFn = "go('flashcards')";
  } else if(session.mode==='learn'){
    const pct = session.total ? Math.round(session.correct/session.total*100) : 0;
    title = 'Hoàn thành Learn!';
    scoreLine = `${pct}% chính xác`;
    stats = `
      <div class="rstat"><div class="n" style="color:var(--green)">${session.correct}</div><div class="l">Trả lời đúng</div></div>
      <div class="rstat"><div class="n">${session.total}</div><div class="l">Tổng câu hỏi</div></div>
    `;
    retryFn = "go('learn')";
  } else {
    const pct = session.total ? Math.round(session.correct/session.total*100) : 0;
    title = pct>=80 ? 'Làm tốt lắm!' : (pct>=50 ? 'Khá ổn!' : 'Cố lên nào!');
    scoreLine = `${pct}%`;
    stats = `
      <div class="rstat"><div class="n" style="color:var(--green)">${session.correct}</div><div class="l">Đúng</div></div>
      <div class="rstat"><div class="n" style="color:var(--red)">${session.total-session.correct}</div><div class="l">Sai</div></div>
    `;
    retryFn = "go('test-setup')";
    reviewHtml = `
      <div class="term-list-header"><h3>Chi tiết bài làm</h3></div>
      ${session.questions.map((q,i)=>`
        <div class="test-q">
          <div class="qn">Câu ${i+1}
            <span class="review-tag ${q.isCorrect?'correct':'wrong'}">${q.isCorrect?'Đúng':'Sai'}</span>
          </div>
          <div class="qterm">${escapeHtml(q.term.term)}</div>
          <div style="color:var(--text-dim);">Đáp án đúng: <strong style="color:var(--text);">${escapeHtml(q.term.definition)}</strong></div>
        </div>
      `).join('')}
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
          <button class="btn-ghost" onclick="go('detail')">Quay lại bộ từ</button>
          <button class="btn-primary" onclick="${retryFn}">Học lại</button>
        </div>
      </div>
      ${reviewHtml}
    </div>
  `;
}
