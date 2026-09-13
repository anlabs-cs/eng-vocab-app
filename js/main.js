/* keyboard shortcuts */
document.addEventListener('keydown', (e)=>{
  if(view==='flashcards'){
    if(e.code==='Space'){ e.preventDefault(); fcFlip(); }
    else if(e.key==='ArrowRight'){ fcKeyMark(true); }
    else if(e.key==='ArrowLeft'){ fcKeyMark(false); }
    else if(e.key==='1'){ fcMark(false); }
    else if(e.key==='2' || e.key==='3'){ fcMark(true); }
  }
  else if(view==='detail'){
    const s = getSet(currentSetId);
    if(s && s.terms.length>0 && document.activeElement.tagName!=='INPUT'){
      if(e.code==='Space'){ e.preventDefault(); togglePreviewFlip(); }
      else if(e.key==='ArrowRight'){ previewNext(); }
      else if(e.key==='ArrowLeft'){ previewPrev(); }
    }
  }
});

/* =========================================================
   INIT
========================================================= */
(async function init(){
  initPage(window.DEFAULT_VIEW || 'home');
  if(SETS.length===0){
    // seed a starter example set so the app isn't empty on first run
    SETS.push({
      id: uid(),
      title: 'Sample Vocabulary',
      terms: [
        {id:uid(), term:'accommodation', definition:'Chỗ ở'},
        {id:uid(), term:'priority', definition:'Sự ưu tiên'},
        {id:uid(), term:'advantage', definition:'Lợi thế'},
        {id:uid(), term:'competition', definition:'Cuộc thi'},
        {id:uid(), term:'interesting', definition:'Thú vị'}
      ]
    });
    saveSetsLocal(SETS);
  }
  render();
  await tryAutoReconnect(); // if a file was connected before, try to reattach to it
})();
