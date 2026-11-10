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
function saveStreak(s){
  localStorage.setItem(STREAK_KEY, JSON.stringify(s));
  if(typeof driveMarkDirty === 'function') driveMarkDirty();
}

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

/* ---------------------------------------------------------
   SPACED REPETITION (Leitner boxes)
   Each studied term has box 0..6 and a due date (YYYY-MM-DD).
   Correct answer on a due term -> next box, due again after
   SRS_INTERVALS[box] days. Wrong answer -> box 0, due today.
   Answering a term correctly again before it is due does not
   push it further (no cheating by repeating a set 5x a day).
--------------------------------------------------------- */
const SRS_INTERVALS = [0, 1, 2, 4, 8, 16, 32]; // days, indexed by box
const SRS_MAX_BOX = SRS_INTERVALS.length - 1;

function addDays(dateStr, n){
  const [y,m,d] = dateStr.split('-').map(Number);
  return todayStr(new Date(y, m-1, d + n));
}
function isTermDue(t, today){
  return !!t.due && t.due <= (today || todayStr());
}
function srsSchedule(t, correct){
  const today = todayStr();
  const box = Number.isInteger(t.box) ? t.box : 0;
  if(!correct){
    t.box = 0;
    t.due = today;
  } else if(!t.due || t.due <= today){
    t.box = Math.min(box + 1, SRS_MAX_BOX);
    t.due = addDays(today, SRS_INTERVALS[t.box]);
  }
  t.lastReviewed = today;
}

function termSnapshot(t){
  return { mastered: t.mastered, box: t.box, due: t.due, lastReviewed: t.lastReviewed };
}

/* Record one answer for a term: updates "Know" flag + SRS schedule.
   Returns the term's previous state so callers (flashcard Undo) can restore it. */
function setTermMastery(setId, termId, mastered){
  const s = getSet(setId);
  if(!s) return null;
  const t = s.terms.find(x=>x.id===termId);
  if(!t) return null;
  const prev = termSnapshot(t);
  t.mastered = !!mastered;
  srsSchedule(t, !!mastered);
  saveSets(SETS);
  return prev;
}
function restoreTermState(setId, termId, snap){
  const s = getSet(setId);
  const t = s && s.terms.find(x=>x.id===termId);
  if(!t || !snap) return;
  for(const k of ['mastered','box','due','lastReviewed']){
    if(snap[k] === undefined) delete t[k]; else t[k] = snap[k];
  }
  saveSets(SETS);
}

function dueTermIds(s){
  const today = todayStr();
  return s.terms.filter(t=>isTermDue(t, today)).map(t=>t.id);
}
function totalDueCount(){
  return SETS.reduce((n,s)=>n + dueTermIds(s).length, 0);
}
function setMasteryStats(s){
  const total = s.terms.length;
  const mastered = s.terms.filter(t=>t.mastered).length;
  const pct = total ? Math.round(mastered/total*100) : 0;
  return {total, mastered, pct};
}

/* =========================================================
   TEXT-TO-SPEECH (Web Speech API — built into the browser)
========================================================= */
const TTS_SUPPORTED = 'speechSynthesis' in window;
// Keep a reference to the latest utterance: Chrome can garbage-collect an
// utterance that nothing references, which silently cuts off speech.
let _ttsCurrent = null;

function pickVoice(lang){
  const voices = window.speechSynthesis.getVoices() || [];
  const base = lang.split('-')[0].toLowerCase();
  const matches = v => (v.lang || '').toLowerCase().startsWith(base);
  // Local voices start speaking immediately; network voices (e.g. Chrome's
  // "Google ..." voices) can take 1-2s to start, so prefer local ones.
  return voices.find(v => v.lang === lang && v.localService)
      || voices.find(v => matches(v) && v.localService)
      || voices.find(v => v.lang === lang)
      || voices.find(matches)
      || null;
}

function speak(text, lang){
  if(!TTS_SUPPORTED || !text) return;
  const synth = window.speechSynthesis;
  try{
    // Only cancel when something is actually queued/playing; calling cancel()
    // on an idle engine can add startup delay on some browsers.
    if(synth.speaking || synth.pending) synth.cancel();
    // Chrome can get stuck in a paused state, which makes every speak() a no-op.
    if(synth.paused) synth.resume();

    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = lang || 'en-US';
    u.rate = 0.95;
    const voice = pickVoice(u.lang);
    if(voice) u.voice = voice;
    u.onerror = e => {
      if(e.error !== 'interrupted' && e.error !== 'canceled')
        console.warn('Speech error:', e.error);
    };
    _ttsCurrent = u;

    // Chrome drops an utterance queued in the same tick as cancel(), so defer it.
    // If another speak() came in meanwhile, skip this one (only the latest plays).
    setTimeout(() => {
      if(_ttsCurrent === u) synth.speak(u);
    }, 0);
  }catch(err){
    console.warn('Text-to-speech failed:', err);
  }
}