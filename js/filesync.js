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

function parseSetsPayload(text){
  const parsed = JSON.parse(text);
  if(Array.isArray(parsed)) return parsed;
  if(parsed && Array.isArray(parsed.sets)) return parsed.sets;
  throw new Error('unexpected shape');
}

async function useFileHandle(handle){
  const ok = await verifyPermission(handle);
  if(!ok){ alert('Trình duyệt từ chối quyền truy cập file.'); return; }
  fileHandle = handle;
  fileName = handle.name;
  const file = await handle.getFile();
  const text = await file.text();
  if(text.trim()){
    try{
      SETS = parseSetsPayload(text);
    }catch(e){
      alert('File JSON này không đúng định dạng bộ từ vựng.');
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
      const ok = confirm('Mở file này sẽ thay thế dữ liệu đang hiển thị bằng nội dung của file đã chọn. Tiếp tục?');
      if(!ok) return;
    }
    await useFileHandle(handle);
  }catch(e){ if(e.name!=='AbortError') console.error(e); }
}

async function createNewFile(){
  if(!FS_SUPPORTED) return;
  try{
    const handle = await window.showSaveFilePicker({
      suggestedName:'tu-vung.json',
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
      currentSetId = SETS[0] ? SETS[0].id : currentSetId;
      go('home');
    }catch(e){
      console.error(e);
      alert('Không đọc được file. Hãy thử kết nối lại file khác.');
    }
  }
}

async function writeCurrentDataToFile(){
  if(!fileHandle) return;
  try{
    fileSyncStatus = 'saving';
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(SETS, null, 2));
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
      currentSetId = SETS[0] ? SETS[0].id : null;
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

/* ---- Fallback for browsers without File System Access API ---- */
function exportJsonFallback(){
  const blob = new Blob([JSON.stringify(SETS, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = (fileName || 'tu-vung') + (String(fileName).endsWith('.json')?'':'.json');
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function importJsonFallbackTrigger(){
  const el = document.getElementById('importFileInput');
  if(el) el.click();
}
function importJsonFallbackChange(evt){
  const file = evt.target.files[0];
  if(!file) return;
  if(SETS.length>0){
    const ok = confirm('Nhập file này sẽ thay thế dữ liệu đang hiển thị. Tiếp tục?');
    if(!ok){ evt.target.value=''; return; }
  }
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      SETS = parseSetsPayload(reader.result);
      saveSetsLocal(SETS);
      fileName = file.name;
      currentSetId = SETS[0] ? SETS[0].id : null;
      go('home');
    }catch(e){ alert('File JSON không hợp lệ.'); }
  };
  reader.readAsText(file);
  evt.target.value = '';
}
