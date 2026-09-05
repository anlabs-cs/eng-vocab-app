/* keyboard shortcuts */
document.addEventListener('keydown', (e)=>{
  if(view==='flashcards'){
    if(e.code==='Space'){ e.preventDefault(); fcFlip(); }
    else if(e.key==='ArrowRight'){ fcNext(); }
    else if(e.key==='ArrowLeft'){ fcPrev(); }
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
  if(SETS.length===0){
    // seed a starter example set so the app isn't empty on first run
    SETS.push({
      id: uid(),
      title: 'từ vựng mẫu',
      terms: [
        {id:uid(), term:'accommodation', definition:'chỗ ở'},
        {id:uid(), term:'priority', definition:'ưu tiên'},
        {id:uid(), term:'advantage', definition:'lợi thế'},
        {id:uid(), term:'competition', definition:'cạnh tranh'},
        {id:uid(), term:'interesting', definition:'thú vị'}
      ]
    });
    saveSetsLocal(SETS);
  }
  render();
  await tryAutoReconnect(); // if a file was connected before, try to reattach to it
})();
