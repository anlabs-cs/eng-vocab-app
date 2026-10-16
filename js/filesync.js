/* =========================================================
   FILE-BASED STORAGE (File System Access API)
   Lets the user pick/create a real .json file on disk; the app
   reads from it on connect and writes to it on every change.
   Falls back to manual download/upload on browsers without
   support (Firefox, Safari).
========================================================= */
const FS_SUPPORTED = typeof window.showOpenFilePicker === 'function';
let fileHandle = null;
let fileName = null;
let fileSyncStatus = 'none'; // none | connected | needs-permission | saving | error | unsupported

const IDB_NAME = 'vocabapp-db';
const IDB_STORE = 'kv';
function idbOpen(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = ()=>{ req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
async function idbSet(key, val){
  const db = await idbOpen();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(IDB_STORE,'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  });
}
async function idbGet(key){
  const db = await idbOpen();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(IDB_STORE,'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}

async function verifyPermission(handle){
  const opts = {mode:'readwrite'};
  if((await handle.queryPermission(opts))==='granted') return true;
  if((await handle.requestPermission(opts))==='granted') return true;
  return false;
}

/* Accepts every format we have ever written: a bare array (v1),
   {sets:[...]} (v2 file / backup). Always returns migrated sets. */
function parseDataPayload(text){
  const parsed = JSON.parse(text);
  if(Array.isArray(parsed)) return { sets: migrateSets(parsed) };
  if(parsed && Array.isArray(parsed.sets)){
    return { sets: migrateSets(parsed.sets), streak: parsed.streak || null, version: parsed.version || 1 };
  }
  throw new Error('unexpected shape');
}
function parseSetsPayload(text){ return parseDataPayload(text).sets; }

async function useFileHandle(handle){
  const ok = await verifyPermission(handle);
  if(!ok){ alert('The browser denied access to the file.'); return; }
  fileHandle = handle;
  fileName = handle.name;
  const file = await handle.getFile();
  const text = await file.text();
  if(text.trim()){
    try{
      SETS = parseSetsPayload(text);
    }catch(e){
      alert('This JSON file is not in the expected vocabulary set format.');
      fileHandle = null; fileName = null; fileSyncStatus='none';
      return;
    }
  } else {
    await writeCurrentDataToFile();
  }
  saveSetsLocal(SETS);
  await idbSet('fileHandle', handle);
  fileSyncStatus = 'connected';
  currentSetId = SETS[0] ? SETS[0].id : null;
  go('home');
}

async function connectExistingFile(){
  if(!FS_SUPPORTED) return;
  try{
    const [handle] = await window.showOpenFilePicker({
      types:[{description:'Vocab JSON', accept:{'application/json':['.json']}}]
    });
    if(SETS.length>0){
      const ok = confirm('Opening this file will replace the currently displayed data with its contents. Continue?');
      if(!ok) return;
    }
    await useFileHandle(handle);
  }catch(e){ if(e.name!=='AbortError') console.error(e); }
}

async function createNewFile(){
  if(!FS_SUPPORTED) return;
  try{
    const handle = await window.showSaveFilePicker({
      suggestedName:'vocabulary.json',
      types:[{description:'Vocab JSON', accept:{'application/json':['.json']}}]
    });
    fileHandle = handle;
    fileName = handle.name;
    await idbSet('fileHandle', handle);
    await writeCurrentDataToFile();
    fileSyncStatus = 'connected';
    render();
  }catch(e){ if(e.name!=='AbortError') console.error(e); }
}

async function reconnectFile(){
  if(!fileHandle) return;
  const perm = await fileHandle.requestPermission({mode:'readwrite'});
  if(perm==='granted'){
    try{
      const file = await fileHandle.getFile();
      const text = await file.text();
      if(text.trim()) SETS = parseSetsPayload(text);
      saveSetsLocal(SETS);
      fileSyncStatus = 'connected';
      if(!getSet(currentSetId)) currentSetId = SETS[0] ? SETS[0].id : null;
      go('home');
    }catch(e){
      console.error(e);
      alert('Could not read the file. Try connecting a different file.');
    }
  }
}

let pendingWrite = Promise.resolve();
function writeCurrentDataToFile(){
  pendingWrite = pendingWrite.then(doWriteFile);
  return pendingWrite;
}
async function doWriteFile(){
  if(!fileHandle) return;
  try{
    fileSyncStatus = 'saving';
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(dataFilePayload(SETS), null, 2));
    await writable.close();
    fileSyncStatus = 'connected';
  }catch(e){
    console.error(e);
    fileSyncStatus = 'error';
  }
}

async function tryAutoReconnect(){
  if(!FS_SUPPORTED){ fileSyncStatus = 'unsupported'; return; }
  try{
    const handle = await idbGet('fileHandle');
    if(!handle){ fileSyncStatus = 'none'; return; }
    fileHandle = handle;
    fileName = handle.name;
    const perm = await handle.queryPermission({mode:'readwrite'});
    if(perm==='granted'){
      const file = await handle.getFile();
      const text = await file.text();
      if(text.trim()) SETS = parseSetsPayload(text);
      saveSetsLocal(SETS);
      fileSyncStatus = 'connected';
      if(!getSet(currentSetId)) currentSetId = SETS[0] ? SETS[0].id : null;
      render();
    } else {
      fileSyncStatus = 'needs-permission';
      render();
    }
  }catch(e){
    console.error(e);
    fileSyncStatus = 'none';
  }
}

/* ---------------------------------------------------------
   BACKUP / RESTORE / MERGE IMPORT (works in every browser)
   - Backup: downloads the whole library + streak as one .json
   - Import (merge): adds sets from a .json (a shared set, a friend's
     library, an old backup) without touching what you already have
   - Restore (replace): overwrites everything with a backup
--------------------------------------------------------- */
function downloadJson(obj, name){
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function downloadBackup(){
  const payload = Object.assign(dataFilePayload(SETS), { streak: getStreak() });
  downloadJson(payload, 'engvocab-backup-' + todayStr() + '.json');
}

/* Merge rule: a set whose id we don't have is added. A set we already have
   gets any terms it is missing (by id); existing terms keep your progress. */
function mergeSets(incoming){
  let added = 0, updated = 0;
  incoming.forEach(inc=>{
    const mine = getSet(inc.id);
    if(!mine){ SETS.unshift(inc); added++; return; }
    const have = new Set(mine.terms.map(t=>t.id));
    const extra = inc.terms.filter(t=>!have.has(t.id));
    if(extra.length){ mine.terms = mine.terms.concat(extra); updated++; }
  });
  return {added, updated};
}

let pendingImportMode = 'merge';
function pickDataFile(mode){
  pendingImportMode = mode;
  const el = document.getElementById('dataFileInput');
  if(el) el.click();
}
function onDataFilePicked(evt){
  const file = evt.target.files[0];
  evt.target.value = '';
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    let data;
    try{ data = parseDataPayload(reader.result); }
    catch(e){ alert('This file is not a valid EngVocab .json file.'); return; }
    if(pendingImportMode === 'replace'){
      if(!confirm('Replace ALL your sets with the ' + data.sets.length + ' set(s) in this backup? This cannot be undone.')) return;
      SETS = data.sets;
      if(data.streak) saveStreak(data.streak);
      if(!getSet(currentSetId)) currentSetId = SETS[0] ? SETS[0].id : null;
      saveSets(SETS);
      alert('Restored ' + SETS.length + ' set(s).');
    } else {
      const r = mergeSets(data.sets);
      saveSets(SETS);
      alert('Added ' + r.added + ' new set(s)' + (r.updated ? ', added new terms to ' + r.updated + ' existing set(s)' : '') + '.');
    }
    closeDataMenu();
    go('home');
  };
  reader.readAsText(file);
}
