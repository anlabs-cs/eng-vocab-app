/* =========================================================
   DATA LAYER
========================================================= */
const STORAGE_KEY = 'vocabapp_sets_v1';

/* Terms may carry pos / phonetic / example and spaced-repetition fields
   (box, due, lastReviewed). migrateSets() upgrades older data and repairs
   missing fields. */
function migrateSets(sets){
  if(!Array.isArray(sets)) return [];
  return sets.filter(s => s && typeof s === 'object').map(s => {
    const set = Object.assign({}, s);
    set.id = String(set.id || uid());
    set.title = String(set.title ?? '');
    // legacy data has no updatedAt: fall back to the best timestamp we have
    const stamp = Number(set.createdAt || set.lastOpened || 0) || 0;
    set.updatedAt = Number(set.updatedAt) > 0 ? Number(set.updatedAt) : stamp;
    if(set.deleted) set.deleted = true; else delete set.deleted;
    set.terms = (Array.isArray(set.terms) ? set.terms : [])
      .filter(t => t && typeof t === 'object')
      .map(t => {
        const term = Object.assign({}, t);
        term.id = String(term.id || uid());
        term.term = String(term.term ?? '');
        term.definition = String(term.definition ?? '');
        term.updatedAt = Number(term.updatedAt) > 0 ? Number(term.updatedAt) : stamp;
        if(term.deleted) term.deleted = true; else delete term.deleted;
        for(const k of ['pos','phonetic','example']){
          if(term[k] == null || term[k] === '') delete term[k];
          else term[k] = String(term[k]);
        }
        return term;
      });
    return set;
  });
}

/* ---------------------------------------------------------
   SOFT DELETE + CHANGE TRACKING
   Storage (localStorage and the Google Drive file) holds the FULL list:
   deleted sets/terms stay in it as tombstones ({deleted:true, updatedAt})
   so a deletion can sync to other devices instead of "coming back to life".
   The rest of the app only ever sees SETS, the live view (no tombstones),
   so no view needs to filter. saveSets() diffs SETS against the last
   persisted full list (baseSets): changed items get updatedAt = now,
   items that vanished become tombstones.
--------------------------------------------------------- */
function cloneJson(o){ return JSON.parse(JSON.stringify(o)); }

function liveSets(all){
  return cloneJson(all)
    .filter(s => !s.deleted)
    .map(s => { s.terms = s.terms.filter(t => !t.deleted); return s; });
}

