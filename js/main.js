/* keyboard shortcuts (full list in README) */
function isTypingTarget(el){
  return !!el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.tagName==='SELECT' || el.isContentEditable);
}

document.addEventListener('keydown', (e)=>{
  if(DriveSync.needsLogin()) return; // login screen is showing
  // also check e.target: an input's own handler may re-render and drop focus
  // before the event bubbles up here, and that same Enter must not act twice
  const typing = isTypingTarget(document.activeElement) || isTypingTarget(e.target);
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.length===1 ? e.key.toLowerCase() : e.key;

  // Ctrl/Cmd combos work even while typing
  if(mod && !e.altKey){
    if(view==='editor' && key==='s'){ e.preventDefault(); saveEditor(); }
    else if(view==='editor' && key==='Enter' && !e.isComposing){ e.preventDefault(); addRowShortcut(); }
    else if(view==='test' && key==='Enter'){ e.preventDefault(); submitTest(); }
    return;
  }
  if(e.altKey) return;

  if(e.key==='Escape'){
    if(typing){ document.activeElement.blur(); return; }
    if(view==='flashcards'){ session.optionsOpen ? fcCloseOptions() : go('detail'); }
    else if(view==='learn'){ session.settingsOpen ? learnCloseSettings() : go('detail'); }
    else if(view==='test-setup' || view==='results'){ go('detail'); }
    else if(view==='detail'){
      if(detailMenuOpen) closeDetailMenuOnce();
      else if(editingTermId) cancelInlineEdit();
      else go('home');
    }
    return;
  }
  if(typing) return;
  // let a focused button handle its own Enter/Space
  if((key==='Enter' || e.code==='Space') && document.activeElement && document.activeElement.tagName==='BUTTON') return;

  // anywhere
  if(key==='d' && !e.shiftKey){ toggleTheme(); return; }

  if(view==='home'){
    if(key==='/'){
      const input = document.getElementById('homeSearchInput');
      if(input){ e.preventDefault(); input.focus(); input.select(); }
    }
    else if(key==='n'){ e.preventDefault(); createNewSet(); }
  }
  else if(view==='detail'){
    const s = getSet(currentSetId);
    if(!s || detailMenuOpen || editingTermId) return;
    if(key==='e'){ go('editor'); return; }
    if(s.terms.length===0) return;
    if(e.code==='Space'){ e.preventDefault(); togglePreviewFlip(); }
    else if(key==='ArrowRight'){ previewNext(); }
    else if(key==='ArrowLeft'){ previewPrev(); }
    else if(key==='f'){ go('flashcards'); }
    else if(key==='l'){ go('learn'); }
    else if(key==='t'){ go('test-setup'); }
    else if(key==='r' && dueTermIds(s).length){ startDueReview(); }
    else if(key==='s'){ const t = s.terms[previewIndex]; if(t) speak(t.term, 'en-US'); }
  }
  else if(view==='flashcards'){
    if(session.optionsOpen) return;
    if(e.code==='Space' || key==='ArrowUp' || key==='ArrowDown'){ e.preventDefault(); fcFlip(); }
    else if(key==='ArrowRight'){ fcKeyMark(true); }
    else if(key==='ArrowLeft'){ fcKeyMark(false); }
    else if(key==='1'){ fcMark(false); }
    else if(key==='2' || key==='3'){ fcMark(true); }
    else if(key==='z' || key==='Backspace'){ e.preventDefault(); if(session.history.length) fcUndo(); }
    else if(key==='s'){
      const s = getSet(currentSetId);
      const term = s && s.terms.find(t=>t.id===session.order[session.idx]);
      if(term) speak(session.flipped ? term.definition : term.term, 'en-US');
    }
    else if(key==='o'){ fcOpenOptions(); }
  }
  else if(view==='learn' && session.currentQ && !session.settingsOpen){
    const q = session.currentQ;
    // written answer waiting for the learner's own verdict: 1 = wrong, 2 = right,
    // Enter = take the highlighted (suggested) choice
    if(session.judging && (key==='1' || key==='2' || key==='Enter')){
      e.preventDefault();
      learnJudge(key==='Enter' ? !!session.suggested : key==='2');
      return;
    }
    if(session.judging && e.code==='Space'){ e.preventDefault(); return; }
    if(!session.answered && q.options && /^[1-9]$/.test(key)){
      const opt = q.options[Number(key) - 1];
      if(opt !== undefined){ e.preventDefault(); learnAnswer(opt); }
    }
    else if(session.answered && (key==='Enter' || e.code==='Space')){ e.preventDefault(); learnNext(); }
    else if(!session.answered && key==='?'){ learnDontKnow(); }
    else if(key==='s'){ speak(q.term.term, 'en-US'); }
  }
  else if(view==='test-setup'){
    if(key==='Enter'){ e.preventDefault(); startTest(); }
  }
  else if(view==='results'){
    if(key==='r' && (session.retryIds||[]).length){ retryMissed(); }
    else if(key==='Enter'){ e.preventDefault(); go('detail'); }
  }
});

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  window.deferredPrompt = e;
  const installBtn = document.getElementById('installAppBtn');
  if(installBtn) installBtn.style.display = 'inline-block';
});

window.installPWA = function() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        const installBtn = document.getElementById('installAppBtn');
        if(installBtn) installBtn.style.display = 'none';
      }
      deferredPrompt = null; window.deferredPrompt = null;
    });
  }
};

/* =========================================================
   INIT
========================================================= */
(async function init(){
  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (e) {
      console.log('Service Worker registration failed: ', e);
    }
  }

  initPage(window.DEFAULT_VIEW || 'home');
  if(SETS.length===0 && baseSets.length===0){
    // seed a starter example set so the app isn't empty on first run
    // (fixed ids, so two devices that both seed it merge into one set)
    SETS.push({
      id: 'sample-set',
      title: 'Sample Vocabulary',
      terms: [
        {id:'sample-1', term:'accommodation', definition:'Chỗ ở'},
        {id:'sample-2', term:'priority', definition:'Sự ưu tiên'},
        {id:'sample-3', term:'advantage', definition:'Lợi thế'},
        {id:'sample-4', term:'competition', definition:'Cuộc thi'},
        {id:'sample-5', term:'interesting', definition:'Thú vị'}
      ]
    });
    saveSets(SETS);
  }
  render();
})();
