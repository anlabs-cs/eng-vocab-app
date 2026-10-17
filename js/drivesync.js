/* =========================================================
   GOOGLE DRIVE SYNC (appDataFolder)
   Signs in with Google Identity Services and keeps one file,
   engvocab.json, in the app's hidden Drive folder. Local data
   (localStorage) stays the source the app runs on; this module
   only merges with the Drive copy. Everything is best-effort:
   signed out or offline, the app works as before.
========================================================= */
const GOOGLE_CLIENT_ID = 'DAN_CLIENT_ID_VAO_DAY';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_FILE_NAME = 'engvocab.json';
const DRIVE_META_KEY = 'vocabapp_drive_v1';          // localStorage: {linked,email,fileId,lastSavedAt,autosave,dirty,dirtySince}
const DRIVE_TOKEN_KEY = 'vocabapp_drive_token_v1';   // sessionStorage: {token,expiresAt}
const DRIVE_SYNCED_KEY = 'vocabapp_drive_synced_v1'; // sessionStorage: full sync already done this session
const DRIVE_DEBOUNCE_MS = 5000;
const DRIVE_MAX_WAIT_MS = 60000;
const DRIVE_RETRY_MS = 30000;
const DRIVE_KEEPALIVE_LIMIT = 60 * 1024; // keepalive requests are capped at ~64KB