// stable, key-order independent serialisation (for comparing data)
function canonJson(v){
  if(Array.isArray(v)) return '[' + v.map(canonJson).join(',') + ']';
  if(v && typeof v === 'object'){
    return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined)
      .map(k => JSON.stringify(k) + ':' + canonJson(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}
function canonWithout(o, ignore){
  const r = {};
  Object.keys(o).forEach(k => { if(!ignore.includes(k)) r[k] = o[k]; });
  return canonJson(r);
}
const SET_IGNORED_FIELDS = ['terms', 'updatedAt', 'lastOpened']; // opening a set must not count as an edit
const TERM_IGNORED_FIELDS = ['updatedAt'];

function reconcileSets(live, base, now){
  const baseById = new Map(base.map(s => [s.id, s]));
  const out = [];
  const seen = new Set();
  live.forEach(s => {
    seen.add(s.id);
    const prev = baseById.get(s.id);
    const prevTerms = new Map(prev ? prev.terms.map(t => [t.id, t]) : []);
    const terms = [];
    const seenTerms = new Set();
    s.terms.forEach(t => {
      seenTerms.add(t.id);
      const pt = prevTerms.get(t.id);
      const same = pt && !pt.deleted && canonWithout(pt, TERM_IGNORED_FIELDS) === canonWithout(t, TERM_IGNORED_FIELDS);
      t.updatedAt = same ? pt.updatedAt : now;
      delete t.deleted;
      terms.push(t);
    });
    prevTerms.forEach(pt => {
      if(seenTerms.has(pt.id)) return;
      terms.push(pt.deleted ? pt : { id: pt.id, term: '', definition: '', deleted: true, updatedAt: now });
    });
    const sameMeta = prev && !prev.deleted && canonWithout(prev, SET_IGNORED_FIELDS) === canonWithout(s, SET_IGNORED_FIELDS);
    s.updatedAt = sameMeta ? prev.updatedAt : now;
    delete s.deleted;
    out.push(Object.assign({}, s, { terms }));
  });
  base.forEach(b => {
    if(seen.has(b.id)) return;
    out.push(b.deleted ? b : { id: b.id, title: '', terms: [], deleted: true, updatedAt: now });
  });
  return out;
}

/* Pure merge of two FULL lists (tombstones included), by id.
   The side with the larger updatedAt wins (tombstones too); on a tie the
   remote wins. Sets are matched by id, and so are terms inside a set. */
function mergeSets(local, remote){
  const newer = (a, b) => (Number(b.updatedAt) || 0) >= (Number(a.updatedAt) || 0) ? b : a;
  const entries = new Map();
  (local || []).forEach(s => entries.set(s.id, { l: s }));
  (remote || []).forEach(s => {
    const e = entries.get(s.id);
    if(e) e.r = s; else entries.set(s.id, { r: s });
  });
  const mergeTerms = (lt, rt) => {
    const terms = new Map();
    (lt || []).forEach(t => terms.set(t.id, t));
    (rt || []).forEach(t => {
      const mine = terms.get(t.id);
      terms.set(t.id, mine ? newer(mine, t) : t);
    });
    return Array.from(terms.values());
  };
  return Array.from(entries.values()).map(({ l, r }) => {
    if(!l) return cloneJson(r);
    if(!r) return cloneJson(l);
    const merged = cloneJson(newer(l, r));
    merged.terms = cloneJson(mergeTerms(l.terms, r.terms));
    return merged;
  });
}

/* Streak: the newest lastDate wins (tie: remote), longest is the max. */
function mergeStreak(local, remote){
  const l = local || {}, r = remote || {};
  const win = (r.lastDate || '') >= (l.lastDate || '') ? r : l;
  const current = win.current || 0;
  return {
    lastDate: win.lastDate || null,
    current,
    longest: Math.max(l.longest || 0, r.longest || 0, current)
  };
}

function loadAllSets(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrateSets(JSON.parse(raw)) : [];
  }catch(e){ return []; }
}

let baseSets = loadAllSets();   // full list incl. tombstones, as last persisted
let SETS = liveSets(baseSets);  // what the app works with

/* Persist SETS (diffing it against baseSets). */
function saveSets(sets){
  const next = reconcileSets(sets, baseSets, Date.now());
  const strip = list => canonJson(list.map(s => { const c = Object.assign({}, s); delete c.lastOpened; return c; }));
  const changed = strip(next) !== strip(baseSets);
  baseSets = cloneJson(next);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(baseSets));
  if(changed && typeof driveMarkDirty === 'function') driveMarkDirty();
}
/* Replace everything with an already-merged full list (used by Drive sync). */
function applyMergedSets(merged){
  baseSets = cloneJson(merged);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(baseSets));
  SETS = liveSets(baseSets);
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
  'flashcards': 'detail.html',
  'learn': 'detail.html',
  'test-setup': 'detail.html',
  'test': 'detail.html'
};
const NAV_STORAGE_KEY = 'vocabapp_nav_v1';
const CURRENT_SET_KEY = 'vocabapp_current_set_v1';

function currentPageFile(){
  return location.pathname.split('/').pop() || 'index.html';
}

// 'results' is one view name shared by 3 different modes; it lives on
// whichever page produced it (flashcard/learn/test), not a page of its own.
function pageForView(v, extra){
  if(v === 'results') return 'detail.html';
  return PAGE_FOR_VIEW[v] || 'index.html';
}

function go(v, extra){
  view = v;
  session = extra || {};
  const targetPage = pageForView(v, extra);

  if(targetPage !== currentPageFile()){
    // hop to a different page: hand off state via sessionStorage + the URL
    if(typeof driveAllowNavigation === 'function') driveAllowNavigation();
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
