/* =========================================================
   DATA LAYER
========================================================= */
const STORAGE_KEY = 'vocabapp_sets_v1';

function loadSets(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveSetsLocal(sets){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}
function saveSets(sets){
  saveSetsLocal(sets);
  if(fileHandle){ writeCurrentDataToFile(); } // fire-and-forget, keeps JSON file in sync
}
function uid(){
  return Math.random().toString(36).slice(2,10) + Date.now().toString(36);
}
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

let SETS = loadSets();
let currentSetId = null;

/* =========================================================
   ROUTER STATE
   The app is now split across several real HTML pages instead of
   one single-page app. Each page still uses the same `view` /
   `session` globals and the same `render()` dispatcher as before,
   but `go()` will do a real page navigation (with the set id kept
   in the URL) whenever the target view lives on a different page.
========================================================= */
let view = 'home'; // home | detail | editor | flashcards | learn | test | test-setup | results
let session = {}; // transient state for study modes

const root = document.getElementById('app');

function getSet(id){ return SETS.find(s=>s.id===id); }

// which .html file each view lives on
const PAGE_FOR_VIEW = {
  'home': 'index.html',
  'detail': 'detail.html',
  'editor': 'detail.html',
  'flashcards': 'flashcard.html',
  'learn': 'learn.html',
  'test-setup': 'test.html',
  'test': 'test.html'
};
const NAV_STORAGE_KEY = 'vocabapp_nav_v1';
const CURRENT_SET_KEY = 'vocabapp_current_set_v1';

function currentPageFile(){
  return location.pathname.split('/').pop() || 'index.html';
}

// 'results' is one view name shared by 3 different modes; it lives on
// whichever page produced it (flashcard/learn/test), not a page of its own.
function pageForView(v, extra){
  if(v === 'results'){
    const mode = extra && extra.mode;
    if(mode === 'flashcards') return 'flashcard.html';
    if(mode === 'learn') return 'learn.html';
    if(mode === 'test') return 'test.html';
    return 'detail.html';
  }
  return PAGE_FOR_VIEW[v] || 'index.html';
}

function go(v, extra){
  view = v;
  session = extra || {};
  const targetPage = pageForView(v, extra);

  if(targetPage !== currentPageFile()){
    // hop to a different page: hand off state via sessionStorage + the URL
    try{ sessionStorage.setItem(NAV_STORAGE_KEY, JSON.stringify({view, session})); }catch(e){}
    if(currentSetId){ try{ localStorage.setItem(CURRENT_SET_KEY, currentSetId); }catch(e){} }
    const url = new URL(targetPage, location.href);
    if(currentSetId) url.searchParams.set('set', currentSetId);
    location.href = url.toString();
    return;
  }

  // staying on the same page: just keep the URL's ?set= in sync (bookmarking/back button friendly)
  if(currentSetId){
    const url = new URL(location.href);
    url.searchParams.set('set', currentSetId);
    history.replaceState(null, '', url.toString());
  }
  render();
  window.scrollTo(0,0);
}

/* Called once by each page on load: figures out currentSetId (from the
   URL, falling back to the last one used) and restores view/session if
   we just navigated here from another page, otherwise falls back to
   defaultView (the view this particular HTML page normally shows). */
function initPage(defaultView){
  const params = new URLSearchParams(location.search);
  const urlSet = params.get('set');
  if(urlSet){
    currentSetId = urlSet;
  } else {
    try{
      const saved = localStorage.getItem(CURRENT_SET_KEY);
      if(saved) currentSetId = saved;
    }catch(e){}
  }

  let nav = null;
  try{
    const raw = sessionStorage.getItem(NAV_STORAGE_KEY);
    if(raw){
      nav = JSON.parse(raw);
      sessionStorage.removeItem(NAV_STORAGE_KEY);
    }
  }catch(e){}

  if(nav && pageForView(nav.view, nav.session) === currentPageFile()){
    view = nav.view;
    session = nav.session || {};
  } else {
    view = defaultView;
    session = {};
  }
}
