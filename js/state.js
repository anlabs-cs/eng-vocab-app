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
========================================================= */
let view = 'home'; // home | detail | editor | flashcards | learn | test | test-setup | results
let session = {}; // transient state for study modes

const root = document.getElementById('app');

function getSet(id){ return SETS.find(s=>s.id===id); }

function go(v, extra){
  view = v;
  session = extra || {};
  render();
  window.scrollTo(0,0);
}
