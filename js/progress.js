/* =========================================================
   PROGRESS & STREAK
========================================================= */
const STREAK_KEY = 'vocabapp_streak_v1';

function todayStr(d){
  d = d || new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function loadStreak(){
  try{
    const raw = localStorage.getItem(STREAK_KEY);
    return raw ? JSON.parse(raw) : {lastDate:null, current:0, longest:0};
  }catch(e){ return {lastDate:null, current:0, longest:0}; }
}
function saveStreak(s){ localStorage.setItem(STREAK_KEY, JSON.stringify(s)); }

function recordStudyActivity(){
  const s = loadStreak();
  const today = todayStr();
  if(s.lastDate !== today){
    const yesterday = new Date(Date.now() - 86400000);
    if(s.lastDate === todayStr(yesterday)) s.current += 1;
    else s.current = 1;
    s.lastDate = today;
    if(s.current > s.longest) s.longest = s.current;
    saveStreak(s);
  }
}
function getStreak(){ return loadStreak(); }

function setTermMastery(setId, termId, mastered){
  const s = getSet(setId);
  if(!s) return;
  const t = s.terms.find(x=>x.id===termId);
  if(!t) return;
  t.mastered = !!mastered;
  saveSets(SETS);
}
function setMasteryStats(s){
  const total = s.terms.length;
  const mastered = s.terms.filter(t=>t.mastered).length;
  const pct = total ? Math.round(mastered/total*100) : 0;
  return {total, mastered, pct};
}

/* =========================================================
   TEXT-TO-SPEECH (Web Speech API — có sẵn trong trình duyệt)
========================================================= */
const TTS_SUPPORTED = 'speechSynthesis' in window;
function speak(text, lang){
  if(!TTS_SUPPORTED || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang || 'en-US';
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}
