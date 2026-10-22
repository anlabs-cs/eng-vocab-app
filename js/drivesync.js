/* =========================================================
   GOOGLE DRIVE SYNC (appDataFolder) + LOGIN
   Signs in with Google Identity Services and keeps one file,
   engvocab.json, in the app's hidden Drive folder. Local data
   (localStorage) stays the source the app runs on; this module
   only merges with the Drive copy.

   Two modes share the same localStorage keys:
   - guest: data lives only in this browser
   - signed in: data is the account's (Drive) data, cached locally
   Signing in stashes the guest data; signing out puts it back,
   so the app returns to exactly how it was before signing in.
========================================================= */
const GOOGLE_CLIENT_ID = '415733756519-pmto26fq436lgljkik0pe5g7mvmcugnt.apps.googleusercontent.com';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_FILE_NAME = 'engvocab.json';
const DRIVE_META_KEY = 'vocabapp_drive_v1';          // localStorage: {linked,email,fileId,lastSavedAt,autosave,dirty,dirtySince}
const DRIVE_TOKEN_KEY = 'vocabapp_drive_token_v1';   // localStorage: {token,expiresAt} (survives closing the tab)
const DRIVE_SYNCED_KEY = 'vocabapp_drive_synced_v1'; // sessionStorage: full sync already done this session
const GUEST_DATA_KEY = 'vocabapp_guest_data_v1';     // localStorage: guest {sets,streak} stashed while signed in
const GUEST_OK_KEY = 'vocabapp_guest_ok_v1';         // localStorage: user chose to use the app without signing in
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
  let tokenPromise = null;
  let skipUnloadWarning = false;
  let login = { busy: false, error: '' }; // login screen state

  /* ---------- small state helpers ---------- */
  function loadMeta(){
    try{ return Object.assign({ autosave: true }, JSON.parse(localStorage.getItem(DRIVE_META_KEY) || '{}')); }
    catch(e){ return { autosave: true }; }
  }
  function saveMeta(patch){
    try{ localStorage.setItem(DRIVE_META_KEY, JSON.stringify(Object.assign(loadMeta(), patch))); }catch(e){}
  }
  function ls(key, val){
    try{
      if(val === undefined) return localStorage.getItem(key);
      if(val === null) localStorage.removeItem(key); else localStorage.setItem(key, val);
    }catch(e){}
    return null;
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
  function needsLogin(){ return !isLinked() && !ls(GUEST_OK_KEY); }

  function setStatus(next, relogin){
    needsRelogin = !!relogin;
    status = next;
    refreshUi();
  }

  /* ---------- auth ---------- */
  function storedToken(){
    try{
      const t = JSON.parse(ls(DRIVE_TOKEN_KEY) || 'null');
      if(t && t.token && t.expiresAt > Date.now() + 30000) return t.token;
    }catch(e){}
    return null;
  }

  function gisReady(){ return !!(window.google && google.accounts && google.accounts.oauth2); }
  function waitForGis(ms){
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function check(){
        if(gisReady()) return resolve();
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
        if(!resp || resp.error || !resp.access_token) return w.reject(new Error('auth ' + ((resp && resp.error) || 'no token')));
        ls(DRIVE_TOKEN_KEY, JSON.stringify({
          token: resp.access_token,
          expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000 - 60000
        }));
        w.resolve(resp.access_token);
      },
      error_callback: err => {
        const w = tokenWaiter; tokenWaiter = null;
        if(w) w.reject(new Error('auth ' + ((err && err.type) || 'error')));
      }
    });
    return tokenClient;
  }

  /* Opens Google's popup, so it must run from a click/keypress.
     prompt: '' = closes by itself when the user already consented, 'select_account' = account chooser */
  function requestToken(prompt){
    if(tokenPromise) return tokenPromise;
    tokenPromise = new Promise((resolve, reject) => {
      const start = () => {
        const client = ensureTokenClient();
        tokenWaiter = { resolve, reject };
        setTimeout(() => {
          if(tokenWaiter && tokenWaiter.resolve === resolve){ tokenWaiter = null; reject(new Error('auth timeout')); }
        }, 120000);
        const email = loadMeta().email;
        client.requestAccessToken(email ? { prompt, login_hint: email } : { prompt });
      };
      // call synchronously when GIS is loaded so the popup keeps the user's click
      if(gisReady()) start(); else waitForGis().then(start, reject);
    });
    const clear = () => { tokenPromise = null; };
    tokenPromise.then(clear, clear);
    return tokenPromise;
  }

  // a stored token, or the one a click is fetching right now; never opens a popup by itself
  async function getToken(){
    const t = storedToken();
    if(t) return t;
    if(tokenPromise) return tokenPromise;
    throw new Error('needs gesture');
  }

  /* The access token lasts ~1h and Google only renews it through a popup.
     We never open that popup on our own (an old version did it on the next random
     click, which made a popup flash open and shut). The user renews the session
     on purpose with the "Reconnect" button; until then data stays safe locally. */
  function tokenExpired(){ return isLinked() && !storedToken(); }

  async function authFetch(url, opts, retried){
    const token = await getToken();
    const headers = Object.assign({}, opts && opts.headers, { Authorization: 'Bearer ' + token });
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    if(res.status === 401 && !retried){
      ls(DRIVE_TOKEN_KEY, null);
      return authFetch(url, opts, true);
    }
    return res;
  }

  async function fetchEmail(){
    const res = await authFetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');
    if(!res.ok) throw new Error('about ' + res.status);
    const data = await res.json();
    return (data.user && data.user.emailAddress) || '';
  }

  function setLogin(patch){
    Object.assign(login, patch);
    if(needsLogin()){ if(typeof render === 'function') render(); }
    else if(patch.error) alert(patch.error); // signing in from the nav button in guest mode
  }

  async function signIn(){
    if(!configured()){
      alert('GOOGLE_CLIENT_ID is not configured in js/drivesync.js.');
      return;
    }
    if(isLinked()) return relogin();
    if(login.busy) return;
    setLogin({ busy: true, error: '' });
    try{
      await requestToken('select_account');
    }catch(e){
      const cancelled = /popup_closed|access_denied/.test(e.message);
      const offline = /gis unavailable/.test(e.message);
      setLogin({ busy: false, error: cancelled ? '' : offline
        ? 'Could not reach Google. Check your connection and try again.'
        : 'Could not open the Google sign-in window. Allow pop-ups for this site and try again.' });
      return;
    }
    try{
      await adoptAccount();
    }catch(e){
      console.warn('Sign-in failed:', e);
      ls(DRIVE_TOKEN_KEY, null);
      ls(DRIVE_META_KEY, null);
      setLogin({ busy: false, error: 'Could not load your data from Google Drive. Check your connection and try again.' });
      return;
    }
    setLogin({ busy: false, error: '' });
    ls(GUEST_OK_KEY, null);
    setStatus('saved');
    if(typeof go === 'function') go('home');
  }

  /* First sign-in on this browser: load the account's data from Drive.
     The guest data is stashed (restored on sign-out). A brand-new account
     (empty Drive file) starts from the guest data instead of from nothing.
     Nothing local changes unless every Drive call succeeded. */
  async function adoptAccount(){
    const email = await fetchEmail();
    const fileId = await ensureFile();
    const remote = await downloadRemote(fileId);
    const guestSets = ls(STORAGE_KEY);
    const guestStreak = ls(STREAK_KEY);
    const remoteEmpty = remote.sets.length === 0 && !remote.streak;

    if(remoteEmpty){
      await uploadRemote(fileId, buildPayload(baseSets, currentStreak()));
    }
    ls(GUEST_DATA_KEY, JSON.stringify({ sets: guestSets, streak: guestStreak }));
    if(!remoteEmpty){
      applyMergedSets(remote.sets);
      ls(STREAK_KEY, remote.streak ? JSON.stringify(remote.streak) : null);
    }
    ls(CURRENT_SET_KEY, null);
    saveMeta({ linked: true, email, fileId, lastSavedAt: Date.now(), dirty: false, dirtySince: 0 });
    ss(DRIVE_SYNCED_KEY, '1');
  }

  // already signed in, the session just expired
  async function relogin(){
    try{ await requestToken(''); }
    catch(e){ setStatus('signedout', true); return; }
    needsRelogin = false;
    ss(DRIVE_SYNCED_KEY, null);
    syncNow('signin');
  }

  function useAsGuest(){
    ls(GUEST_OK_KEY, '1');
    login = { busy: false, error: '' };
    if(typeof render === 'function') render();
  }

  async function signOut(){
    if(loadMeta().dirty){
      await syncNow('signout');
      if(loadMeta().dirty && !confirm('Some changes have not been saved to Google Drive and will be removed from this device when you sign out. Sign out anyway?')) return;
    }
    clearTimeout(autosaveTimer); clearTimeout(retryTimer);
    // the token is only dropped, not revoked: revoking would also sign out the user's other devices

    // put the guest data back exactly as it was before signing in
    let guest = {};
    try{ guest = JSON.parse(ls(GUEST_DATA_KEY) || '{}') || {}; }catch(e){}
    ls(STORAGE_KEY, guest.sets || null);
    ls(STREAK_KEY, guest.streak || null);
    [GUEST_DATA_KEY, GUEST_OK_KEY, DRIVE_META_KEY, DRIVE_TOKEN_KEY, CURRENT_SET_KEY].forEach(k => ls(k, null));
    ss(DRIVE_SYNCED_KEY, null);

    skipUnloadWarning = true;
    location.href = new URL('index.html', location.href).toString(); // fresh start on the login screen
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
      if(streakChanged) ls(STREAK_KEY, JSON.stringify(mergedStreak));
      const sameAsRemote = canonJson(mergedSets) === canonJson(remote.sets)
        && canonJson(mergedStreak) === canonJson(remote.streak || {});
      if(!sameAsRemote) await uploadRemote(fileId, buildPayload(mergedSets, mergedStreak));

      ss(DRIVE_SYNCED_KEY, '1');
      if(localRev === revAtMerge) saveMeta({ dirty: false, dirtySince: 0 });
      saveMeta({ lastSavedAt: Date.now() });
      setStatus('saved');
      if(localChanged || streakChanged) renderIfSafe();
    }catch(e){
      const msg = String(e && e.message);
      if(msg === 'needs gesture'){
        // token expired: still signed in, nothing is lost. Only warn if there are unsaved changes.
        setStatus(loadMeta().dirty ? 'unsynced' : 'idle', !!loadMeta().dirty);
        return;
      }
      console.warn('Drive sync failed:', e);
      const authFailed = /auth|token|gis/i.test(msg);
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
    if(status !== 'syncing') setStatus('unsynced', needsRelogin);
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
    if(status === 'syncing') return 'Saving...';
    if(status === 'unsynced' || status === 'error') return 'Not synced';
    if(status === 'signedout') return 'Signed out';
    if(meta.lastSavedAt && !meta.dirty){
      const d = new Date(meta.lastSavedAt);
      return 'Saved at ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    return meta.dirty ? 'Not synced' : 'Signed in';
  }

  let panelOpen = false;

  function statusClass(){
    if(needsRelogin || status === 'unsynced' || status === 'error') return 'is-warn';
    if(status === 'syncing') return 'is-sync';
    return 'is-ok';
  }

  function chipText(){
    if(needsRelogin) return 'Reconnect to save';
    const t = statusText();
    return t.replace('Saved at ', 'Saved ');
  }

  function panelHtml(meta){
    return `
      <div class="drive-panel" onclick="event.stopPropagation()">
        <div class="drive-panel-head">
          <div class="drive-panel-title">Google Drive</div>
          <div class="drive-panel-email">${escapeHtml(meta.email || 'Signed in')}</div>
        </div>
        <div class="drive-panel-status ${statusClass()}"><span class="drive-dot"></span>${escapeHtml(statusText())}</div>
        ${(needsRelogin || tokenExpired()) ? '<p class="drive-panel-note">Your session has expired. Your data is still kept on this device.</p>' : ''}
        <label class="drive-switch-row">
          <span>Auto-save</span>
          <span class="drive-switch"><input type="checkbox" ${meta.autosave ? 'checked' : ''} onchange="DriveSync.setAutosave(this.checked)"><i></i></span>
        </label>
        <div class="drive-panel-actions">
          ${(needsRelogin || tokenExpired())
            ? '<button class="btn-primary" onclick="DriveSync.signIn()">Reconnect</button>'
            : `<button class="btn-primary" onclick="DriveSync.syncNow('manual')" ${status === 'syncing' ? 'disabled' : ''}>Save now</button>`}
          <button class="btn-ghost" onclick="DriveSync.signOut()">Sign out</button>
        </div>
      </div>`;
  }

  function uiHtml(){
    const meta = loadMeta();
    if(!meta.linked){
      return '<button class="btn-ghost drive-signin" onclick="DriveSync.signIn()" title="Save and sync your data with Google Drive"><span class="drive-dot"></span>Sign in with Google</button>';
    }
    return `
      <div class="drive-wrap">
        <button class="drive-chip ${statusClass()}" onclick="DriveSync.togglePanel(event)" aria-expanded="${panelOpen}" title="${escapeAttr(meta.email || 'Google Drive')}">
          <span class="drive-dot"></span><span class="drive-chip-text">${escapeHtml(chipText())}</span>
        </button>
        ${panelOpen ? panelHtml(meta) : ''}
      </div>`;
  }

  const GOOGLE_G = '<svg class="login-g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';

  // full-page sign-in screen, shown instead of the app until the user signs in or picks guest mode
  function loginHtml(){
    return `
      <div class="login-page">
        <button class="icon-btn login-theme" title="${currentTheme()==='light'?'Switch to dark mode':'Switch to light mode'}" onclick="toggleTheme()">${currentTheme()==='light'?'<img src="img/icon/moon.png" class="theme-icon">':'<img src="img/icon/sun.png" class="theme-icon">'}</button>
        <div class="login-card">
          <img src="img/icon/icon-512.png" class="login-logo" alt="">
          <div class="login-brand">EngVocab</div>
          <h1 class="login-title">Sign in to keep learning</h1>
          <p class="login-lead">Your sets, review progress and study streak are saved to your Google Drive, so they follow you to any device.</p>
          <button class="login-google" onclick="DriveSync.signIn()" ${login.busy ? 'disabled' : ''}>
            ${login.busy ? '<span class="login-spinner"></span>Signing in...' : GOOGLE_G + 'Continue with Google'}
          </button>
          ${login.error ? `<p class="login-error" role="alert">${escapeHtml(login.error)}</p>` : ''}
          <div class="login-or"><span>or</span></div>
          <button class="link-btn" onclick="DriveSync.useAsGuest()" ${login.busy ? 'disabled' : ''}>Continue without signing in</button>
          <p class="login-note">If you don't sign in, your data is only stored in this browser.</p>
        </div>
      </div>`;
  }

  function togglePanel(e){
    if(e) e.stopPropagation();
    panelOpen = !panelOpen;
    refreshUi();
  }
  document.addEventListener('click', () => { if(panelOpen){ panelOpen = false; refreshUi(); } });

  function refreshUi(){
    const box = document.getElementById('driveBox');
    if(box) box.innerHTML = uiHtml();
  }

  /* ---------- start ---------- */
  function init(){
    // the token used to live in sessionStorage; drop any leftover copy
    try{ sessionStorage.removeItem(DRIVE_TOKEN_KEY); }catch(e){}
    const meta = loadMeta();
    if(!meta.linked){ status = 'signedout'; return; }
    status = meta.dirty ? 'unsynced' : (meta.lastSavedAt ? 'saved' : 'idle');
    // one full sync per session, plus whatever an earlier page left unsaved
    if(!ss(DRIVE_SYNCED_KEY) || meta.dirty) setTimeout(() => syncNow('open'), 300);
  }
  init();

  return { signIn, signOut, useAsGuest, syncNow, setAutosave, uiHtml, loginHtml, needsLogin, refreshUi, togglePanel, markDirty, allowNavigation };
})();

// globals used by state.js / progress.js / layout.js
function driveMarkDirty(){ DriveSync.markDirty(); }
function driveSyncNow(){ DriveSync.syncNow('now'); }
function driveAllowNavigation(){ DriveSync.allowNavigation(); }
function driveUiHtml(){ return DriveSync.uiHtml(); }