const DriveSync = (function(){
  let status = 'idle'; // idle | syncing | saved | unsynced | signedout | error
  let needsRelogin = false;
  let busy = false;
  let rerun = false;
  let localRev = 0;
  let autosaveTimer = null;
  let retryTimer = null;
  let tokenClient = null;
  let tokenWaiter = null;
  let skipUnloadWarning = false;

  /* ---------- small state helpers ---------- */
  function loadMeta(){
    try{ return Object.assign({ autosave: true }, JSON.parse(localStorage.getItem(DRIVE_META_KEY) || '{}')); }
    catch(e){ return { autosave: true }; }
  }
  function saveMeta(patch){
    try{ localStorage.setItem(DRIVE_META_KEY, JSON.stringify(Object.assign(loadMeta(), patch))); }catch(e){}
  }
  function ss(key, val){
    try{
      if(val === undefined) return sessionStorage.getItem(key);
      if(val === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, val);
    }catch(e){}
    return null;
  }
  function configured(){ return GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'DAN_CLIENT_ID_VAO_DAY'; }
  function isLinked(){ return !!loadMeta().linked; }

  function setStatus(next, relogin){
    needsRelogin = !!relogin;
    status = next;
    refreshUi();
  }

  /* ---------- auth ---------- */
  function storedToken(){
    try{
      const t = JSON.parse(ss(DRIVE_TOKEN_KEY) || 'null');
      if(t && t.token && t.expiresAt > Date.now() + 30000) return t.token;
    }catch(e){}
    return null;
  }

  function waitForGis(ms){
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function check(){
        if(window.google && google.accounts && google.accounts.oauth2) return resolve();
        if(Date.now() - t0 > (ms || 10000)) return reject(new Error('gis unavailable'));
        setTimeout(check, 200);
      })();
    });
  }

  function ensureTokenClient(){
    if(tokenClient) return tokenClient;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: resp => {
        const w = tokenWaiter; tokenWaiter = null;
        if(!w) return;
        if(!resp || resp.error || !resp.access_token) return w.reject(new Error((resp && resp.error) || 'no token'));
        ss(DRIVE_TOKEN_KEY, JSON.stringify({
          token: resp.access_token,
          expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000 - 60000
        }));
        w.resolve(resp.access_token);
      },
      error_callback: err => {
        const w = tokenWaiter; tokenWaiter = null;
        if(w) w.reject(new Error((err && err.type) || 'auth error'));
      }
    });
    return tokenClient;
  }

  // prompt: '' = silent when the user already consented, 'consent' = force the dialog
  function requestToken(prompt){
    return new Promise((resolve, reject) => {
      waitForGis().then(() => {
        const client = ensureTokenClient();
        tokenWaiter = { resolve, reject };
        setTimeout(() => {
          if(tokenWaiter && tokenWaiter.resolve === resolve){ tokenWaiter = null; reject(new Error('auth timeout')); }
        }, 20000);
        client.requestAccessToken({ prompt });
      }).catch(reject);
    });
  }

  async function getToken(){
    const t = storedToken();
    if(t) return t;
    return requestToken(''); // silent refresh; rejects if the user must sign in again
  }

  async function authFetch(url, opts, retried){
    const token = await getToken();
    const headers = Object.assign({}, opts && opts.headers, { Authorization: 'Bearer ' + token });
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    if(res.status === 401 && !retried){
      ss(DRIVE_TOKEN_KEY, null);
      return authFetch(url, opts, true);
    }
    return res;
  }

  async function signIn(){
    if(!configured()){
      alert('Chưa cấu hình GOOGLE_CLIENT_ID trong js/drivesync.js.');
      return;
    }
    try{
      await requestToken(isLinked() ? '' : 'select_account');
    }catch(e){
      if(isLinked()) setStatus('signedout', true);
      return;
    }
    saveMeta({ linked: true });
    ss(DRIVE_SYNCED_KEY, null);
    fetchEmail();
    setStatus('idle');
    syncNow('signin');
  }

  async function fetchEmail(){
    try{
      const res = await authFetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');
      if(!res.ok) return;
      const data = await res.json();
      if(data.user && data.user.emailAddress){ saveMeta({ email: data.user.emailAddress }); refreshUi(); }
    }catch(e){}
  }

  function signOut(){
    clearTimeout(autosaveTimer); clearTimeout(retryTimer);
    ss(DRIVE_TOKEN_KEY, null);
    ss(DRIVE_SYNCED_KEY, null);
    try{ localStorage.removeItem(DRIVE_META_KEY); }catch(e){} // local data stays
    setStatus('signedout');
  }

  /* ---------- Drive REST ---------- */
  const API = 'https://www.googleapis.com/drive/v3/files';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

  async function ensureFile(){
    const cached = loadMeta().fileId;
    if(cached) return cached;
    const q = encodeURIComponent("name='" + DRIVE_FILE_NAME + "'");
    const res = await authFetch(API + '?spaces=appDataFolder&orderBy=createdTime&fields=files(id)&q=' + q);
    if(!res.ok) throw new Error('list ' + res.status);
    const found = (await res.json()).files || [];
    if(found.length){ saveMeta({ fileId: found[0].id }); return found[0].id; }

    const boundary = 'engvocab' + Date.now().toString(36);
    const body =
      '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify({ name: DRIVE_FILE_NAME, parents: ['appDataFolder'] }) + '\r\n' +
      '--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' +
      JSON.stringify(emptyPayload()) + '\r\n--' + boundary + '--';
    const made = await authFetch(UPLOAD + '?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
      body
    });
    if(!made.ok) throw new Error('create ' + made.status);
    const id = (await made.json()).id;
    saveMeta({ fileId: id });
    return id;
  }

  function emptyPayload(){ return { version: 1, savedAt: 0, sets: [], streak: {} }; }
  function buildPayload(sets, streak){
    return { version: 1, savedAt: Date.now(), sets, streak: streak || {} };
  }

  // returns {sets, streak}; throws if the file is unreadable so we never overwrite it blindly
  async function downloadRemote(fileId){
    const res = await authFetch(API + '/' + fileId + '?alt=media');
    if(res.status === 404){ saveMeta({ fileId: '' }); throw new Error('file gone'); }
    if(!res.ok) throw new Error('download ' + res.status);
    const text = await res.text();
    if(!text.trim()) return { sets: [], streak: null };
    const data = JSON.parse(text);
    if(!data || !Array.isArray(data.sets)) throw new Error('unexpected remote shape');
    return { sets: migrateSets(data.sets), streak: data.streak && data.streak.lastDate !== undefined ? data.streak : null };
  }

  async function uploadRemote(fileId, payload){
    const res = await authFetch(UPLOAD + '/' + fileId + '?uploadType=media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('upload ' + res.status);
  }

  /* ---------- sync ---------- */
  function currentStreak(){ return typeof loadStreak === 'function' ? loadStreak() : null; }

  function renderIfSafe(){
    if(['home', 'detail'].includes(view) && typeof render === 'function') render();
  }

  // download -> merge -> (save locally) -> upload if it differs from remote
  async function syncNow(reason){
    if(!isLinked()) return;
    if(busy){ rerun = true; return; }
    if(!navigator.onLine){ setStatus('unsynced'); return; }
    busy = true; rerun = false;
    clearTimeout(autosaveTimer); clearTimeout(retryTimer);
    setStatus('syncing');
    try{
      let fileId = await ensureFile();
      let remote;
      try{ remote = await downloadRemote(fileId); }
      catch(e){
        if(e.message !== 'file gone') throw e;
        fileId = await ensureFile();
        remote = await downloadRemote(fileId);
      }

      // no awaits between reading local state and applying the merge
      const revAtMerge = localRev;
      const localStreak = currentStreak();
      const mergedSets = mergeSets(baseSets, remote.sets);
      const mergedStreak = mergeStreak(localStreak, remote.streak);
      const localChanged = canonJson(mergedSets) !== canonJson(baseSets);
      const streakChanged = canonJson(mergedStreak) !== canonJson(localStreak || {});
      if(localChanged) applyMergedSets(mergedSets);
      if(streakChanged){
        try{ localStorage.setItem(STREAK_KEY, JSON.stringify(mergedStreak)); }catch(e){}
      }
      const sameAsRemote = canonJson(mergedSets) === canonJson(remote.sets)
        && canonJson(mergedStreak) === canonJson(remote.streak || {});
      if(!sameAsRemote) await uploadRemote(fileId, buildPayload(mergedSets, mergedStreak));

      ss(DRIVE_SYNCED_KEY, '1');
      if(localRev === revAtMerge) saveMeta({ dirty: false, dirtySince: 0 });
      saveMeta({ lastSavedAt: Date.now() });
      setStatus('saved');
      if(localChanged || streakChanged) renderIfSafe();
    }catch(e){
      console.warn('Drive sync failed:', e);
      const authFailed = /auth|popup|token|gis/i.test(String(e && e.message));
      setStatus(authFailed ? 'signedout' : (navigator.onLine ? 'error' : 'unsynced'), authFailed);
      if(!authFailed && loadMeta().autosave) retryTimer = setTimeout(() => syncNow('retry'), DRIVE_RETRY_MS);
    }finally{
      busy = false;
      if(rerun && status !== 'signedout') scheduleAutosave();
    }
  }

  /* ---------- autosave ---------- */
  function markDirty(){
    const meta = loadMeta();
    if(!meta.linked) return;
    localRev++;
    if(!meta.dirty) saveMeta({ dirty: true, dirtySince: Date.now() });
    if(status !== 'syncing') setStatus('unsynced');
    scheduleAutosave();
  }

  // debounce 5s after the last change, but never wait more than 60s since the first
  function scheduleAutosave(){
    const meta = loadMeta();
    if(!meta.linked || !meta.autosave || !meta.dirty) return;
    clearTimeout(autosaveTimer);
    const since = meta.dirtySince || Date.now();
    const delay = Math.max(0, Math.min(DRIVE_DEBOUNCE_MS, since + DRIVE_MAX_WAIT_MS - Date.now()));
    autosaveTimer = setTimeout(() => syncNow('autosave'), delay);
  }

  function setAutosave(on){
    saveMeta({ autosave: !!on });
    if(on) scheduleAutosave(); else clearTimeout(autosaveTimer);
    refreshUi();
  }

  /* ---------- leaving the page ---------- */
  window.addEventListener('beforeunload', e => {
    if(skipUnloadWarning) return;
    const m = loadMeta();
    if(m.linked && m.dirty){ e.preventDefault(); e.returnValue = ''; }
  });

  // moving between the app's own pages keeps `dirty` in localStorage, so the next page resumes the sync
  function allowNavigation(){ skipUnloadWarning = true; }

  // Last chance to push changes when the tab is hidden/closed. Only after a full sync this
  // session, because it uploads our copy as-is (no merge) and must not hide newer remote data.
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState !== 'hidden') return;
    const meta = loadMeta();
    const token = storedToken();
    if(!meta.linked || !meta.dirty || !meta.autosave || !meta.fileId || !token || !ss(DRIVE_SYNCED_KEY)) return;
    try{
      const body = JSON.stringify(buildPayload(baseSets, currentStreak()));
      if(new Blob([body]).size > DRIVE_KEEPALIVE_LIMIT) return;
      fetch(UPLOAD + '/' + meta.fileId + '?uploadType=media', {
        method: 'PATCH',
        keepalive: true,
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body
      }).catch(() => {});
    }catch(e){}
  });

  window.addEventListener('online', () => {
    const m = loadMeta();
    if(m.linked && (m.dirty || status === 'unsynced' || status === 'error')) syncNow('online');
  });
  window.addEventListener('offline', () => {
    if(isLinked() && loadMeta().dirty) setStatus('unsynced');
  });

  /* ---------- UI ---------- */
  function statusText(){
    const meta = loadMeta();
    if(status === 'syncing') return 'Đang lưu...';
    if(status === 'unsynced' || status === 'error') return 'Chưa đồng bộ';
    if(status === 'signedout') return 'Chưa đăng nhập';
    if(meta.lastSavedAt && !meta.dirty){
      const d = new Date(meta.lastSavedAt);
      return 'Đã lưu lúc ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    return meta.dirty ? 'Chưa đồng bộ' : 'Đã đăng nhập';
  }

  function uiHtml(){
    const meta = loadMeta();
    if(!meta.linked){
      return '<button class="btn-ghost" onclick="DriveSync.signIn()" title="Lưu và đồng bộ dữ liệu qua Google Drive">Đăng nhập Google</button>';
    }
    const text = escapeHtml(statusText());
    return `
      <span class="drive-email" title="${escapeAttr(meta.email || '')}">${escapeHtml(meta.email || 'Google Drive')}</span>
      <label class="drive-toggle"><input type="checkbox" ${meta.autosave ? 'checked' : ''} onchange="DriveSync.setAutosave(this.checked)"> Tự động lưu</label>
      <span class="drive-status ${status === 'unsynced' || status === 'error' ? 'is-warn' : ''}">${text}</span>
      ${needsRelogin ? '<button class="btn-primary" onclick="DriveSync.signIn()">Đăng nhập lại</button>' : ''}
      <button class="btn-ghost" onclick="DriveSync.syncNow(\'manual\')" ${status === 'syncing' ? 'disabled' : ''}>Lưu ngay</button>
      <button class="btn-ghost" onclick="DriveSync.signOut()">Đăng xuất</button>
    `;
  }

  function refreshUi(){
    const box = document.getElementById('driveBox');
    if(box) box.innerHTML = uiHtml();
  }

  /* ---------- start ---------- */
  function init(){
    const meta = loadMeta();
    if(!meta.linked){ status = 'signedout'; return; }
    status = meta.dirty ? 'unsynced' : (meta.lastSavedAt ? 'saved' : 'idle');
    // one full sync per session, plus whatever an earlier page left unsaved
    if(!ss(DRIVE_SYNCED_KEY) || meta.dirty) setTimeout(() => syncNow('open'), 300);
  }
  init();

  return { signIn, signOut, syncNow, setAutosave, uiHtml, refreshUi, markDirty, allowNavigation };
})();

// globals used by state.js / progress.js / layout.js
function driveMarkDirty(){ DriveSync.markDirty(); }
function driveAllowNavigation(){ DriveSync.allowNavigation(); }
function driveUiHtml(){ return DriveSync.uiHtml(); }
