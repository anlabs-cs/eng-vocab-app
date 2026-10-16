/* =========================================================
   LAYOUT: render dispatcher + shared top nav + data menu.
   Loaded on every page, before the view files.
   Views that don't exist on the current page are skipped via
   typeof checks (e.g. index.html only loads home.js).
========================================================= */
const VIEW_RENDERERS = {
  'home': 'renderHome',
  'detail': 'renderDetail',
  'editor': 'renderEditor',
  'flashcards': 'renderFlashcards',
  'learn': 'renderLearn',
  'test-setup': 'renderTestSetup',
  'test': 'renderTest',
  'results': 'renderResults'
};

function render(){
  const fn = window[VIEW_RENDERERS[view]];
  if(typeof fn === 'function') return fn();
}

function fileStatusHtml(){
  if(!FS_SUPPORTED) return '';
  if(fileSyncStatus==='connected'){
    return `<button class="btn-ghost nav-file" title="Synced to ${escapeAttr(fileName||'file')} — click to switch file" onclick="connectExistingFile()">✓ ${escapeHtml(fileName||'.json')}</button>`;
  }
  if(fileSyncStatus==='saving'){
    return `<button class="btn-ghost nav-file" disabled>Saving...</button>`;
  }
  if(fileSyncStatus==='needs-permission'){
    return `<button class="btn-primary nav-file" onclick="reconnectFile()" title="Allow access to your .json file again">Reconnect .json</button>`;
  }
  if(fileSyncStatus==='error'){
    return `<button class="btn-ghost nav-file" style="color:var(--red);" onclick="connectExistingFile()" title="Failed to save file, try again">Save failed</button>`;
  }
  return '';
}

let dataMenuOpen = false;
function openDataMenu(){ dataMenuOpen = true; render(); }
function closeDataMenu(){ dataMenuOpen = false; render(); }

function dataMenuHtml(){
  const sync = FS_SUPPORTED ? `
    <h3 class="modal-subtitle">Auto-save to a file</h3>
    <p class="modal-hint">${fileSyncStatus==='connected'
      ? `Every change is saved to <strong>${escapeHtml(fileName||'')}</strong>.`
      : 'Keep your data in a .json file on your computer. Every change is written to it automatically.'}
      Put the file in a Google Drive / OneDrive / Dropbox folder to use the same data on several computers (open the app on one computer at a time).</p>
    <div class="modal-btn-row">
      <button class="btn-ghost" onclick="connectExistingFile()">Open .json file</button>
      <button class="btn-ghost" onclick="createNewFile()">Create new .json file</button>
    </div>
  ` : `
    <p class="modal-hint">This browser can't auto-save to a file (use Chrome or Edge for that). Download a backup regularly so you don't lose your data.</p>
  `;
  return `
    <div class="modal-overlay" onclick="closeDataMenu()">
      <div class="modal" onclick="event.stopPropagation()" style="position:relative;">
        <button class="modal-close" onclick="closeDataMenu()"><img src="img/icon/x.png" class="theme-icon"></button>
        <h2>Your data</h2>
        <h3 class="modal-subtitle">Backup</h3>
        <p class="modal-hint">One .json file with all ${SETS.length} set(s), progress and streak.</p>
        <div class="modal-btn-row">
          <button class="btn-primary" onclick="downloadBackup()"><img src="img/icon/download.png" class="theme-icon"> Download backup</button>
          <button class="btn-ghost" onclick="pickDataFile('replace')">Restore backup…</button>
        </div>
        <h3 class="modal-subtitle">Import sets</h3>
        <p class="modal-hint">Add sets from a .json file (a set a friend shared, or another library). Your existing sets are kept.</p>
        <div class="modal-btn-row">
          <button class="btn-ghost" onclick="pickDataFile('merge')"><img src="img/icon/import.png" class="theme-icon"> Import .json (merge)</button>
        </div>
        ${sync}
        <input type="file" id="dataFileInput" accept=".json,application/json" style="display:none" onchange="onDataFilePicked(event)">
      </div>
    </div>
  `;
}

function topNav(){
  const showInstall = window.deferredPrompt ? 'inline-block' : 'none';
  return `
    <div class="topnav">
      <div class="brand" onclick="go('home')">
        <span>EngVocab</span>
      </div>
      <div class="spacer"></div>
      <button id="installAppBtn" class="btn-primary" style="display:${showInstall};" onclick="installPWA()">⬇ Cài App</button>
      ${fileStatusHtml()}
      <button class="btn-ghost" title="Backup, restore, import, file sync" onclick="openDataMenu()">Data</button>
      <button class="icon-btn" title="${currentTheme()==='light'?'Switch to dark mode':'Switch to light mode'}" onclick="toggleTheme()">${currentTheme()==='light'?'<img src="img/icon/moon.png" class="theme-icon">':'<img src="img/icon/sun.png" class="theme-icon">'}</button>
    </div>
    ${dataMenuOpen ? dataMenuHtml() : ''}
  `;
}
